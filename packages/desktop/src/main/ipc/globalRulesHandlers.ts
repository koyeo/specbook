/**
 * IPC handlers for Global Rules CRUD operations.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { AddGlobalRulePayload, UpdateGlobalRulePayload } from '@specbook/shared';
import type { GlobalRule } from '@specbook/shared';
import * as globalRulesStore from '../infrastructure/globalRulesStore';
import { getWorkspace } from './specHandlers';

function requireWorkspace(): string {
    const ws = getWorkspace();
    if (!ws) throw new Error('No workspace selected. Please open a folder first.');
    return ws;
}

export function registerGlobalRulesHandlers(): void {
    ipcMain.handle(IPC.GLOBAL_RULES_LOAD, () => {
        const ws = requireWorkspace();
        return globalRulesStore.loadAllRules(ws);
    });

    ipcMain.handle(IPC.GLOBAL_RULES_ADD, (_event, payload: AddGlobalRulePayload) => {
        const ws = requireWorkspace();
        const now = new Date().toISOString();
        const rule: GlobalRule = {
            id: generateId(),
            name: payload.name.trim(),
            text: payload.text.trim(),
            category: payload.category,
            createdAt: now,
            updatedAt: now,
        };
        globalRulesStore.addRule(ws, rule);
        return rule;
    });

    ipcMain.handle(IPC.GLOBAL_RULES_UPDATE, (_event, payload: UpdateGlobalRulePayload) => {
        const ws = requireWorkspace();
        const rules = globalRulesStore.loadAllRules(ws);
        const existing = rules.find(r => r.id === payload.id);
        if (!existing) throw new Error(`Rule ${payload.id} not found.`);

        const updated: GlobalRule = {
            ...existing,
            name: payload.name?.trim() ?? existing.name,
            text: payload.text?.trim() ?? existing.text,
            category: payload.category ?? existing.category,
            updatedAt: new Date().toISOString(),
        };
        globalRulesStore.updateRule(ws, updated);
        return updated;
    });

    ipcMain.handle(IPC.GLOBAL_RULES_DELETE, (_event, id: string) => {
        const ws = requireWorkspace();
        globalRulesStore.deleteRule(ws, id);
    });
}
