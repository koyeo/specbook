/**
 * IPC handlers for Knowledge CRUD operations.
 */
import { ipcMain } from 'electron';
import {
    IPC, generateId,
} from '@specbook/shared';
import type {
    AddKnowledgeEntryPayload, UpdateKnowledgeEntryPayload, KnowledgeEntry,
} from '@specbook/shared';
import * as knowledgeStore from '../infrastructure/knowledgeStore';
import { requireWorkspaceForSender } from '../windowManager';

export function registerKnowledgeHandlers(): void {
    // Load all entries
    ipcMain.handle(IPC.KNOWLEDGE_LOAD, (event) => {
        try {
            const ws = requireWorkspaceForSender(event.sender.id);
            return knowledgeStore.loadEntries(ws);
        } catch {
            return [];
        }
    });

    // Add entry
    ipcMain.handle(IPC.KNOWLEDGE_ADD, (event, payload: AddKnowledgeEntryPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const now = new Date().toISOString();
        const entry: KnowledgeEntry = {
            id: generateId(),
            title: payload.title,
            content: payload.content ?? '',
            tags: payload.tags ?? [],
            createdAt: now,
            updatedAt: now,
        };
        knowledgeStore.addEntry(ws, entry);
        return entry;
    });

    // Update entry
    ipcMain.handle(IPC.KNOWLEDGE_UPDATE, (event, payload: UpdateKnowledgeEntryPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return knowledgeStore.updateEntry(ws, payload.id, {
            title: payload.title,
            content: payload.content,
            tags: payload.tags,
        });
    });

    // Delete entry
    ipcMain.handle(IPC.KNOWLEDGE_DELETE, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        knowledgeStore.deleteEntry(ws, id);
    });
}
