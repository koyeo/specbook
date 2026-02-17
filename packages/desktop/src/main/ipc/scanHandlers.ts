/**
 * Feature Mapping IPC handlers.
 *
 * SCAN_MAPPING  — runs AI semantic analysis, diffs with previous mapping,
 *                 saves mapping.json and returns the result.
 * LOAD_MAPPING  — reads the persisted mapping.json from disk.
 */
import { ipcMain } from 'electron';
import { IPC } from '@specbook/shared';
import type { FeatureMappingIndex, FeatureMappingEntry, MappingChangeEntry, RelatedFile } from '@specbook/shared';
import { analyzeObjectTree } from '@specbook/ai';
import { getAiConfig, appendTokenUsage } from '../infrastructure/appConfig';
import { getWorkspace } from './specHandlers';
import { loadAllObjects } from '../infrastructure/specStore';
import { readMapping, writeMapping } from '../infrastructure/mappingStore';

declare const console: { log(...args: any[]): void; error(...args: any[]): void };

// ─── Diff Engine ────────────────────────────────────

/**
 * Compare new mapping entries against the previous mapping to produce a changelog.
 */
function computeChangelog(
    newEntries: FeatureMappingEntry[],
    oldMapping: FeatureMappingIndex | null,
): MappingChangeEntry[] {
    const oldMap = new Map<string, FeatureMappingEntry>();
    if (oldMapping) {
        for (const e of oldMapping.entries) {
            oldMap.set(e.objectId, e);
        }
    }

    const changelog: MappingChangeEntry[] = [];
    const processedIds = new Set<string>();

    // Check new entries against old
    for (const entry of newEntries) {
        processedIds.add(entry.objectId);
        const old = oldMap.get(entry.objectId);

        if (!old) {
            // New object — not in previous mapping
            changelog.push({
                objectId: entry.objectId,
                objectTitle: entry.objectTitle,
                changeType: 'added',
                currentStatus: entry.status,
                changeSummary: '新增实现',
                addedFiles: [...entry.implFiles, ...entry.testFiles],
                removedFiles: [],
            });
            continue;
        }

        // Exists in both — check for changes
        const statusChanged = entry.status !== old.status;
        const oldFilePaths = new Set([...old.implFiles, ...old.testFiles].map(f => f.filePath));
        const newFilePaths = new Set([...entry.implFiles, ...entry.testFiles].map(f => f.filePath));

        const addedFiles: RelatedFile[] = [...entry.implFiles, ...entry.testFiles]
            .filter(f => !oldFilePaths.has(f.filePath));
        const removedFiles: RelatedFile[] = [...old.implFiles, ...old.testFiles]
            .filter(f => !newFilePaths.has(f.filePath));

        const filesChanged = addedFiles.length > 0 || removedFiles.length > 0;

        if (!statusChanged && !filesChanged) {
            changelog.push({
                objectId: entry.objectId,
                objectTitle: entry.objectTitle,
                changeType: 'unchanged',
                currentStatus: entry.status,
                previousStatus: old.status,
                changeSummary: '',
                addedFiles: [],
                removedFiles: [],
            });
            continue;
        }

        // Something changed
        const parts: string[] = [];
        if (statusChanged) {
            parts.push(`${old.status} → ${entry.status}`);
        }
        if (filesChanged) {
            parts.push('实现文件变更');
        }

        changelog.push({
            objectId: entry.objectId,
            objectTitle: entry.objectTitle,
            changeType: 'changed',
            currentStatus: entry.status,
            previousStatus: old.status,
            changeSummary: parts.join('；'),
            addedFiles,
            removedFiles,
        });
    }

    // Entries removed (in old but not in new)
    for (const [id, old] of oldMap) {
        if (!processedIds.has(id)) {
            changelog.push({
                objectId: id,
                objectTitle: old.objectTitle,
                changeType: 'removed',
                previousStatus: old.status,
                changeSummary: '需求已移除',
                addedFiles: [],
                removedFiles: [...old.implFiles, ...old.testFiles],
            });
        }
    }

    return changelog;
}

// ─── Handler Registration ───────────────────────────

export function registerScanHandlers(): void {
    // Semantic scan: AI analysis → diff → persist
    ipcMain.handle(IPC.SCAN_MAPPING, async (): Promise<FeatureMappingIndex> => {
        const ws = getWorkspace();
        if (!ws) throw new Error('No workspace selected. Please open a folder first.');

        const config = getAiConfig();
        if (!config || !config.apiKey) {
            throw new Error('AI is not configured. Please set your API Key in Settings.');
        }

        // 1. Load object tree
        const objectTree = loadAllObjects(ws);
        if (objectTree.length === 0) {
            throw new Error('No objects in the feature tree. Add objects first.');
        }

        // 2. Load previous mapping (for diff)
        const previousMapping = readMapping(ws);

        // 3. Run AI analysis
        console.log('[Mapping] Starting AI analysis...');
        const result = await analyzeObjectTree(objectTree, config, ws);
        console.log(`[Mapping] AI analysis complete — ${result.mappings.length} mappings`);

        // 4. Transform AI mappings → FeatureMappingEntry[]
        const entries: FeatureMappingEntry[] = result.mappings.map(m => {
            const implFiles: RelatedFile[] = (m.relatedFiles ?? []).filter(f => f.type === 'impl');
            const testFiles: RelatedFile[] = (m.relatedFiles ?? []).filter(f => f.type === 'test');

            // Try to match objectTitle back to objectId from the tree
            const findId = (nodes: typeof objectTree): string | undefined => {
                for (const n of nodes) {
                    if (n.title === m.objectTitle) return n.id;
                    if (n.children) {
                        const found = findId(n.children);
                        if (found) return found;
                    }
                }
                return undefined;
            };

            return {
                objectId: findId(objectTree) ?? m.objectTitle,
                objectTitle: m.objectTitle,
                status: m.status,
                summary: m.summary,
                implFiles,
                testFiles,
            };
        });

        // 5. Compute changelog
        const changelog = computeChangelog(entries, previousMapping);

        // 6. Build mapping index
        const mappingIndex: FeatureMappingIndex = {
            version: '1.0',
            scannedAt: new Date().toISOString(),
            directoryTree: result.directoryTree,
            tokenUsage: result.tokenUsage,
            entries,
            changelog,
        };

        // 7. Persist
        writeMapping(ws, mappingIndex);
        appendTokenUsage(result.tokenUsage);

        console.log(`[Mapping] Saved mapping.json — ${entries.length} entries, ${changelog.filter(c => c.changeType !== 'unchanged').length} changes`);
        return mappingIndex;
    });

    // Load persisted mapping
    ipcMain.handle(IPC.LOAD_MAPPING, async (): Promise<FeatureMappingIndex | null> => {
        const ws = getWorkspace();
        if (!ws) return null;
        return readMapping(ws);
    });
}
