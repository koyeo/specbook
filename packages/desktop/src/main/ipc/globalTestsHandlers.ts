/**
 * IPC handlers for Global Tests CRUD operations.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { AddGlobalTestPayload, UpdateGlobalTestPayload } from '@specbook/shared';
import type { GlobalTest } from '@specbook/shared';
import * as globalTestsStore from '../infrastructure/globalTestsStore';
import { requireWorkspaceForSender } from '../windowManager';

export function registerGlobalTestsHandlers(): void {
    ipcMain.handle(IPC.GLOBAL_TESTS_LOAD, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return globalTestsStore.loadAllTests(ws);
    });

    ipcMain.handle(IPC.GLOBAL_TESTS_ADD, (event, payload: AddGlobalTestPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
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

    ipcMain.handle(IPC.GLOBAL_TESTS_UPDATE, (event, payload: UpdateGlobalTestPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
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

    ipcMain.handle(IPC.GLOBAL_TESTS_DELETE, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        globalTestsStore.deleteTest(ws, id);
    });
}
