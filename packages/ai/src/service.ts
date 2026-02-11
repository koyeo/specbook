/**
 * AI analysis service — orchestrates prompt building and API calls.
 */
import type { AiConfig, ObjectTreeNode, AnalysisResult } from '@specbook/shared';
import { buildSystemPrompt, buildUserPrompt } from './prompt';
import { callAnthropic } from './anthropicAdapter';

/**
 * Analyse an Object Tree against the project codebase using the configured AI provider.
 *
 * @param objectTree  The full (or sub-tree) of spec objects to analyse.
 * @param config      AI provider configuration (apiKey, baseUrl, model).
 * @param workspacePath  Optional workspace path for additional context.
 * @returns           AnalysisResult containing mappings and token usage.
 */
export async function analyzeObjectTree(
    objectTree: ObjectTreeNode[],
    config: AiConfig,
    workspacePath?: string,
): Promise<AnalysisResult> {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(objectTree, workspacePath);

    const { mappings, tokenUsage, rawResponse, directoryTree } = await callAnthropic(config, systemPrompt, userPrompt);

    return { mappings, tokenUsage, systemPrompt, userPrompt, rawResponse, directoryTree };
}
