/**
 * Mapping store — read/write per-object mapping files in .specbook/mapping/.
 *
 * Layout:
 *   .specbook/mapping/{uuid}.mapping.json   — per-object scan result
 *   .specbook/mapping.json                 — aggregated index
 */
import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR, MAPPING_DIR, MAPPING_FILE } from '@specbook/shared';
import type { ObjectMappingResult, FeatureMappingIndex, FeatureMappingEntry } from '@specbook/shared';

declare const console: { log(...args: any[]): void; error(...args: any[]): void };

// ─── Per-object mapping files ────────────────────────

function mappingDir(workspace: string): string {
    return path.join(workspace, SPEC_DIR, MAPPING_DIR);
}

function objectMappingPath(workspace: string, objectId: string): string {
    return path.join(mappingDir(workspace), `${objectId}.mapping.json`);
}

function ensureMappingDir(workspace: string): void {
    const dir = mappingDir(workspace);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/** Read a single object's mapping result. */
export function readObjectMapping(workspace: string, objectId: string): ObjectMappingResult | null {
    const filePath = objectMappingPath(workspace, objectId);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err: any) {
        console.error(`[MappingStore] Failed to read ${filePath}: ${err.message}`);
        return null;
    }
}

/** Write a single object's mapping result. */
export function writeObjectMapping(workspace: string, result: ObjectMappingResult): void {
    ensureMappingDir(workspace);
    const filePath = objectMappingPath(workspace, result.objectId);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2) + '\n', 'utf-8');
    console.log(`[MappingStore] Saved ${filePath}`);
}

/** Read all per-object mapping files and return as an array. */
export function readAllObjectMappings(workspace: string): ObjectMappingResult[] {
    const dir = mappingDir(workspace);
    if (!fs.existsSync(dir)) return [];

    const results: ObjectMappingResult[] = [];
    try {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mapping.json'));
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
                results.push(data);
            } catch { /* skip corrupted files */ }
        }
    } catch { /* ignore */ }
    return results;
}

// ─── Aggregated mapping index ────────────────────────

function mappingIndexPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, MAPPING_FILE);
}

/** Read the aggregated mapping index. */
export function readMappingIndex(workspace: string): FeatureMappingIndex | null {
    const filePath = mappingIndexPath(workspace);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
        return null;
    }
}

/** Write the aggregated mapping index. */
export function writeMappingIndex(workspace: string, index: FeatureMappingIndex): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(mappingIndexPath(workspace), JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

/** Convert ObjectMappingResult[] to FeatureMappingEntry[] for the index. */
export function mappingResultsToEntries(results: ObjectMappingResult[]): FeatureMappingEntry[] {
    return results.map(r => ({
        objectId: r.objectId,
        objectTitle: r.objectTitle,
        status: r.status,
        summary: r.summary,
        implFiles: r.implFiles,
        testFiles: r.testFiles,
    }));
}
