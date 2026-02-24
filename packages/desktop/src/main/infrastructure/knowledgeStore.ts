/**
 * Knowledge store — file-based persistence for project knowledge entries.
 * Stores in {workspace}/.specbook/knowledge.json
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    SPEC_DIR,
    KNOWLEDGE_FILE,
} from '@specbook/shared';
import type {
    KnowledgeEntry, KnowledgeIndex,
} from '@specbook/shared';

function knowledgePath(workspace: string): string {
    return path.join(workspace, SPEC_DIR, KNOWLEDGE_FILE);
}

export function readKnowledge(workspace: string): KnowledgeIndex {
    const filePath = knowledgePath(workspace);
    if (!fs.existsSync(filePath)) {
        return { version: '1.0', entries: [] };
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as KnowledgeIndex;
    } catch {
        return { version: '1.0', entries: [] };
    }
}

function writeKnowledge(workspace: string, index: KnowledgeIndex): void {
    const filePath = knowledgePath(workspace);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

export function loadEntries(workspace: string): KnowledgeEntry[] {
    return readKnowledge(workspace).entries;
}

export function addEntry(workspace: string, entry: KnowledgeEntry): void {
    const index = readKnowledge(workspace);
    index.entries.push(entry);
    writeKnowledge(workspace, index);
}

export function updateEntry(workspace: string, id: string, updates: Partial<KnowledgeEntry>): KnowledgeEntry {
    const index = readKnowledge(workspace);
    const entry = index.entries.find((e: KnowledgeEntry) => e.id === id);
    if (!entry) throw new Error(`Knowledge entry not found: ${id}`);

    if (updates.title !== undefined) entry.title = updates.title;
    if (updates.content !== undefined) entry.content = updates.content;
    if (updates.tags !== undefined) entry.tags = updates.tags;
    entry.updatedAt = new Date().toISOString();

    writeKnowledge(workspace, index);
    return entry;
}

export function deleteEntry(workspace: string, id: string): void {
    const index = readKnowledge(workspace);
    index.entries = index.entries.filter((e: KnowledgeEntry) => e.id !== id);
    writeKnowledge(workspace, index);
}
