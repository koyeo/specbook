/**
 * Application layer — IPC invoke wrappers as React hooks.
 */
import { useState, useEffect, useCallback } from 'react';
import type { ObjectTreeNode, AddObjectPayload, UpdateObjectPayload, MoveObjectPayload } from '@specbook/shared';

export function useObjects() {
    const [objects, setObjects] = useState<ObjectTreeNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [workspace, setWorkspace] = useState<string | null>(null);

    const refreshWorkspace = useCallback(async () => {
        const ws = await window.api.getWorkspace();
        setWorkspace(ws);
        return ws;
    }, []);

    const loadObjects = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.api.loadObjects();
            setObjects(data);
        } catch (err) {
            console.error('Failed to load objects:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const addObject = useCallback(async (payload: AddObjectPayload) => {
        const detail = await window.api.addObject(payload);
        await loadObjects();
        return detail;
    }, [loadObjects]);

    const updateObject = useCallback(async (payload: UpdateObjectPayload) => {
        const detail = await window.api.updateObject(payload);
        await loadObjects();
        return detail;
    }, [loadObjects]);

    const deleteObject = useCallback(async (id: string) => {
        await window.api.deleteObject(id);
        await loadObjects();
    }, [loadObjects]);

    const moveObject = useCallback(async (payload: MoveObjectPayload) => {
        await window.api.moveObject(payload);
        await loadObjects();
    }, [loadObjects]);

    const selectWorkspace = useCallback(async () => {
        const ws = await window.api.selectWorkspace();
        if (ws) {
            setWorkspace(ws);
            setLoading(true);
            try {
                const data = await window.api.loadObjects();
                setObjects(data);
            } catch {
                setObjects([]);
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
        objects,
        loading,
        workspace,
        loadObjects,
        addObject,
        updateObject,
        deleteObject,
        moveObject,
        selectWorkspace,
    };
}
