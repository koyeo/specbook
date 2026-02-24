/**
 * IPC handlers for Playground chat sessions.
 */
import { ipcMain } from 'electron';
import { IPC, generateId } from '@specbook/shared';
import type { SendChatMessagePayload, ChatMessage, ChatSession } from '@specbook/shared';
import * as chatStore from '../infrastructure/chatStore';
import { requireWorkspaceForSender } from '../windowManager';
import { getAiConfig, appendTokenUsage } from '../infrastructure/appConfig';
import { callChat, scanProjectTree, scanKeyFiles } from '@specbook/ai';

const SYSTEM_PROMPT = `You are a requirements analyst and domain expert assistant integrated into Specbook, a specification management tool.

Your responsibilities:
1. Help users explore and refine their requirements, ideas, and features through conversation.
2. Ask clarifying questions to better understand the user's domain.
3. When you identify important domain terms, highlight them in **bold** and suggest adding them to the Glossary.
4. Help break down large features into smaller, well-defined specifications.
5. Provide structured summaries when asked.

Respond in the same language the user uses. Be concise but thorough.`;

export function registerChatHandlers(): void {
    ipcMain.handle(IPC.CHAT_LIST_SESSIONS, (event) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return chatStore.listSessions(ws);
    });

    ipcMain.handle(IPC.CHAT_LOAD_SESSION, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        return chatStore.loadSession(ws, id);
    });

    ipcMain.handle(IPC.CHAT_CREATE_SESSION, (event, title: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
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

    ipcMain.handle(IPC.CHAT_DELETE_SESSION, (event, id: string) => {
        const ws = requireWorkspaceForSender(event.sender.id);
        chatStore.deleteSession(ws, id);
    });

    ipcMain.handle(IPC.CHAT_SEND_MESSAGE, async (event, payload: SendChatMessagePayload) => {
        const ws = requireWorkspaceForSender(event.sender.id);
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
        chatStore.appendMessage(ws, payload.sessionId, userMsg);

        // 2. Check for slash command
        const trimmed = payload.content.trim();
        if (trimmed.startsWith('/')) {
            const assistantMsg = await handleCommand(trimmed, ws, config);
            chatStore.appendMessage(ws, payload.sessionId, assistantMsg);
            return assistantMsg;
        }

        // 3. Normal chat flow — build message history for AI
        const session = chatStore.loadSession(ws, payload.sessionId);
        if (!session) throw new Error('Session not found');
        const aiMessages = session.messages.map(m => ({
            role: m.role,
            content: m.content,
        }));

        // 4. Call AI
        const result = await callChat(config, aiMessages, SYSTEM_PROMPT);

        // 5. Persist token usage
        if (result.tokenUsage) {
            appendTokenUsage(result.tokenUsage);
        }

        // 6. Append assistant message
        const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: result.content,
            timestamp: new Date().toISOString(),
        };
        chatStore.appendMessage(ws, payload.sessionId, assistantMsg);

        return assistantMsg;
    });
}

// ─── Slash Commands ─────────────────────────────────

/** Available commands registry. */
const COMMANDS: Record<string, { description: string }> = {
    '/scan': { description: 'Scan project files and generate a feature structure document' },
    '/insight': { description: 'Deep analysis of project design philosophy, core abstractions, and architecture' },
};

const SCAN_SYSTEM_PROMPT = `You are a senior software architect. You will receive the file tree of a software project.

## Your Task

Analyze the project structure and produce a **comprehensive Feature Structure Document** in Markdown.

## Document Structure

Your response must include ALL of the following sections:

### 1. Project Overview
- Project name, tech stack, frameworks, and languages used
- Brief description of the project's purpose

### 2. Module / Package Structure
Use a Markdown table:
| Module | Path | Responsibility |
|--------|------|---------------|
| ... | ... | ... |

### 3. Feature Breakdown
For each major feature area, describe:
- **Feature Name**: what it does
- **Key Components**: files and modules involved
- **Data Flow**: how data moves through the feature

### 4. Architecture Diagram
Provide a **Mermaid diagram** showing the high-level architecture — modules, layers, and their relationships:
\`\`\`mermaid
graph TD
  ...
\`\`\`

### 5. Key Data Models / Concepts
List the core domain concepts, entities, or data structures defined in the project. Use a table:
| Concept | Location | Description |
|---------|----------|-------------|
| ... | ... | ... |

### 6. API / Interface Surface
If the project exposes APIs, IPC channels, CLI commands, or public interfaces, list them.

### 7. Dependencies & Integrations
Key external dependencies and what they are used for.

## Rules
- Respond in the same language the user uses (check the file tree and any configuration for clues; default to the language of the command message).
- Base your analysis ONLY on what you can infer from the file structure and naming conventions.
- Be thorough but well-organized.
- Use Mermaid diagrams and Markdown tables extensively.`;

async function handleCommand(
    input: string,
    ws: string,
    config: import('@specbook/shared').AiConfig,
): Promise<ChatMessage> {
    const parts = input.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    if (cmd === '/scan') {
        return handleScanCommand(ws, config);
    }
    if (cmd === '/insight') {
        return handleInsightCommand(ws, config);
    }

    // Unknown command — list available ones
    const cmdList = Object.entries(COMMANDS)
        .map(([name, meta]) => `- \`${name}\` — ${meta.description}`)
        .join('\n');
    return {
        role: 'assistant',
        content: `❌ Unknown command \`${cmd}\`.\n\nAvailable commands:\n${cmdList}`,
        timestamp: new Date().toISOString(),
    };
}

async function handleScanCommand(
    ws: string,
    config: import('@specbook/shared').AiConfig,
): Promise<ChatMessage> {
    // 1. Scan project tree
    const projectTree = scanProjectTree(ws, { maxDepth: 8, maxFiles: 800 });

    // 2. Build user prompt
    const userPrompt = `Please analyze this project and generate a Feature Structure Document.\n\nProject path: ${ws}\n\n## File Tree\n\n\`\`\`\n${projectTree}\n\`\`\``;

    // 3. Call AI
    const result = await callChat(config, [
        { role: 'user', content: userPrompt },
    ], SCAN_SYSTEM_PROMPT);

    if (result.tokenUsage) {
        appendTokenUsage(result.tokenUsage);
    }

    return {
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
    };
}

// ─── /insight ───────────────────────────────────────

const INSIGHT_SYSTEM_PROMPT = `You are a principal software architect and design thinker. You will receive:
1. The file tree of a software project
2. The actual source code of key files (type definitions, entry points, services, handlers, configs)

## Your Task

Produce a **Project Design Insight Document** — not a feature list, but a deep analysis of the project's **design philosophy, core abstractions, and architectural thinking**.

## Document Structure

Your response must include ALL of the following sections:

### 1. Vision & Purpose
- What problem does this project solve? What is its reason for existence?
- What is the core value proposition?
- Who are the intended users and what workflows does it enable?

### 2. Core Abstractions & Domain Model
- What are the fundamental concepts/entities the system is built around?
- How do these concepts relate to each other?
- Provide a **Mermaid class diagram or ER diagram** showing the core domain model:
\`\`\`mermaid
classDiagram
  ...
\`\`\`

### 3. Architectural Philosophy
- What architectural patterns are used (layered architecture, event-driven, DDD, etc.)?
- What are the key design decisions and trade-offs?
- How is separation of concerns achieved?
- Provide a **Mermaid diagram** showing the layered architecture and data flow:
\`\`\`mermaid
graph TD
  ...
\`\`\`

### 4. Key Workflows
For each core workflow (3-5 most important ones), describe:
- **What triggers it** → **What happens** → **What is the outcome**
- Provide **Mermaid sequence diagrams** for the most important workflows:
\`\`\`mermaid
sequenceDiagram
  ...
\`\`\`

### 5. Data Flow & State Management
- How does data flow through the system?
- Where is state stored and how is it persisted?
- What are the key data transformations?

### 6. Extension Points & Design Patterns
- What patterns make the system extensible?
- Where are the seams for future growth?
- What conventions does the codebase follow?

### 7. Technical Decisions
Use a table to summarize key technical choices:
| Decision | Choice | Rationale |
|----------|--------|----------|
| ... | ... | ... |

## Rules
- Respond in the same language the user uses.
- Focus on **WHY** things are designed this way, not just WHAT exists.
- Think like an architect explaining the system to a new senior engineer.
- Use Mermaid diagrams extensively — class diagrams, sequence diagrams, flowcharts.
- Be insightful, opinionated, and analytical. This is NOT a mechanical listing.`;

async function handleInsightCommand(
    ws: string,
    config: import('@specbook/shared').AiConfig,
): Promise<ChatMessage> {
    // 1. Scan project tree (structure context)
    const projectTree = scanProjectTree(ws, { maxDepth: 8, maxFiles: 800 });

    // 2. Read key source files (actual code context)
    const keyFiles = scanKeyFiles(ws);

    // 3. Build user prompt
    const userPrompt = `Please analyze this project's design and architecture in depth.\n\nProject path: ${ws}\n\n## File Tree\n\n\`\`\`\n${projectTree}\n\`\`\`\n\n## Key Source Files\n\n${keyFiles}`;

    // 4. Call AI
    const result = await callChat(config, [
        { role: 'user', content: userPrompt },
    ], INSIGHT_SYSTEM_PROMPT);

    if (result.tokenUsage) {
        appendTokenUsage(result.tokenUsage);
    }

    return {
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
    };
}
