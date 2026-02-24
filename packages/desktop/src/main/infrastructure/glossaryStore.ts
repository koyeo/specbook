/**
 * Infrastructure layer — Glossary storage with JSON file.
 * Storage: .specbook/glossary.json (all term data)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    SPEC_DIR,
    GLOSSARY_FILE,
} from '@specbook/shared';
import type { GlossaryTerm, GlossaryIndex } from '@specbook/shared';

function glossaryPath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, GLOSSARY_FILE);
}

function ensureDir(workspace: string): void {
    const dir = path.join(workspace, SPEC_DIR);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Index operations ───────────────────────────────

export function readGlossary(workspace: string): GlossaryIndex {
    const fp = glossaryPath(workspace);
    if (!fs.existsSync(fp)) {
        return { version: '1.0', terms: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch {
        return { version: '1.0', terms: [] };
    }
}

function writeGlossary(workspace: string, index: GlossaryIndex): void {
    ensureDir(workspace);
    fs.writeFileSync(glossaryPath(workspace), JSON.stringify(index, null, 2) + '\n', 'utf-8');
}

// ─── CRUD operations ────────────────────────────────

export function loadAllTerms(workspace: string): GlossaryTerm[] {
    return readGlossary(workspace).terms;
}

export function addTerm(workspace: string, term: GlossaryTerm): void {
    const index = readGlossary(workspace);
    index.terms.push(term);
    writeGlossary(workspace, index);
}

export function updateTerm(workspace: string, updated: GlossaryTerm): void {
    const index = readGlossary(workspace);
    const idx = index.terms.findIndex(t => t.id === updated.id);
    if (idx === -1) throw new Error(`Term ${updated.id} not found.`);
    index.terms[idx] = updated;
    writeGlossary(workspace, index);
}

export function deleteTerm(workspace: string, id: string): void {
    const index = readGlossary(workspace);
    index.terms = index.terms.filter(t => t.id !== id);
    writeGlossary(workspace, index);
}
