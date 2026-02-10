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
import type { SpecSummary, SpecDetail, SpecIndex, SpecTreeNode } from '@specbook/shared';

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

// ─── Tree builder ───────────────────────────────────

function buildTree(flatSpecs: SpecSummary[]): SpecTreeNode[] {
    const map = new Map<string, SpecTreeNode>();
    const roots: SpecTreeNode[] = [];

    // Create nodes
    for (const s of flatSpecs) {
        map.set(s.id, { ...s, children: [] });
    }

    // Build hierarchy
    for (const s of flatSpecs) {
        const node = map.get(s.id)!;
        if (s.parentId && map.has(s.parentId)) {
            map.get(s.parentId)!.children!.push(node);
        } else {
            roots.push(node);
        }
    }

    // Clean up empty children arrays (antd uses undefined to hide expand arrow)
    for (const node of map.values()) {
        if (node.children && node.children.length === 0) {
            delete node.children;
        }
    }

    return roots;
}

// ─── Composite operations ───────────────────────────

export function loadAllSpecs(workspace: string): SpecTreeNode[] {
    const flatSpecs = readIndex(workspace).specs.map(s => {
        const detail = readSpecDetail(workspace, s.id);
        return {
            ...s,
            parentId: s.parentId ?? null,
            hasContent: !!(detail && detail.content && detail.content.trim().length > 0),
        };
    });
    return buildTree(flatSpecs);
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

/** Delete spec and all its descendants recursively. */
export function deleteSpec(workspace: string, id: string): void {
    const index = readIndex(workspace);

    // Find all descendant IDs
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

    // Remove from index
    index.specs = index.specs.filter(s => !idsToDelete.has(s.id));
    writeIndex(workspace, index);

    // Remove files
    for (const delId of idsToDelete) {
        deleteSpecFile(workspace, delId);
    }
}

/** Move spec to a new parent (or root if newParentId is null). */
export function moveSpec(workspace: string, id: string, newParentId: string | null): void {
    const index = readIndex(workspace);

    // Prevent circular: newParentId must not be a descendant of id
    if (newParentId) {
        const isDescendant = (checkId: string, ancestorId: string): boolean => {
            for (const s of index.specs) {
                if (s.id === checkId) {
                    if (s.parentId === ancestorId) return true;
                    if (s.parentId) return isDescendant(s.parentId, ancestorId);
                    return false;
                }
            }
            return false;
        };
        if (newParentId === id || isDescendant(newParentId, id)) {
            throw new Error('Cannot move a spec into its own descendant.');
        }
    }

    // Update index
    const spec = index.specs.find(s => s.id === id);
    if (!spec) throw new Error(`Spec ${id} not found.`);
    spec.parentId = newParentId;

    // If moving to a parent, inherit the parent's context
    if (newParentId) {
        const parent = index.specs.find(s => s.id === newParentId);
        if (parent) {
            spec.context = parent.context;
        }
    }

    writeIndex(workspace, index);

    // Update detail file
    const detail = readSpecDetail(workspace, id);
    if (detail) {
        detail.parentId = newParentId;
        if (newParentId) {
            const parent = index.specs.find(s => s.id === newParentId);
            if (parent) detail.context = parent.context;
        }
        detail.updatedAt = new Date().toISOString();
        writeSpecDetail(workspace, detail);
    }
}
