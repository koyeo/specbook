/**
 * Hook for knowledge entry management.
 */
import { useState, useCallback } from 'react';
import type { KnowledgeEntry, AddKnowledgeEntryPayload, UpdateKnowledgeEntryPayload } from '@specbook/shared';

export function useKnowledge() {
    const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadEntries = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.knowledgeApi.loadEntries();
            setEntries(data);
        } catch {
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addEntry = useCallback(async (payload: AddKnowledgeEntryPayload) => {
        const entry = await window.knowledgeApi.addEntry(payload);
        setEntries(prev => [...prev, entry]);
        return entry;
    }, []);

    const updateEntry = useCallback(async (payload: UpdateKnowledgeEntryPayload) => {
        const updated = await window.knowledgeApi.updateEntry(payload);
        setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
        return updated;
    }, []);

    const deleteEntry = useCallback(async (id: string) => {
        await window.knowledgeApi.deleteEntry(id);
        setEntries(prev => prev.filter(e => e.id !== id));
    }, []);

    return { entries, loading, loadEntries, addEntry, updateEntry, deleteEntry };
}
