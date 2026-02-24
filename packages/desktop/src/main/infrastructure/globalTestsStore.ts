/**
 * Infrastructure layer — Global Tests storage with JSON file.
 * Storage: .specbook/tests.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR, GLOBAL_TESTS_FILE } from '@specbook/shared';
import type { GlobalTest, GlobalTestIndex } from '@specbook/shared';

function testsPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, GLOBAL_TESTS_FILE);
}

function ensureDir(workspace: string): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Index operations ───────────────────────────────

export function readTestsIndex(workspace: string): GlobalTestIndex {
    const fp = testsPath(workspace);
    if (!fs.existsSync(fp)) {
        return { version: '1.0', tests: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch {
        return { version: '1.0', tests: [] };
    }
}

function writeTestsIndex(workspace: string, index: GlobalTestIndex): void {
    ensureDir(workspace);
    fs.writeFileSync(testsPath(workspace), JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

// ─── CRUD operations ────────────────────────────────

export function loadAllTests(workspace: string): GlobalTest[] {
    return readTestsIndex(workspace).tests;
}

export function addTest(workspace: string, test: GlobalTest): void {
    const index = readTestsIndex(workspace);
    index.tests.push(test);
    writeTestsIndex(workspace, index);
}

export function updateTest(workspace: string, updated: GlobalTest): void {
    const index = readTestsIndex(workspace);
    const idx = index.tests.findIndex(t => t.id === updated.id);
    if (idx === -1) throw new Error(`Test ${updated.id} not found.`);
    index.tests[idx] = updated;
    writeTestsIndex(workspace, index);
}

export function deleteTest(workspace: string, id: string): void {
    const index = readTestsIndex(workspace);
    index.tests = index.tests.filter(t => t.id !== id);
    writeTestsIndex(workspace, index);
}
