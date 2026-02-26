/**
 * IPC handlers for Glossary CRUD operations.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { AddGlossaryTermPayload, UpdateGlossaryTermPayload } from '@specbook/shared';
import type { GlossaryTerm } from '@specbook/shared';
import * as glossaryStore from '../infrastructure/glossaryStore';
import { requireWorkspaceForSender } from '../windowManager';

export function registerGlossaryHandlers(): void {
    ipcMain.handle(IPC.GLOSSARY_LOAD, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return glossaryStore.loadAllTerms(ws);
    });

    ipcMain.handle(IPC.GLOSSARY_ADD, (event, payload: AddGlossaryTermPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const now = new Date().toISOString();
        const term: GlossaryTerm = {
            id: generateId(),
            name: payload.name.trim(),
            description: payload.description?.trim() ?? '',
            category: payload.category?.trim() || undefined,
            fields: payload.fields ?? [],
            requirements: payload.requirements ?? [],
            locations: payload.locations ?? [],
            createdAt: now,
            updatedAt: now,
        };
        glossaryStore.addTerm(ws, term);
        return term;
    });

    ipcMain.handle(IPC.GLOSSARY_UPDATE, (event, payload: UpdateGlossaryTermPayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const terms = glossaryStore.loadAllTerms(ws);
        const existing = terms.find(t => t.id === payload.id);
        if (!existing) throw new Error(`Term ${payload.id} not found.`);

        const updated: GlossaryTerm = {
            ...existing,
            name: payload.name?.trim() ?? existing.name,
            description: payload.description?.trim() ?? existing.description,
            category: payload.category?.trim() || existing.category,
            fields: payload.fields ?? existing.fields,
            requirements: payload.requirements ?? existing.requirements,
            locations: payload.locations ?? existing.locations,
            updatedAt: new Date().toISOString(),
        };
        glossaryStore.updateTerm(ws, updated);
        return updated;
    });

    ipcMain.handle(IPC.GLOSSARY_DELETE, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        glossaryStore.deleteTerm(ws, id);
    });
}
