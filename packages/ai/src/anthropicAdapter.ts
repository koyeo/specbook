/**
 * Anthropic SDK adapter — calls Claude API and returns structured results.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AiConfig, ObjectMapping, TokenUsage } from '@specbook/shared';

export interface AdapterResult {
    mappings: ObjectMapping[];
    tokenUsage: TokenUsage;
}

/**
 * Call the Anthropic Messages API and return parsed mappings + token usage.
 */
export async function callAnthropic(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
): Promise<AdapterResult> {
    const client = new Anthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl || 'https://api.anthropic.com',
    });

    const response = await client.messages.create({
        model: config.model || 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content from response
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text');
    const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    // Parse JSON from response (handle possible markdown code fences)
    let mappings: ObjectMapping[] = [];
    try {
        const jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(jsonStr);
        mappings = parsed.mappings ?? parsed ?? [];
    } catch {
        // If parsing fails, return a single "unknown" mapping
        mappings = [{
            objectId: 'parse-error',
            objectTitle: 'Parse Error',
            status: 'unknown',
            summary: `Failed to parse AI response: ${rawText.substring(0, 200)}`,
            relatedFiles: [],
        }];
    }

    const tokenUsage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: config.model || 'claude-sonnet-4-20250514',
        timestamp: new Date().toISOString(),
    };

    return { mappings, tokenUsage };
}
