/**
 * Infrastructure layer — Issues storage with JSON file.
 * Storage: .specbook/issues.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR, ISSUES_FILE } from '@specbook/shared';
import type { Issue, IssueIndex } from '@specbook/shared';

function issuesPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, ISSUES_FILE);
}

function ensureDir(workspace: string): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Index operations ───────────────────────────────

export function readIssuesIndex(workspace: string): IssueIndex {
    const fp = issuesPath(workspace);
    if (!fs.existsSync(fp)) {
        return { version: '1.0', issues: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch {
        return { version: '1.0', issues: [] };
    }
}

function writeIssuesIndex(workspace: string, index: IssueIndex): void {
    ensureDir(workspace);
    fs.writeFileSync(issuesPath(workspace), JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

// ─── CRUD operations ────────────────────────────────

export function loadAllIssues(workspace: string): Issue[] {
    return readIssuesIndex(workspace).issues;
}

export function addIssue(workspace: string, issue: Issue): void {
    const index = readIssuesIndex(workspace);
    index.issues.push(issue);
    writeIssuesIndex(workspace, index);
}

export function updateIssue(workspace: string, updated: Issue): void {
    const index = readIssuesIndex(workspace);
    const idx = index.issues.findIndex(i => i.id === updated.id);
    if (idx === -1) throw new Error(`Issue ${updated.id} not found.`);
    index.issues[idx] = updated;
    writeIssuesIndex(workspace, index);
}

export function deleteIssue(workspace: string, id: string): void {
    const index = readIssuesIndex(workspace);
    index.issues = index.issues.filter(i => i.id !== id);
    writeIssuesIndex(workspace, index);
}
