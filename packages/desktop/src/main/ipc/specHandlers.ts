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
            hasContent: false,
            completed: false,
            content: payload.content?.trim() || '',
            createdAt: now,
            updatedAt: now,
        };

        const summary = {
            id: detail.id,
            parentId: detail.parentId,
            title: detail.title,
            hasContent: detail.content.length > 0,
            completed: detail.completed,
            createdAt: detail.createdAt,
        };

        // Infrastructure: persist
        specStore.addSpec(ws, summary, detail);

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

        const summary = {
            id: updated.id,
            parentId: updated.parentId,
            title: updated.title,
            hasContent: updated.content.length > 0,
            completed: updated.completed ?? false,
            createdAt: updated.createdAt,
        };

        specStore.updateSpec(ws, summary, updated);

        return updated;
    });

    ipcMain.handle(IPC.DELETE_SPEC, (_event, id: string) => {
        const ws = requireWorkspace();
        specStore.deleteSpec(ws, id);
    });

    ipcMain.handle(IPC.GET_SPEC, (_event, id: string) => {
        const ws = requireWorkspace();
        return specStore.readSpecDetail(ws, id);
    });

    ipcMain.handle(IPC.MOVE_SPEC, (_event, payload: MoveSpecPayload) => {
        const ws = requireWorkspace();
        specStore.moveSpec(ws, payload.id, payload.newParentId);
    });
}
