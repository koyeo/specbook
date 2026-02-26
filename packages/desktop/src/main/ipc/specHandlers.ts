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
import {
    getWorkspaceForSender,
    setWorkspaceForSender,
    requireWorkspaceForSender,
} from '../windowManager';
import { getLastWorkspace, getRecentWorkspaces, removeRecentWorkspace } from '../infrastructure/appConfig';

export function registerIpcHandlers(): void {
    // ─── Workspace ──────────────────────────────────

    ipcMain.handle(IPC.SELECT_WORKSPACE, async (event) => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Workspace Folder',
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        const workspace = result.filePaths[0];
        setWorkspaceForSender(event.sender.id, workspace);
        return workspace;
    });

    ipcMain.handle(IPC.SET_WORKSPACE, (event, workspace: string) => {
        setWorkspaceForSender(event.sender.id, workspace);
    });

    ipcMain.handle(IPC.GET_WORKSPACE, (event) => {
        return getWorkspaceForSender(event.sender.id);
    });

    ipcMain.handle(IPC.RECENT_WORKSPACES, () => {
        return getRecentWorkspaces();
    });

    ipcMain.handle(IPC.REMOVE_RECENT_WORKSPACE, (_event, workspace: string) => {
        removeRecentWorkspace(workspace);
    });

    // ─── Objects CRUD ───────────────────────────────

    ipcMain.handle(IPC.LOAD_OBJECTS, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return objectStore.loadAllObjects(ws);
    });

    ipcMain.handle(IPC.ADD_OBJECT, (event, payload: AddObjectPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);

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
            hasImpls: false,
            hasTests: false,
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

    ipcMain.handle(IPC.UPDATE_OBJECT, (event, payload: UpdateObjectPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);

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
            implLocations: payload.implLocations ?? existing.implLocations,
            implRequirements: payload.implRequirements ?? existing.implRequirements,
            testLocations: payload.testLocations ?? existing.testLocations,
            testRequirements: payload.testRequirements ?? existing.testRequirements,
            updatedAt: new Date().toISOString(),
        };
        updated.hasContent = updated.content.length > 0;

        // Infrastructure: persist
        objectStore.updateObject(ws, updated);

        return updated;
    });

    ipcMain.handle(IPC.DELETE_OBJECT, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        objectStore.deleteObject(ws, id);
        objectStore.deleteActionsFile(ws, id);
    });

    ipcMain.handle(IPC.GET_OBJECT, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return objectStore.readObjectDetail(ws, id);
    });

    ipcMain.handle(IPC.MOVE_OBJECT, (event, payload: MoveObjectPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        objectStore.moveObject(ws, payload.id, payload.newParentId);
    });

    // ─── Actions ─────────────────────────────────────

    ipcMain.handle(IPC.LOAD_ACTIONS, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return objectStore.readActions(ws, id);
    });

    ipcMain.handle(IPC.SAVE_ACTIONS, (event, id: string, actions: import('@specbook/shared').ObjectAction[]) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        objectStore.writeActions(ws, id, actions);
    });

    // ─── Impl/Test Mappings ─────────────────────────

    ipcMain.handle(IPC.LOAD_IMPLS, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return objectStore.readImpls(ws, id);
    });

    ipcMain.handle(IPC.SAVE_IMPLS, (event, id: string, files: import('@specbook/shared').RelatedFile[], summary?: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        objectStore.writeImpls(ws, id, files, summary);
    });

    ipcMain.handle(IPC.LOAD_TESTS, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return objectStore.readTests(ws, id);
    });

    ipcMain.handle(IPC.SAVE_TESTS, (event, id: string, files: import('@specbook/shared').RelatedFile[]) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        objectStore.writeTests(ws, id, files);
    });

    // ─── Open in Editor ─────────────────────────────

    ipcMain.handle(IPC.OPEN_IN_EDITOR, async (event, filePath: string, line?: number) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const path = await import('path');
        const { exec } = await import('child_process');

        // Resolve relative paths against workspace
        const absPath = path.isAbsolute(filePath) ? filePath : path.join(ws, filePath);

        // Build editor command: antigravity --goto file:line
        const editor = process.env.SPECBOOK_EDITOR || 'antigravity';
        const target = line ? `${absPath}:${line}` : absPath;
        const cmd = `${editor} --goto "${target}"`;

        return new Promise<void>((resolve, reject) => {
            exec(cmd, (error) => {
                if (error) {
                    console.error('[openInEditor] Failed:', cmd, error.message);
                    reject(new Error(`Failed to open editor: ${error.message}`));
                } else {
                    resolve();
                }
            });
        });
    });

    ipcMain.handle(IPC.EXPORT_MARKDOWN, async (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
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
