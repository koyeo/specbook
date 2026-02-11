/**
 * React hook — AI configuration and token usage management.
 */
import { useState, useEffect, useCallback } from 'react';
import type { AiConfig, TokenUsage } from '@specbook/shared';

const DEFAULT_CONFIG: AiConfig = {
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
};

export function useAiConfig() {
    const [config, setConfig] = useState<AiConfig>(DEFAULT_CONFIG);
    const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
    const [loading, setLoading] = useState(false);

    const loadConfig = useCallback(async () => {
        try {
            const saved = await window.aiApi.getAiConfig();
            if (saved) setConfig(saved);
        } catch (err) {
            console.error('Failed to load AI config:', err);
        }
    }, []);

    const saveConfig = useCallback(async (newConfig: AiConfig) => {
        setLoading(true);
        try {
            await window.aiApi.saveAiConfig(newConfig);
            setConfig(newConfig);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUsage = useCallback(async () => {
        try {
            const records = await window.aiApi.getTokenUsage();
            setTokenUsage(records);
        } catch (err) {
            console.error('Failed to load token usage:', err);
        }
    }, []);

    useEffect(() => {
        loadConfig();
        loadUsage();
    }, [loadConfig, loadUsage]);

    // Computed totals
    const totalInputTokens = tokenUsage.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = tokenUsage.reduce((sum, r) => sum + r.outputTokens, 0);

    return {
        config,
        tokenUsage,
        totalInputTokens,
        totalOutputTokens,
        loading,
        saveConfig,
        loadUsage,
        isConfigured: !!config.apiKey,
    };
}
