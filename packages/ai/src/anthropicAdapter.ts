/**
 * AI adapter — calls Claude API via OpenAI-compatible endpoint format.
 *
 * Uses fetch + /v1/chat/completions so it works with API proxies
 * (e.g. one-api, new-api) that route models via the OpenAI format.
 */

// Node 18+ global fetch — declare for TypeScript
declare function fetch(input: string, init?: RequestInit): Promise<Response>;
interface RequestInit { method?: string; headers?: Record<string, string>; body?: string }
interface Response { ok: boolean; status: number; text(): Promise<string>; json(): Promise<any> }
declare const console: { log(...args: any[]): void; error(...args: any[]): void };
import type { AiConfig, ObjectMapping, TokenUsage } from '@specbook/shared';

export interface AdapterResult {
    mappings: ObjectMapping[];
    tokenUsage: TokenUsage;
    rawResponse: string;
    directoryTree?: string;
}

interface ChatCompletionResponse {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * Call the AI API via OpenAI-compatible chat completions endpoint.
 */
export async function callAnthropic(
    config: AiConfig,
    systemPrompt: string,
    userPrompt: string,
): Promise<AdapterResult> {
    const baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const model = config.model || 'claude-3-sonnet-20240229';
    const requestBody = {
        model,
        messages: [
            { role: 'user', content: `${systemPrompt}\n\n---\n\n${userPrompt}` },
        ],
        max_tokens: 8192,
        temperature: 0.3,
    };

    console.log('[AI Adapter] Request URL:', `${baseUrl}/v1/chat/completions`);
    console.log('[AI Adapter] Request body:', JSON.stringify({ ...requestBody, messages: requestBody.messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) + '...' })) }, null, 2));

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${errorText}`);
    }

    const data: ChatCompletionResponse = await response.json();

    // Extract text content from response
    const rawText = data.choices?.[0]?.message?.content ?? '';

    // Parse JSON from response (handle possible markdown code fences)
    let mappings: ObjectMapping[] = [];
    let directoryTree: string | undefined;
    try {
        const jsonStr = rawText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(jsonStr);
        mappings = parsed.mappings ?? parsed ?? [];
        directoryTree = parsed.directoryTree;
    } catch {
        mappings = [{
            objectTitle: 'Parse Error',
            status: 'unknown',
            summary: `Failed to parse AI response: ${rawText.substring(0, 200)}`,
            relatedFiles: [],
        }];
    }

    const tokenUsage: TokenUsage = {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        model,
        timestamp: new Date().toISOString(),
    };

    return { mappings, tokenUsage, rawResponse: rawText, directoryTree };
}

/**
 * Call the AI API for multi-turn chat conversation.
 */
export async function callChat(
    config: AiConfig,
    messages: { role: string; content: string }[],
    systemPrompt: string,
): Promise<{ content: string; tokenUsage: TokenUsage }> {
    const baseUrl = (config.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
    const model = config.model || 'claude-3-sonnet-20240229';

    const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages,
    ];

    const requestBody = {
        model,
        messages: chatMessages,
        max_tokens: 4096,
        temperature: 0.5,
    };

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${errorText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    const tokenUsage: TokenUsage = {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        model,
        timestamp: new Date().toISOString(),
    };

    return { content, tokenUsage };
}
