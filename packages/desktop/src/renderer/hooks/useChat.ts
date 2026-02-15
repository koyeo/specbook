/**
 * Hook for chat session management.
 */
import { useState, useCallback } from 'react';
import type { ChatSession, ChatSessionSummary, ChatMessage } from '@specbook/shared';

export function useChat() {
    const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
    const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);

    const listSessions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await window.chatApi.listSessions();
            setSessions(data);
        } catch {
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSession = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const session = await window.chatApi.loadSession(id);
            setCurrentSession(session);
        } catch {
            setCurrentSession(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const createSession = useCallback(async (title: string) => {
        const session = await window.chatApi.createSession(title);
        setCurrentSession(session);
        // Refresh session list
        const data = await window.chatApi.listSessions();
        setSessions(data);
        return session;
    }, []);

    const deleteSession = useCallback(async (id: string) => {
        await window.chatApi.deleteSession(id);
        if (currentSession?.id === id) {
            setCurrentSession(null);
        }
        const data = await window.chatApi.listSessions();
        setSessions(data);
    }, [currentSession]);

    const sendMessage = useCallback(async (content: string): Promise<ChatMessage> => {
        if (!currentSession) throw new Error('No session selected');
        setSending(true);
        try {
            // Optimistically add user message
            const userMsg: ChatMessage = {
                role: 'user',
                content,
                timestamp: new Date().toISOString(),
            };
            setCurrentSession(prev => prev ? {
                ...prev,
                messages: [...prev.messages, userMsg],
            } : null);

            // Send to backend (which calls AI and returns assistant message)
            const assistantMsg = await window.chatApi.sendMessage({
                sessionId: currentSession.id,
                content,
            });

            // Add assistant message
            setCurrentSession(prev => prev ? {
                ...prev,
                messages: [...prev.messages, assistantMsg],
            } : null);

            return assistantMsg;
        } finally {
            setSending(false);
        }
    }, [currentSession]);

    return {
        sessions, currentSession, loading, sending,
        listSessions, loadSession, createSession, deleteSession, sendMessage,
    };
}
