/**
 * IPC handlers for Prompt — requirements discussion & feature extraction.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { SendPromptPayload, ChatSession, ChatMessage } from '@specbook/shared';
import * as promptStore from '../infrastructure/promptStore';
import { requireWorkspaceForSender } from '../windowManager';
import { getAiConfig, appendTokenUsage } from '../infrastructure/appConfig';
import { callChat } from '@specbook/ai';

const DISCUSSION_SYSTEM = `You are a senior requirements analyst and product manager.

## Role
Help the user clarify, refine and expand their requirements through iterative discussion. You act as an expert interviewer who asks the right questions and provides structured feedback.

## Behavior
1. **Respond in the same language the user uses.** If they write in Chinese, respond in Chinese. If in English, respond in English.
2. Ask clarifying questions to uncover implicit requirements, edge cases, and acceptance criteria.
3. Help organize scattered ideas into clear, actionable requirements.
4. Point out potential issues, conflicts, or missing details in the requirements.
5. Suggest common patterns and best practices related to the domain.
6. Keep the conversation focused and productive.

## Format
- Use markdown for structured responses
- Use bullet points and numbered lists for clarity
- Use bold text for key concepts
- Be concise but thorough`;

const FEATURES_SYSTEM = `You are a product analyst who extracts structured feature specifications from requirements discussions.

## Task
Analyze the conversation and extract a list of **Objects** (features / functional modules) suitable for a product specification tool.

## Response Format
You MUST respond with a valid JSON array only — no markdown, no code fences, no extra text.

Each Object should have:
- "title": string — concise name for the feature/module
- "content": string — detailed description in markdown, including:
  - What the feature does
  - Key behaviors and rules
  - Edge cases mentioned in the discussion

Example:
[
  {
    "title": "User Authentication",
    "content": "## Overview\\nHandles user login, registration and session management.\\n\\n## Key Rules\\n- Support email + password login\\n- Session expires after 30 days of inactivity"
  }
]

## Rules
- Extract ONLY features/modules that were actually discussed
- Group related requirements into single Objects
- Use the same language as the conversation
- Be thorough — include all discussed details in the content
- Respond ONLY with the JSON array. No preamble, no suffix.`;

export function registerPromptHandlers(): void {
    // ─── Session CRUD ───────────────────────────────
    ipcMain.handle(IPC.PROMPT_LIST_SESSIONS, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return promptStore.listSessions(ws);
    });

    ipcMain.handle(IPC.PROMPT_LOAD_SESSION, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return promptStore.loadSession(ws, id);
    });

    ipcMain.handle(IPC.PROMPT_CREATE_SESSION, (event, title: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const now = new Date().toISOString();
        const session: ChatSession = {
            id: generateId(),
            title: title.trim() || 'New Discussion',
            messages: [],
            createdAt: now,
            updatedAt: now,
        };
        promptStore.createSession(ws, session);
        return session;
    });

    ipcMain.handle(IPC.PROMPT_DELETE_SESSION, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        promptStore.deleteSession(ws, id);
    });

    // ─── Send prompt (multi-turn discussion) ────────
    ipcMain.handle(IPC.PROMPT_SEND, async (event, payload: SendPromptPayload): Promise<string> => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const config = getAiConfig();
        if (!config || !config.apiKey) {
            throw new Error('AI is not configured. Please set your API Key in Settings.');
        }

        // 1. Append user message to session
        const userMsg: ChatMessage = {
            role: 'user',
            content: payload.text,
            timestamp: new Date().toISOString(),
        };
        const session = promptStore.appendMessage(ws, payload.sessionId, userMsg);

        // 2. Build multi-turn conversation from full session history
        const messages = session.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        // 3. Call AI with full conversation context
        const result = await callChat(config, messages, DISCUSSION_SYSTEM);

        if (result.tokenUsage) {
            appendTokenUsage(result.tokenUsage);
        }

        // 4. Append assistant response
        const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: result.content,
            timestamp: new Date().toISOString(),
        };
        promptStore.appendMessage(ws, payload.sessionId, assistantMsg);

        return result.content;
    });

    // ─── Generate Objects from conversation ─────────
    ipcMain.handle(IPC.PROMPT_GENERATE_FEATURES, async (event, sessionId: string): Promise<string> => {
        const ws = requireWorkspaceForSender(event.sender.id);
        const config = getAiConfig();
        if (!config || !config.apiKey) {
            throw new Error('AI is not configured. Please set your API Key in Settings.');
        }

        const session = promptStore.loadSession(ws, sessionId);
        if (!session) throw new Error('Session not found');
        if (session.messages.length === 0) throw new Error('No messages in session');

        // Build conversation text for analysis
        const conversationText = session.messages
            .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
            .join('\n\n');

        const result = await callChat(config, [
            { role: 'user', content: `Here is the full requirements discussion:\n\n${conversationText}` },
        ], FEATURES_SYSTEM);

        if (result.tokenUsage) {
            appendTokenUsage(result.tokenUsage);
        }

        return result.content;
    });
}
