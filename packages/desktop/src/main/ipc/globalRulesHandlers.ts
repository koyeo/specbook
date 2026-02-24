/**
 * IPC handlers for Global Rules CRUD operations.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { AddGlobalRulePayload, UpdateGlobalRulePayload } from '@specbook/shared';
import type { GlobalRule } from '@specbook/shared';
import * as globalRulesStore from '../infrastructure/globalRulesStore';
import { requireWorkspaceForSender } from '../windowManager';

export function registerGlobalRulesHandlers(): void {
    ipcMain.handle(IPC.GLOBAL_RULES_LOAD, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return globalRulesStore.loadAllRules(ws);
    });

    ipcMain.handle(IPC.GLOBAL_RULES_ADD, (event, payload: AddGlobalRulePayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const now = new Date().toISOString();
        const rule: GlobalRule = {
            id: generateId(),
            text: payload.text.trim(),
            createdAt: now,
            updatedAt: now,
        };
        globalRulesStore.addRule(ws, rule);
        return rule;
    });

    ipcMain.handle(IPC.GLOBAL_RULES_UPDATE, (event, payload: UpdateGlobalRulePayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const rules = globalRulesStore.loadAllRules(ws);
        const existing = rules.find(r => r.id === payload.id);
        if (!existing) throw new Error(`Rule ${payload.id} not found.`);

        const updated: GlobalRule = {
            ...existing,
            text: payload.text?.trim() ?? existing.text,
            updatedAt: new Date().toISOString(),
        };
        globalRulesStore.updateRule(ws, updated);
        return updated;
    });

    ipcMain.handle(IPC.GLOBAL_RULES_DELETE, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        globalRulesStore.deleteRule(ws, id);
    });
}
