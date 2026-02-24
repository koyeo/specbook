/**
 * IPC handlers — feature mapping scan using DFS agentic scanner.
 *
 * SCAN_MAPPING:  Full DFS bottom-up scan of the entire object tree.
 * LOAD_MAPPING:  Read aggregated mapping index from disk.
 * SCAN_SINGLE:   Scan a single object by ID.
 */
import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@specbook/shared';
import type { FeatureMappingIndex, FeatureMappingEntry, MappingChangeEntry, ObjectMappingResult, ScanProgressEvent, ObjectTreeNode } from '@specbook/shared';
import { scanObjectTreeDFS, scanSingleObject } from '@specbook/ai';
import { getAiConfig, getLastWorkspace } from '../infrastructure/appConfig';
import { loadAllObjects, readObjectDetail } from '../infrastructure/specStore';
import {
    readMappingIndex, writeMappingIndex,
    readAllObjectMappings, writeObjectMapping,
    mappingResultsToEntries,
} from '../infrastructure/mappingStore';

declare const console: { log(...args: any[]): void; error(...args: any[]): void };

// ─── Changelog diff engine ──────────────────────────

function computeChangelog(
    newEntries: FeatureMappingEntry[],
    oldIndex: FeatureMappingIndex | null,
): MappingChangeEntry[] {
    const oldMap = new Map<string, FeatureMappingEntry>();
    if (oldIndex) {
        for (const entry of oldIndex.entries) {
            oldMap.set(entry.objectId, entry);
        }
    }

    const changelog: MappingChangeEntry[] = [];

    // New / changed
    for (const entry of newEntries) {
        const old = oldMap.get(entry.objectId);
        if (!old) {
            changelog.push({
                objectId: entry.objectId,
                objectTitle: entry.objectTitle,
                changeType: 'added',
                currentStatus: entry.status,
                changeSummary: `New: ${entry.objectTitle} — ${entry.status}`,
                addedFiles: [...entry.implFiles, ...entry.testFiles],
                removedFiles: [],
            });
        } else {
            const oldPaths = new Set([...old.implFiles, ...old.testFiles].map(f => f.filePath));
            const newPaths = new Set([...entry.implFiles, ...entry.testFiles].map(f => f.filePath));
            const addedFiles = [...entry.implFiles, ...entry.testFiles].filter(f => !oldPaths.has(f.filePath));
            const removedFiles = [...old.implFiles, ...old.testFiles].filter(f => !newPaths.has(f.filePath));
            const statusChanged = old.status !== entry.status;

            if (addedFiles.length > 0 || removedFiles.length > 0 || statusChanged) {
                changelog.push({
                    objectId: entry.objectId,
                    objectTitle: entry.objectTitle,
                    changeType: 'changed',
                    currentStatus: entry.status,
                    previousStatus: old.status,
                    changeSummary: statusChanged
                        ? `Status: ${old.status} → ${entry.status}`
                        : `Files: +${addedFiles.length} -${removedFiles.length}`,
                    addedFiles,
                    removedFiles,
                });
            } else {
                changelog.push({
                    objectId: entry.objectId,
                    objectTitle: entry.objectTitle,
                    changeType: 'unchanged',
                    currentStatus: entry.status,
                    changeSummary: 'No change',
                    addedFiles: [],
                    removedFiles: [],
                });
            }
        }
        oldMap.delete(entry.objectId);
    }

    // Removed (in old but not in new)
    for (const [id, old] of oldMap) {
        changelog.push({
            objectId: id,
            objectTitle: old.objectTitle,
            changeType: 'removed',
            previousStatus: old.status,
            changeSummary: `Removed: ${old.objectTitle}`,
            addedFiles: [],
            removedFiles: [...old.implFiles, ...old.testFiles],
        });
    }

    return changelog;
}

// ─── Helper: get workspace ───────────────────────────

function getWorkspace(): string {
    const ws = getLastWorkspace();
    if (!ws) throw new Error('No workspace selected');
    return ws;
}

// ─── IPC Handlers ────────────────────────────────────

export function registerScanHandlers(): void {

    /** Full DFS scan of the entire object tree. */
    ipcMain.handle(IPC.SCAN_MAPPING, async (): Promise<FeatureMappingIndex> => {
        const ws = getWorkspace();
        const config = getAiConfig();
        if (!config) throw new Error('AI not configured. Open Settings to set API key.');

        const objectTree = loadAllObjects(ws);
        if (objectTree.length === 0) throw new Error('No objects found. Create some features first.');

        const previousIndex = readMappingIndex(ws);

        // Emit progress to all renderer windows
        const emitProgress = (event: ScanProgressEvent) => {
            for (const win of BrowserWindow.getAllWindows()) {
                win.webContents.send(IPC.SCAN_PROGRESS, event);
            }
        };

        console.log(`[ScanHandlers] Starting DFS scan of ${objectTree.length} root objects`);

        const result = await scanObjectTreeDFS({
            config,
            workspace: ws,
            objectTree,
            onProgress: emitProgress,
            getObjectDetail: async (objectId: string) => {
                const detail = readObjectDetail(ws, objectId);
                if (!detail) return null;
                return {
                    content: detail.content,
                    implRules: detail.implRules,
                    testRules: detail.testRules,
                };
            },
        });

        // Save individual mapping files
        for (const mapping of result.mappings) {
            writeObjectMapping(ws, mapping);
        }

        // Build aggregated index
        const entries = mappingResultsToEntries(result.mappings);
        const changelog = computeChangelog(entries, previousIndex);

        const index: FeatureMappingIndex = {
            version: '2.0.0',
            scannedAt: result.scannedAt,
            tokenUsage: {
                inputTokens: result.totalTokens.input,
                outputTokens: result.totalTokens.output,
                model: config.model,
                timestamp: result.scannedAt,
            },
            entries,
            changelog,
        };

        writeMappingIndex(ws, index);
        console.log(`[ScanHandlers] DFS scan complete — ${result.mappings.length} objects, ${result.totalTokens.input + result.totalTokens.output} tokens`);

        return index;
    });

    /** Load existing mapping index (aggregated from per-object files). */
    ipcMain.handle(IPC.LOAD_MAPPING, async (): Promise<FeatureMappingIndex | null> => {
        const ws = getWorkspace();
        // Try loading aggregated index first
        const index = readMappingIndex(ws);
        if (index) return index;

        // Fall back to reading individual mapping files
        const mappings = readAllObjectMappings(ws);
        if (mappings.length === 0) return null;

        const entries = mappingResultsToEntries(mappings);
        return {
            version: '2.0.0',
            scannedAt: mappings[0]?.scannedAt ?? new Date().toISOString(),
            entries,
            changelog: [],
        };
    });

    /** Scan a single object by ID. */
    ipcMain.handle(IPC.SCAN_SINGLE, async (_event, objectId: string): Promise<ObjectMappingResult> => {
        const ws = getWorkspace();
        const config = getAiConfig();
        if (!config) throw new Error('AI not configured.');

        const objectTree = loadAllObjects(ws);

        // Find the target node and its ancestors
        type NodeWithPath = { node: ObjectTreeNode; path: string[] };
        function findNode(nodes: ObjectTreeNode[], path: string[]): NodeWithPath | null {
            for (const n of nodes) {
                if (n.id === objectId) return { node: n, path };
                if (n.children) {
                    const found = findNode(n.children, [...path, n.title]);
                    if (found) return found;
                }
            }
            return null;
        }

        const found = findNode(objectTree, []);
        if (!found) throw new Error(`Object not found: ${objectId}`);

        // Load child mappings from disk
        const childMappings: ObjectMappingResult[] = [];
        if (found.node.children) {
            for (const child of found.node.children) {
                const existing = readAllObjectMappings(ws).find(m => m.objectId === child.id);
                if (existing) childMappings.push(existing);
            }
        }

        // Load object detail
        const detail = readObjectDetail(ws, objectId);
        const objectDetail = detail ? {
            content: detail.content,
            implRules: detail.implRules,
            testRules: detail.testRules,
        } : undefined;

        const result = await scanSingleObject({
            config,
            workspace: ws,
            objectNode: found.node,
            ancestorPath: found.path,
            childMappings,
            objectDetail,
        });

        // Save individual mapping
        writeObjectMapping(ws, result);

        return result;
    });

} // end registerScanHandlers
