/**
 * Infrastructure layer — Chat session storage (in-memory only, no persistence).
 */
import type { ChatSession, ChatSessionSummary, ChatMessage } from '@specbook/shared';

/** In-memory store: workspace → Map<sessionId, session> */
const store = new Map<string, Map<string, ChatSession>>();

function getStore(workspace: string): Map<string, ChatSession> {
    if (!store.has(workspace)) {
        store.set(workspace, new Map());
    }
    return store.get(workspace)!;
}

// ─── Session operations ─────────────────────────────

export function listSessions(workspace: string): ChatSessionSummary[] {
    const sessions = getStore(workspace);
    const summaries: ChatSessionSummary[] = [];

    for (const data of sessions.values()) {
        summaries.push({
            id: data.id,
            title: data.title,
            messageCount: data.messages.length,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        });
    }

    // Sort by updatedAt descending (most recent first)
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries;
}

export function loadSession(workspace: string, id: string): ChatSession | null {
    return getStore(workspace).get(id) ?? null;
}

export function createSession(workspace: string, session: ChatSession): void {
    getStore(workspace).set(session.id, session);
}

export function deleteSession(workspace: string, id: string): void {
    getStore(workspace).delete(id);
}

export function appendMessage(workspace: string, sessionId: string, message: ChatMessage): ChatSession {
    const session = getStore(workspace).get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    return session;
}
