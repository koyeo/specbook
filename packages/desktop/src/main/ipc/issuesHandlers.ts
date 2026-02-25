/**
 * IPC handlers for Issues CRUD operations.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { AddIssuePayload, UpdateIssuePayload } from '@specbook/shared';
import type { Issue } from '@specbook/shared';
import * as issuesStore from '../infrastructure/issuesStore';
import { requireWorkspaceForSender } from '../windowManager';

export function registerIssuesHandlers(): void {
    ipcMain.handle(IPC.ISSUES_LOAD, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return issuesStore.loadAllIssues(ws);
    });

    ipcMain.handle(IPC.ISSUES_ADD, (event, payload: AddIssuePayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const now = new Date().toISOString();
        const issue: Issue = {
            id: generateId(),
            title: payload.title.trim(),
            description: payload.description?.trim() ?? '',
            status: 'open',
            priority: payload.priority ?? 'medium',
            labels: payload.labels ?? [],
            createdAt: now,
            updatedAt: now,
        };
        issuesStore.addIssue(ws, issue);
        return issue;
    });

    ipcMain.handle(IPC.ISSUES_UPDATE, (event, payload: UpdateIssuePayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const issues = issuesStore.loadAllIssues(ws);
        const existing = issues.find(i => i.id === payload.id);
        if (!existing) throw new Error(`Issue ${payload.id} not found.`);

        const updated: Issue = {
            ...existing,
            title: payload.title?.trim() ?? existing.title,
            description: payload.description?.trim() ?? existing.description,
            status: payload.status ?? existing.status,
            priority: payload.priority ?? existing.priority,
            labels: payload.labels ?? existing.labels,
            updatedAt: new Date().toISOString(),
        };
        issuesStore.updateIssue(ws, updated);
        return updated;
    });

    ipcMain.handle(IPC.ISSUES_DELETE, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        issuesStore.deleteIssue(ws, id);
    });
}
