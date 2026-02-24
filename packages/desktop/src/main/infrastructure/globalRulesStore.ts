/**
 * Infrastructure layer — Global Rules storage with JSON file.
 * Storage: .specbook/rules.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { SPEC_DIR, GLOBAL_RULES_FILE } from '@specbook/shared';
import type { GlobalRule, GlobalRuleIndex } from '@specbook/shared';

function rulesPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, GLOBAL_RULES_FILE);
}

function ensureDir(workspace: string): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Index operations ───────────────────────────────

export function readRulesIndex(workspace: string): GlobalRuleIndex {
    const fp = rulesPath(workspace);
    if (!fs.existsSync(fp)) {
        return { version: '1.0', rules: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch {
        return { version: '1.0', rules: [] };
    }
}

function writeRulesIndex(workspace: string, index: GlobalRuleIndex): void {
    ensureDir(workspace);
    fs.writeFileSync(rulesPath(workspace), JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

// ─── CRUD operations ────────────────────────────────

export function loadAllRules(workspace: string): GlobalRule[] {
    return readRulesIndex(workspace).rules;
}

export function addRule(workspace: string, rule: GlobalRule): void {
    const index = readRulesIndex(workspace);
    index.rules.push(rule);
    writeRulesIndex(workspace, index);
}

export function updateRule(workspace: string, updated: GlobalRule): void {
    const index = readRulesIndex(workspace);
    const idx = index.rules.findIndex(r => r.id === updated.id);
    if (idx === -1) throw new Error(`Rule ${updated.id} not found.`);
    index.rules[idx] = updated;
    writeRulesIndex(workspace, index);
}

export function deleteRule(workspace: string, id: string): void {
    const index = readRulesIndex(workspace);
    index.rules = index.rules.filter(r => r.id !== id);
    writeRulesIndex(workspace, index);
}
