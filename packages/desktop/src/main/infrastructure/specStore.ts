/**
 * Infrastructure layer — Spec storage with JSON index + Markdown files.
 * Index: .spec/specs.json (all metadata)
 * Content: .spec/specs/{id}.md (pure body text, created on-demand)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
    SPEC_DIR,
    SPEC_INDEX_FILE,
    SPECS_SUBDIR,
    SPEC_FILE_EXT,
    SPEC_ACTION_FILE_EXT,
} from '@specbook/shared';
import type { SpecIndexEntry, SpecSummary, SpecDetail, SpecIndex, SpecTreeNode, SpecAction } from '@specbook/shared';

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
    return path.join(specsSubdir(workspace), `${id}${SPEC_FILE_EXT}`);
}

function ensureDirs(workspace: string): void {
    const dirs = [specDir(workspace), specsSubdir(workspace)];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

// ─── SHA1 content hash ──────────────────────────────

function computeContentHash(filePath: string): string | null {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(content).digest('hex');
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

// ─── Content file operations (pure markdown body) ───

/** Read content from .md file. Returns empty string if file doesn't exist. */
function readContent(workspace: string, id: string): string {
    const filePath = specFilePath(workspace, id);
    if (!fs.existsSync(filePath)) {
        return '';
    }
    return fs.readFileSync(filePath, 'utf-8');
}

/** Write content to .md file. Creates file only if content is non-empty; deletes if empty. */
function writeContent(workspace: string, id: string, content: string): void {
    const filePath = specFilePath(workspace, id);
    if (content.trim().length === 0) {
        // No content → remove .md file if it exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return;
    }
    ensureDirs(workspace);
    fs.writeFileSync(filePath, content, 'utf-8');
}

export function deleteSpecFile(workspace: string, id: string): void {
    const filePath = specFilePath(workspace, id);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}

// ─── Actions file operations ────────────────────────

function actionsFilePath(workspace: string, id: string): string {
    return path.join(specsSubdir(workspace), `${id}${SPEC_ACTION_FILE_EXT}`);
}

export function readActions(workspace: string, id: string): SpecAction[] {
    const filePath = actionsFilePath(workspace, id);
    if (!fs.existsSync(filePath)) return [];
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw) as SpecAction[];
    } catch {
        return [];
    }
}

export function writeActions(workspace: string, id: string, actions: SpecAction[]): void {
    ensureDirs(workspace);
    const filePath = actionsFilePath(workspace, id);
    if (actions.length === 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return;
    }
    fs.writeFileSync(filePath, JSON.stringify(actions, null, 2) + '\n', 'utf-8');
}

export function deleteActionsFile(workspace: string, id: string): void {
    const filePath = actionsFilePath(workspace, id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// ─── Spec detail assembly ───────────────────────────

export function readSpecDetail(workspace: string, id: string): SpecDetail | null {
    const index = readIndex(workspace);
    const entry = index.specs.find(s => s.id === id);
    if (!entry) return null;

    const content = readContent(workspace, id);
    const hasActions = readActions(workspace, id).length > 0;
    return {
        id: entry.id,
        parentId: entry.parentId,
        title: entry.title,
        hasContent: content.trim().length > 0,
        hasActions,
        completed: entry.completed,
        content,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
}

// ─── Index entry builder ────────────────────────────

function buildIndexEntry(workspace: string, detail: SpecDetail): SpecIndexEntry {
    const filePath = specFilePath(workspace, detail.id);
    return {
        id: detail.id,
        title: detail.title,
        parentId: detail.parentId,
        completed: detail.completed,
        contentHash: computeContentHash(filePath),
        createdAt: detail.createdAt,
        updatedAt: detail.updatedAt,
    };
}

// ─── Tree builder ───────────────────────────────────

function buildTree(flatSpecs: SpecSummary[]): SpecTreeNode[] {
    const map = new Map<string, SpecTreeNode>();
    const roots: SpecTreeNode[] = [];

    for (const s of flatSpecs) {
        map.set(s.id, { ...s, children: [] });
    }

    for (const s of flatSpecs) {
        const node = map.get(s.id)!;
        if (s.parentId && map.has(s.parentId)) {
            map.get(s.parentId)!.children!.push(node);
        } else {
            roots.push(node);
        }
    }

    for (const node of map.values()) {
        if (node.children && node.children.length === 0) {
            delete node.children;
        }
    }

    return roots;
}

// ─── Composite operations ───────────────────────────

export function loadAllSpecs(workspace: string): SpecTreeNode[] {
    const index = readIndex(workspace);
    const flatSpecs: SpecSummary[] = index.specs.map(entry => {
        const hasContent = computeContentHash(specFilePath(workspace, entry.id)) !== null;
        const hasActions = readActions(workspace, entry.id).length > 0;
        return {
            id: entry.id,
            parentId: entry.parentId,
            title: entry.title,
            hasContent,
            hasActions,
            completed: entry.completed,
            createdAt: entry.createdAt,
        };
    });
    return buildTree(flatSpecs);
}

export function addSpec(workspace: string, detail: SpecDetail): void {
    // Write .md file only if there's content
    writeContent(workspace, detail.id, detail.content);

    const index = readIndex(workspace);
    index.specs.push(buildIndexEntry(workspace, detail));
    writeIndex(workspace, index);
}

export function updateSpec(workspace: string, detail: SpecDetail): void {
    // Write or remove .md file based on content
    writeContent(workspace, detail.id, detail.content);

    const index = readIndex(workspace);
    const idx = index.specs.findIndex(s => s.id === detail.id);
    if (idx >= 0) {
        index.specs[idx] = buildIndexEntry(workspace, detail);
    }
    writeIndex(workspace, index);
}

/** Delete spec and all its descendants recursively. */
export function deleteSpec(workspace: string, id: string): void {
    const index = readIndex(workspace);

    const idsToDelete = new Set<string>();
    const collectDescendants = (parentId: string) => {
        idsToDelete.add(parentId);
        for (const s of index.specs) {
            if (s.parentId === parentId && !idsToDelete.has(s.id)) {
                collectDescendants(s.id);
            }
        }
    };
    collectDescendants(id);

    index.specs = index.specs.filter(s => !idsToDelete.has(s.id));
    writeIndex(workspace, index);

    for (const delId of idsToDelete) {
        deleteSpecFile(workspace, delId);
    }
}

/** Move spec to a new parent (or root if newParentId is null). */
export function moveSpec(workspace: string, id: string, newParentId: string | null): void {
    const index = readIndex(workspace);

    // Prevent circular
    if (newParentId) {
        const isDescendant = (checkId: string, ancestorId: string): boolean => {
            const entry = index.specs.find(s => s.id === checkId);
            if (!entry?.parentId) return false;
            if (entry.parentId === ancestorId) return true;
            return isDescendant(entry.parentId, ancestorId);
        };
        if (newParentId === id || isDescendant(newParentId, id)) {
            throw new Error('Cannot move a spec into its own descendant.');
        }
    }

    const entry = index.specs.find(s => s.id === id);
    if (!entry) throw new Error(`Spec ${id} not found.`);
    entry.parentId = newParentId;
    entry.updatedAt = new Date().toISOString();

    // Recompute hash (content unchanged, but let's be consistent)
    const filePath = specFilePath(workspace, id);
    entry.contentHash = computeContentHash(filePath);

    writeIndex(workspace, index);
}
