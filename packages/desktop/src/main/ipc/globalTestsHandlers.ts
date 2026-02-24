/**
 * IPC handlers for Global Tests CRUD operations.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { AddGlobalTestPayload, UpdateGlobalTestPayload } from '@specbook/shared';
import type { GlobalTest } from '@specbook/shared';
import * as globalTestsStore from '../infrastructure/globalTestsStore';
import { getWorkspace } from './specHandlers';

function requireWorkspace(): string {
    const ws = getWorkspace();
    if (!ws) throw new Error('No workspace selected. Please open a folder first.');
    return ws;
}

export function registerGlobalTestsHandlers(): void {
    ipcMain.handle(IPC.GLOBAL_TESTS_LOAD, () => {
        const ws = requireWorkspace();
        return globalTestsStore.loadAllTests(ws);
    });

    ipcMain.handle(IPC.GLOBAL_TESTS_ADD, (_event, payload: AddGlobalTestPayload) => {
        const ws = requireWorkspace();
        const now = new Date().toISOString();
        const test: GlobalTest = {
            id: generateId(),
            title: payload.title.trim(),
            description: payload.description?.trim() ?? '',
            rules: [],
            locations: [],
            createdAt: now,
            updatedAt: now,
        };
        globalTestsStore.addTest(ws, test);
        return test;
    });

    ipcMain.handle(IPC.GLOBAL_TESTS_UPDATE, (_event, payload: UpdateGlobalTestPayload) => {
        const ws = requireWorkspace();
        const tests = globalTestsStore.loadAllTests(ws);
        const existing = tests.find(t => t.id === payload.id);
        if (!existing) throw new Error(`Test ${payload.id} not found.`);

        const updated: GlobalTest = {
            ...existing,
            title: payload.title?.trim() ?? existing.title,
            description: payload.description?.trim() ?? existing.description,
            rules: payload.rules ?? existing.rules,
            locations: payload.locations ?? existing.locations,
            updatedAt: new Date().toISOString(),
        };
        globalTestsStore.updateTest(ws, updated);
        return updated;
    });

    ipcMain.handle(IPC.GLOBAL_TESTS_DELETE, (_event, id: string) => {
        const ws = requireWorkspace();
        globalTestsStore.deleteTest(ws, id);
    });
}
