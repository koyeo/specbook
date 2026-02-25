/**
 * Hook for global rules management.
 */
import { useState, useCallback } from 'react';
import type { GlobalRule, AddGlobalRulePayload, UpdateGlobalRulePayload } from '@specbook/shared';

export function useGlobalRules() {
    const [rules, setRules] = useState<GlobalRule[]>([]);
    const [loading, setLoading] = useState(true);

    const loadRules = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.globalRulesApi.loadRules();
            setRules(data);
        } catch {
            setRules([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const addRule = useCallback(async (payload: AddGlobalRulePayload) => {
        const rule = await window.globalRulesApi.addRule(payload);
        setRules(prev => [...prev, rule]);
        return rule;
    }, []);

    const updateRule = useCallback(async (payload: UpdateGlobalRulePayload) => {
        const updated = await window.globalRulesApi.updateRule(payload);
        setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
        return updated;
    }, []);

    const deleteRule = useCallback(async (id: string) => {
        await window.globalRulesApi.deleteRule(id);
        setRules(prev => prev.filter(r => r.id !== id));
    }, []);

    return { rules, loading, loadRules, addRule, updateRule, deleteRule };
}
