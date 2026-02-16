/**
 * Hook for global tests management.
 */
import { useState, useCallback } from 'react';
import type { GlobalTest, AddGlobalTestPayload, UpdateGlobalTestPayload } from '@specbook/shared';

export function useGlobalTests() {
    const [tests, setTests] = useState<GlobalTest[]>([]);
    const [loading, setLoading] = useState(false);

    const loadTests = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.globalTestsApi.loadTests();
            setTests(data);
        } catch {
            setTests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addTest = useCallback(async (payload: AddGlobalTestPayload) => {
        const test = await window.globalTestsApi.addTest(payload);
        setTests(prev => [...prev, test]);
        return test;
    }, []);

    const updateTest = useCallback(async (payload: UpdateGlobalTestPayload) => {
        const updated = await window.globalTestsApi.updateTest(payload);
        setTests(prev => prev.map(t => t.id === updated.id ? updated : t));
        return updated;
    }, []);

    const deleteTest = useCallback(async (id: string) => {
        await window.globalTestsApi.deleteTest(id);
        setTests(prev => prev.filter(t => t.id !== id));
    }, []);

    return { tests, loading, loadTests, addTest, updateTest, deleteTest };
}
