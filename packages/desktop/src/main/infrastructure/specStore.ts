/**
 * Infrastructure layer — JSON file I/O for spec storage.
 * Handles .spec/specs.json (index) + .spec/specs/{id}.spec.json (details).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    SPEC_DIR,
    SPEC_INDEX_FILE,
    SPECS_SUBDIR,
} from '@specbook/shared';
import type { SpecSummary, SpecDetail, SpecIndex } from '@specbook/shared';

function specDir(workspace: string): string {
    return path.join(workspace, SPEC_DIR);
}

function indexPath(workspace: string): string {
    return path.join(specDir(workspace), SPEC_INDEX_FILE);
}

function specsSubdir(workspace: string): string {
    return path.join(specDir(workspace), SPECS_SUBDIR);
}

function specFilePath(workspace: string, id: string): string {
    return path.join(specsSubdir(workspace), `${id}.spec.json`);
}

function ensureDirs(workspace: string): void {
    const dirs = [specDir(workspace), specsSubdir(workspace)];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// ─── Index operations ───────────────────────────────

export function readIndex(workspace: string): SpecIndex {
    const filePath = indexPath(workspace);
    if (!fs.existsSync(filePath)) {
        return { version: '1.0', specs: [] };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as SpecIndex;
}

export function writeIndex(workspace: string, index: SpecIndex): void {
    ensureDirs(workspace);
    fs.writeFileSync(indexPath(workspace), JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

// ─── Spec detail operations ─────────────────────────

export function readSpecDetail(workspace: string, id: string): SpecDetail | null {
    const filePath = specFilePath(workspace, id);
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as SpecDetail;
}

export function writeSpecDetail(workspace: string, detail: SpecDetail): void {
    ensureDirs(workspace);
    fs.writeFileSync(specFilePath(workspace, detail.id), JSON.stringify(detail, null, 2) + '\n', 'utf-8');
}

export function deleteSpecFile(workspace: string, id: string): void {
    const filePath = specFilePath(workspace, id);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

// ─── Composite operations ───────────────────────────

export function loadAllSpecs(workspace: string): SpecSummary[] {
    return readIndex(workspace).specs;
}

export function addSpec(
    workspace: string,
    summary: SpecSummary,
    detail: SpecDetail,
): void {
    const index = readIndex(workspace);
    index.specs.push(summary);
    writeIndex(workspace, index);
    writeSpecDetail(workspace, detail);
}

export function updateSpec(
    workspace: string,
    summary: SpecSummary,
    detail: SpecDetail,
): void {
    const index = readIndex(workspace);
    const idx = index.specs.findIndex(s => s.id === summary.id);
    if (idx >= 0) {
        index.specs[idx] = summary;
    }
    writeIndex(workspace, index);
    writeSpecDetail(workspace, detail);
}

export function deleteSpec(workspace: string, id: string): void {
    const index = readIndex(workspace);
    index.specs = index.specs.filter(s => s.id !== id);
    writeIndex(workspace, index);
    deleteSpecFile(workspace, id);
}
