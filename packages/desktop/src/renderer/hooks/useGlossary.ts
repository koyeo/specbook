/**
 * Hook for glossary term management.
 */
import { useState, useCallback } from 'react';
import type { GlossaryTerm, AddGlossaryTermPayload, UpdateGlossaryTermPayload } from '@specbook/shared';

export function useGlossary() {
    const [terms, setTerms] = useState<GlossaryTerm[]>([]);
    const [loading, setLoading] = useState(false);

    const loadTerms = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.glossaryApi.loadTerms();
            setTerms(data);
        } catch {
            setTerms([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addTerm = useCallback(async (payload: AddGlossaryTermPayload) => {
        const term = await window.glossaryApi.addTerm(payload);
        setTerms(prev => [...prev, term]);
        return term;
    }, []);

    const updateTerm = useCallback(async (payload: UpdateGlossaryTermPayload) => {
        const updated = await window.glossaryApi.updateTerm(payload);
        setTerms(prev => prev.map(t => t.id === updated.id ? updated : t));
        return updated;
    }, []);

    const deleteTerm = useCallback(async (id: string) => {
        await window.glossaryApi.deleteTerm(id);
        setTerms(prev => prev.filter(t => t.id !== id));
    }, []);

    return { terms, loading, loadTerms, addTerm, updateTerm, deleteTerm };
}
