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
import { getWorkspace } from './specHandlers';

function requireWorkspace(): string {
    const ws = getWorkspace();
    if (!ws) throw new Error('No workspace selected. Please open a folder first.');
    return ws;
}

export function registerKnowledgeHandlers(): void {
    // Load all entries
    ipcMain.handle(IPC.KNOWLEDGE_LOAD, () => {
        try {
            const ws = requireWorkspace();
            return knowledgeStore.loadEntries(ws);
        } catch {
            return [];
        }
    });

    // Add entry
    ipcMain.handle(IPC.KNOWLEDGE_ADD, (_event, payload: AddKnowledgeEntryPayload) => {
        const ws = requireWorkspace();
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
    ipcMain.handle(IPC.KNOWLEDGE_UPDATE, (_event, payload: UpdateKnowledgeEntryPayload) => {
        const ws = requireWorkspace();
        return knowledgeStore.updateEntry(ws, payload.id, {
            title: payload.title,
            content: payload.content,
            tags: payload.tags,
        });
    });

    // Delete entry
    ipcMain.handle(IPC.KNOWLEDGE_DELETE, (_event, id: string) => {
        const ws = requireWorkspace();
        knowledgeStore.deleteEntry(ws, id);
    });
}
