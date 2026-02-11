/**
 * IPC handlers for AI features — config, analysis, token usage.
 */
import { ipcMain } from 'electron';
import { IPC } from '@specbook/shared';
import type { AiConfig, ObjectTreeNode } from '@specbook/shared';
import { analyzeObjectTree } from '@specbook/ai';
import { getAiConfig, saveAiConfig, appendTokenUsage, readTokenUsage } from '../infrastructure/appConfig';
import { getWorkspace } from './specHandlers';

export function registerAiHandlers(): void {
    ipcMain.handle(IPC.AI_GET_CONFIG, () => {
        return getAiConfig();
    });

    ipcMain.handle(IPC.AI_SAVE_CONFIG, (_event, config: AiConfig) => {
        saveAiConfig(config);
    });

    ipcMain.handle(IPC.AI_ANALYZE, async (_event, objectTree: ObjectTreeNode[]) => {
        const config = getAiConfig();
        if (!config || !config.apiKey) {
            throw new Error('AI is not configured. Please set your API Key in Settings.');
        }

        const workspace = getWorkspace();
        const result = await analyzeObjectTree(objectTree, config, workspace ?? undefined);

        // Persist token usage
        appendTokenUsage(result.tokenUsage);

        return result;
    });

    ipcMain.handle(IPC.AI_GET_USAGE, () => {
        return readTokenUsage();
    });
}
