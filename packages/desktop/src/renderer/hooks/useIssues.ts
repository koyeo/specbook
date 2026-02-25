/**
 * Hook for issues management.
 */
import { useState, useCallback } from 'react';
import type { Issue, AddIssuePayload, UpdateIssuePayload } from '@specbook/shared';

export function useIssues() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [loading, setLoading] = useState(true);

    const loadIssues = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.issuesApi.loadIssues();
            setIssues(data);
        } catch {
            setIssues([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addIssue = useCallback(async (payload: AddIssuePayload) => {
        const issue = await window.issuesApi.addIssue(payload);
        setIssues(prev => [...prev, issue]);
        return issue;
    }, []);

    const updateIssue = useCallback(async (payload: UpdateIssuePayload) => {
        const updated = await window.issuesApi.updateIssue(payload);
        setIssues(prev => prev.map(i => i.id === updated.id ? updated : i));
        return updated;
    }, []);

    const deleteIssue = useCallback(async (id: string) => {
        await window.issuesApi.deleteIssue(id);
        setIssues(prev => prev.filter(i => i.id !== id));
    }, []);

    return { issues, loading, loadIssues, addIssue, updateIssue, deleteIssue };
}
