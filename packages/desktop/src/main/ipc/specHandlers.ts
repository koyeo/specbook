/**
 * IPC handlers — Application layer.
 * Orchestrates Domain (validation) + Infrastructure (specStore).
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
    IPC,
    validateTitle,
    generateId,
} from '@specbook/shared';
import type {
    AddSpecPayload,
    UpdateSpecPayload,
    MoveSpecPayload,
    SpecDetail,
} from '@specbook/shared';
import * as specStore from '../infrastructure/specStore';
import { getLastWorkspace, saveLastWorkspace } from '../infrastructure/appConfig';

let currentWorkspace: string | null = null;

export function getWorkspace(): string | null {
    return currentWorkspace;
}

export function setWorkspace(workspace: string): void {
    currentWorkspace = workspace;
    saveLastWorkspace(workspace);
}

function requireWorkspace(): string {
    if (!currentWorkspace) {
        throw new Error('No workspace selected. Please open a folder first.');
    }
    return currentWorkspace;
}

export function registerIpcHandlers(): void {
    // ─── Workspace ──────────────────────────────────

    ipcMain.handle(IPC.SELECT_WORKSPACE, async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Workspace Folder',
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        currentWorkspace = result.filePaths[0];
        saveLastWorkspace(currentWorkspace);
        return currentWorkspace;
    });

    ipcMain.handle(IPC.GET_WORKSPACE, () => {
        // Auto-restore last workspace if none set
        if (!currentWorkspace) {
            currentWorkspace = getLastWorkspace();
        }
        return currentWorkspace;
    });

    // ─── Specs CRUD ─────────────────────────────────

    ipcMain.handle(IPC.LOAD_SPECS, () => {
        const ws = requireWorkspace();
        return specStore.loadAllSpecs(ws);
    });

    ipcMain.handle(IPC.ADD_SPEC, (_event, payload: AddSpecPayload) => {
        const ws = requireWorkspace();

        // Domain: validate
        const validation = validateTitle(payload.title);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Domain: generate ID + timestamps
        const now = new Date().toISOString();
        const id = generateId();

        const detail: SpecDetail = {
            id,
            parentId: payload.parentId ?? null,
            title: payload.title.trim(),
            hasContent: !!(payload.content?.trim()),
            hasActions: false,
            completed: false,
            content: payload.content?.trim() || '',
            createdAt: now,
            updatedAt: now,
        };

        // Infrastructure: persist (specStore handles index entry building)
        specStore.addSpec(ws, detail);

        return detail;
    });

    ipcMain.handle(IPC.UPDATE_SPEC, (_event, payload: UpdateSpecPayload) => {
        const ws = requireWorkspace();

        const existing = specStore.readSpecDetail(ws, payload.id);
        if (!existing) {
            throw new Error(`Spec ${payload.id} not found.`);
        }

        const updated: SpecDetail = {
            ...existing,
            title: payload.title?.trim() ?? existing.title,
            content: payload.content?.trim() ?? existing.content,
            completed: payload.completed ?? existing.completed ?? false,
            updatedAt: new Date().toISOString(),
        };
        updated.hasContent = updated.content.length > 0;

        // Infrastructure: persist (specStore handles index entry building)
        specStore.updateSpec(ws, updated);

        return updated;
    });

    ipcMain.handle(IPC.DELETE_SPEC, (_event, id: string) => {
        const ws = requireWorkspace();
        specStore.deleteSpec(ws, id);
        specStore.deleteActionsFile(ws, id);
    });

    ipcMain.handle(IPC.GET_SPEC, (_event, id: string) => {
        const ws = requireWorkspace();
        return specStore.readSpecDetail(ws, id);
    });

    ipcMain.handle(IPC.MOVE_SPEC, (_event, payload: MoveSpecPayload) => {
        const ws = requireWorkspace();
        specStore.moveSpec(ws, payload.id, payload.newParentId);
    });

    // ─── Actions ─────────────────────────────────────

    ipcMain.handle(IPC.LOAD_ACTIONS, (_event, id: string) => {
        const ws = requireWorkspace();
        return specStore.readActions(ws, id);
    });

    ipcMain.handle(IPC.SAVE_ACTIONS, (_event, id: string, actions: import('@specbook/shared').SpecAction[]) => {
        const ws = requireWorkspace();
        specStore.writeActions(ws, id, actions);
    });

    ipcMain.handle(IPC.EXPORT_MARKDOWN, async () => {
        const ws = requireWorkspace();
        const tree = specStore.loadAllSpecs(ws);

        // Build numbered outline from tree
        const lines: string[] = [];
        const renderChildren = (nodes: any[], prefix: string, depth: number) => {
            nodes.forEach((node: any, idx: number) => {
                const num = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
                const indent = '    '.repeat(depth);
                lines.push(`${indent}${num} ${node.title}`);
                if (node.children) {
                    renderChildren(node.children, num, depth + 1);
                }
            });
        };
        renderChildren(tree, '', 0);

        const markdown = lines.join('\n');

        // Save dialog
        const win = BrowserWindow.getFocusedWindow();
        const result = await dialog.showSaveDialog(win!, {
            title: 'Export Specs as Markdown',
            defaultPath: 'specs.md',
            filters: [{ name: 'Markdown', extensions: ['md'] }],
        });

        if (result.canceled || !result.filePath) return false;

        const fs = await import('fs');
        fs.writeFileSync(result.filePath, markdown, 'utf-8');
        return true;
    });
}

