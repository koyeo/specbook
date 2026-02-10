/**
 * Application layer — IPC invoke wrappers as React hooks.
 */
import { useState, useEffect, useCallback } from 'react';
import type { SpecSummary, AddSpecPayload, UpdateSpecPayload } from '@specbook/shared';

export function useSpecs() {
    const [specs, setSpecs] = useState<SpecSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [workspace, setWorkspace] = useState<string | null>(null);

    const refreshWorkspace = useCallback(async () => {
        const ws = await window.api.getWorkspace();
        setWorkspace(ws);
        return ws;
    }, []);

    const loadSpecs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.api.loadSpecs();
            setSpecs(data);
        } catch (err) {
            console.error('Failed to load specs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const addSpec = useCallback(async (payload: AddSpecPayload) => {
        const detail = await window.api.addSpec(payload);
        await loadSpecs();
        return detail;
    }, [loadSpecs]);

    const updateSpec = useCallback(async (payload: UpdateSpecPayload) => {
        const detail = await window.api.updateSpec(payload);
        await loadSpecs();
        return detail;
    }, [loadSpecs]);

    const deleteSpec = useCallback(async (id: string) => {
        await window.api.deleteSpec(id);
        await loadSpecs();
    }, [loadSpecs]);

    const selectWorkspace = useCallback(async () => {
        const ws = await window.api.selectWorkspace();
        if (ws) {
            setWorkspace(ws);
            setLoading(true);
            try {
                const data = await window.api.loadSpecs();
                setSpecs(data);
            } catch {
                setSpecs([]);
            } finally {
                setLoading(false);
            }
        }
        return ws;
    }, []);

    useEffect(() => {
        refreshWorkspace();
    }, [refreshWorkspace]);

    return {
        specs,
        loading,
        workspace,
        loadSpecs,
        addSpec,
        updateSpec,
        deleteSpec,
        selectWorkspace,
    };
}
