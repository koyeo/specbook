/**
 * IPC handlers for Playground chat sessions.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { SendChatMessagePayload, ChatMessage, ChatSession } from '@specbook/shared';
import * as chatStore from '../infrastructure/chatStore';
import { getWorkspace } from './specHandlers';
import { getAiConfig, appendTokenUsage } from '../infrastructure/appConfig';
import { callChat } from '@specbook/ai';

function requireWorkspace(): string {
    const ws = getWorkspace();
    if (!ws) throw new Error('No workspace selected. Please open a folder first.');
    return ws;
}

const SYSTEM_PROMPT = `You are a requirements analyst and domain expert assistant integrated into SpecBook, a specification management tool.

Your responsibilities:
1. Help users explore and refine their requirements, ideas, and features through conversation.
2. Ask clarifying questions to better understand the user's domain.
3. When you identify important domain terms, highlight them in **bold** and suggest adding them to the Glossary.
4. Help break down large features into smaller, well-defined specifications.
5. Provide structured summaries when asked.

Respond in the same language the user uses. Be concise but thorough.`;

export function registerChatHandlers(): void {
    ipcMain.handle(IPC.CHAT_LIST_SESSIONS, () => {
        const ws = requireWorkspace();
        return chatStore.listSessions(ws);
    });

    ipcMain.handle(IPC.CHAT_LOAD_SESSION, (_event, id: string) => {
        const ws = requireWorkspace();
        return chatStore.loadSession(ws, id);
    });

    ipcMain.handle(IPC.CHAT_CREATE_SESSION, (_event, title: string) => {
        const ws = requireWorkspace();
        const now = new Date().toISOString();
        const session: ChatSession = {
            id: generateId(),
            title: title.trim() || 'New Chat',
            messages: [],
            createdAt: now,
            updatedAt: now,
        };
        chatStore.createSession(ws, session);
        return session;
    });

    ipcMain.handle(IPC.CHAT_DELETE_SESSION, (_event, id: string) => {
        const ws = requireWorkspace();
        chatStore.deleteSession(ws, id);
    });

    ipcMain.handle(IPC.CHAT_SEND_MESSAGE, async (_event, payload: SendChatMessagePayload) => {
        const ws = requireWorkspace();
        const config = getAiConfig();
        if (!config || !config.apiKey) {
            throw new Error('AI is not configured. Please set your API Key in Settings.');
        }

        // 1. Append user message
        const userMsg: ChatMessage = {
            role: 'user',
            content: payload.content,
            timestamp: new Date().toISOString(),
        };
        const session = chatStore.appendMessage(ws, payload.sessionId, userMsg);

        // 2. Build message history for AI
        const aiMessages = session.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        // 3. Call AI
        const result = await callChat(config, aiMessages, SYSTEM_PROMPT);

        // 4. Persist token usage
        if (result.tokenUsage) {
            appendTokenUsage(result.tokenUsage);
        }

        // 5. Append assistant message
        const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: result.content,
            timestamp: new Date().toISOString(),
        };
        chatStore.appendMessage(ws, payload.sessionId, assistantMsg);

        return assistantMsg;
    });
}
