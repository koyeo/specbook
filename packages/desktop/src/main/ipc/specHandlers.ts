/**
 * IPC handlers — Application layer.
 * Orchestrates Domain (validation) + Infrastructure (specStore).
 */
import { ipcMain, dialog, BrowserWindow } from 'electron';
import {
    IPC,
    validateDescription,
    generateId,
} from '@specbook/shared';
import type {
    AddSpecPayload,
    UpdateSpecPayload,
    SpecDetail,
} from '@specbook/shared';
import * as specStore from '../infrastructure/specStore';

let currentWorkspace: string | null = null;

export function getWorkspace(): string | null {
    return currentWorkspace;
}

export function setWorkspace(workspace: string): void {
    currentWorkspace = workspace;
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
        return currentWorkspace;
    });

    ipcMain.handle(IPC.GET_WORKSPACE, () => {
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
        const validation = validateDescription(payload.description);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Domain: generate ID + timestamps
        const now = new Date().toISOString();
        const id = generateId();

        const detail: SpecDetail = {
            id,
            description: payload.description.trim(),
            group: payload.group?.trim() || 'Ungrouped',
            content: payload.content?.trim() || '',
            createdAt: now,
            updatedAt: now,
        };

        const summary = {
            id: detail.id,
            description: detail.description,
            group: detail.group,
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
            description: payload.description?.trim() ?? existing.description,
            group: payload.group?.trim() ?? existing.group,
            content: payload.content?.trim() ?? existing.content,
            updatedAt: new Date().toISOString(),
        };

        const summary = {
            id: updated.id,
            description: updated.description,
            group: updated.group,
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
}
