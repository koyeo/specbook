/**
 * Infrastructure layer — Chat session storage.
 * Storage: .specbook/playground/{id}.json (per-session files)
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    SPEC_DIR,
    PLAYGROUND_DIR,
} from '@specbook/shared';
import type { ChatSession, ChatSessionSummary, ChatMessage } from '@specbook/shared';

function playgroundDir(workspace: string): string {
    return path.join(workspace, SPEC_DIR, PLAYGROUND_DIR);
}

function sessionPath(workspace: string, id: string): string {
    return path.join(playgroundDir(workspace), `${id}.json`);
}

function ensureDir(workspace: string): void {
    const dir = playgroundDir(workspace);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// ─── Session operations ─────────────────────────────

export function listSessions(workspace: string): ChatSessionSummary[] {
    const dir = playgroundDir(workspace);
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    const summaries: ChatSessionSummary[] = [];

    for (const file of files) {
        try {
            const data: ChatSession = JSON.parse(
                fs.readFileSync(path.join(dir, file), 'utf-8'),
            );
            summaries.push({
                id: data.id,
                title: data.title,
                messageCount: data.messages.length,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            });
        } catch {
            // skip corrupt files
        }
    }

    // Sort by updatedAt descending (most recent first)
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries;
}

export function loadSession(workspace: string, id: string): ChatSession | null {
    const fp = sessionPath(workspace, id);
    if (!fs.existsSync(fp)) return null;
    try {
        return JSON.parse(fs.readFileSync(fp, 'utf-8'));
    } catch {
        return null;
    }
}

export function createSession(workspace: string, session: ChatSession): void {
    ensureDir(workspace);
    fs.writeFileSync(sessionPath(workspace, session.id), JSON.stringify(session, null, 2) + '\n', 'utf-8');
}

export function deleteSession(workspace: string, id: string): void {
    const fp = sessionPath(workspace, id);
    if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
    }
}

export function appendMessage(workspace: string, sessionId: string, message: ChatMessage): ChatSession {
    const session = loadSession(workspace, sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found.`);

    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    fs.writeFileSync(sessionPath(workspace, sessionId), JSON.stringify(session, null, 2) + '\n', 'utf-8');
    return session;
}
