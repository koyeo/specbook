/**
 * IPC handlers — Application layer.
 * Orchestrates Domain (validation) + Infrastructure (objectStore).
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
    IPC,
    validateTitle,
    generateId,
} from '@specbook/shared';
import type {
    AddObjectPayload,
    UpdateObjectPayload,
    MoveObjectPayload,
    ObjectDetail,
} from '@specbook/shared';
import * as objectStore from '../infrastructure/specStore';
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

    // ─── Objects CRUD ───────────────────────────────

    ipcMain.handle(IPC.LOAD_OBJECTS, () => {
        const ws = requireWorkspace();
        return objectStore.loadAllObjects(ws);
    });

    ipcMain.handle(IPC.ADD_OBJECT, (_event, payload: AddObjectPayload) => {
        const ws = requireWorkspace();

        // Domain: validate
        const validation = validateTitle(payload.title);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Domain: generate ID + timestamps
        const now = new Date().toISOString();
        const id = generateId();

        const detail: ObjectDetail = {
            id,
            parentId: payload.parentId ?? null,
            title: payload.title.trim(),
            hasContent: !!(payload.content?.trim()),
            hasActions: false,
            isState: false,
            completed: false,
            content: payload.content?.trim() || '',
            createdAt: now,
            updatedAt: now,
        };

        // Infrastructure: persist
        objectStore.addObject(ws, detail);

        return detail;
    });

    ipcMain.handle(IPC.UPDATE_OBJECT, (_event, payload: UpdateObjectPayload) => {
        const ws = requireWorkspace();

        const existing = objectStore.readObjectDetail(ws, payload.id);
        if (!existing) {
            throw new Error(`Object ${payload.id} not found.`);
        }

        const updated: ObjectDetail = {
            ...existing,
            title: payload.title?.trim() ?? existing.title,
            content: payload.content?.trim() ?? existing.content,
            completed: payload.completed ?? existing.completed ?? false,
            isState: payload.isState ?? existing.isState ?? false,
            updatedAt: new Date().toISOString(),
        };
        updated.hasContent = updated.content.length > 0;

        // Infrastructure: persist
        objectStore.updateObject(ws, updated);

        return updated;
    });

    ipcMain.handle(IPC.DELETE_OBJECT, (_event, id: string) => {
        const ws = requireWorkspace();
        objectStore.deleteObject(ws, id);
        objectStore.deleteActionsFile(ws, id);
    });

    ipcMain.handle(IPC.GET_OBJECT, (_event, id: string) => {
        const ws = requireWorkspace();
        return objectStore.readObjectDetail(ws, id);
    });

    ipcMain.handle(IPC.MOVE_OBJECT, (_event, payload: MoveObjectPayload) => {
        const ws = requireWorkspace();
        objectStore.moveObject(ws, payload.id, payload.newParentId);
    });

    // ─── Actions ─────────────────────────────────────

    ipcMain.handle(IPC.LOAD_ACTIONS, (_event, id: string) => {
        const ws = requireWorkspace();
        return objectStore.readActions(ws, id);
    });

    ipcMain.handle(IPC.SAVE_ACTIONS, (_event, id: string, actions: import('@specbook/shared').ObjectAction[]) => {
        const ws = requireWorkspace();
        objectStore.writeActions(ws, id, actions);
    });

    ipcMain.handle(IPC.EXPORT_MARKDOWN, async () => {
        const ws = requireWorkspace();
        const tree = objectStore.loadAllObjects(ws);

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
            title: 'Export Objects as Markdown',
            defaultPath: 'objects.md',
            filters: [{ name: 'Markdown', extensions: ['md'] }],
        });

        if (result.canceled || !result.filePath) return false;

        const fs = await import('fs');
        fs.writeFileSync(result.filePath, markdown, 'utf-8');
        return true;
    });
}
