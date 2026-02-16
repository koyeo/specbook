/**
 * IPC channel names and payload types.
 * Shared between main process and renderer.
 */
import type {
    ObjectSummary, ObjectDetail, ObjectTreeNode, ObjectAction, RelatedFile, ImplData,
    AiConfig, AnalysisResult, TokenUsage,
    GlossaryTerm, ChatSession, ChatSessionSummary, ChatMessage,
    KnowledgeEntry,
    GlobalRule, GlobalRuleCategory, GlobalTest, GlobalTestCase,
} from './types';

/** IPC channel names. */
export const IPC = {
    LOAD_OBJECTS: 'object:load-all',
    ADD_OBJECT: 'object:add',
    UPDATE_OBJECT: 'object:update',
    DELETE_OBJECT: 'object:delete',
    GET_OBJECT: 'object:get',
    MOVE_OBJECT: 'object:move',
    LOAD_ACTIONS: 'object:load-actions',
    SAVE_ACTIONS: 'object:save-actions',
    LOAD_IMPLS: 'object:load-impls',
    SAVE_IMPLS: 'object:save-impls',
    LOAD_TESTS: 'object:load-tests',
    SAVE_TESTS: 'object:save-tests',
    OPEN_IN_EDITOR: 'object:open-in-editor',
    EXPORT_MARKDOWN: 'object:export-markdown',
    SELECT_WORKSPACE: 'workspace:select',
    GET_WORKSPACE: 'workspace:get',
    // AI channels
    AI_GET_CONFIG: 'ai:get-config',
    AI_SAVE_CONFIG: 'ai:save-config',
    AI_ANALYZE: 'ai:analyze',
    AI_GET_USAGE: 'ai:get-usage',
    // Glossary channels
    GLOSSARY_LOAD: 'glossary:load',
    GLOSSARY_ADD: 'glossary:add',
    GLOSSARY_UPDATE: 'glossary:update',
    GLOSSARY_DELETE: 'glossary:delete',
    // Playground channels
    CHAT_LIST_SESSIONS: 'chat:list-sessions',
    CHAT_LOAD_SESSION: 'chat:load-session',
    CHAT_CREATE_SESSION: 'chat:create-session',
    CHAT_DELETE_SESSION: 'chat:delete-session',
    CHAT_SEND_MESSAGE: 'chat:send-message',
    // Knowledge channels
    KNOWLEDGE_LOAD: 'knowledge:load',
    KNOWLEDGE_ADD: 'knowledge:add',
    KNOWLEDGE_UPDATE: 'knowledge:update',
    KNOWLEDGE_DELETE: 'knowledge:delete',
    // Global Rules channels
    GLOBAL_RULES_LOAD: 'global-rules:load',
    GLOBAL_RULES_ADD: 'global-rules:add',
    GLOBAL_RULES_UPDATE: 'global-rules:update',
    GLOBAL_RULES_DELETE: 'global-rules:delete',
    // Global Tests channels
    GLOBAL_TESTS_LOAD: 'global-tests:load',
    GLOBAL_TESTS_ADD: 'global-tests:add',
    GLOBAL_TESTS_UPDATE: 'global-tests:update',
    GLOBAL_TESTS_DELETE: 'global-tests:delete',
} as const;

/** Add object payload. */
export interface AddObjectPayload {
    title: string;
    parentId?: string | null;
    content?: string;
}

/** Update object payload. */
export interface UpdateObjectPayload {
    id: string;
    title?: string;
    content?: string;
    completed?: boolean;
    isState?: boolean;
    implRules?: import('./types').ObjectRule[];
    testRules?: import('./types').ObjectRule[];
}

/** Move object payload — change parent. */
export interface MoveObjectPayload {
    id: string;
    newParentId: string | null;
}

/** API exposed to renderer via contextBridge. */
export interface ObjectAPI {
    loadObjects(): Promise<ObjectTreeNode[]>;
    addObject(payload: AddObjectPayload): Promise<ObjectDetail>;
    updateObject(payload: UpdateObjectPayload): Promise<ObjectDetail>;
    deleteObject(id: string): Promise<void>;
    getObject(id: string): Promise<ObjectDetail | null>;
    moveObject(payload: MoveObjectPayload): Promise<void>;
    loadActions(id: string): Promise<ObjectAction[]>;
    saveActions(id: string, actions: ObjectAction[]): Promise<void>;
    loadImpls(id: string): Promise<ImplData>;
    saveImpls(id: string, files: RelatedFile[], summary?: string): Promise<void>;
    loadTests(id: string): Promise<RelatedFile[]>;
    saveTests(id: string, files: RelatedFile[]): Promise<void>;
    exportMarkdown(): Promise<boolean>;
    openInEditor(filePath: string, line?: number): Promise<void>;
    selectWorkspace(): Promise<string | null>;
    getWorkspace(): Promise<string | null>;
}

/** AI API exposed to renderer via contextBridge. */
export interface AiAPI {
    getAiConfig(): Promise<AiConfig | null>;
    saveAiConfig(config: AiConfig): Promise<void>;
    analyzeObjects(objectTree: ObjectTreeNode[]): Promise<AnalysisResult>;
    getTokenUsage(): Promise<TokenUsage[]>;
}

/** Add glossary term payload. */
export interface AddGlossaryTermPayload {
    name: string;
    aliases?: string[];
    description?: string;
    category?: string;
}

/** Update glossary term payload. */
export interface UpdateGlossaryTermPayload {
    id: string;
    name?: string;
    aliases?: string[];
    description?: string;
    category?: string;
}

/** Glossary API exposed to renderer via contextBridge. */
export interface GlossaryAPI {
    loadTerms(): Promise<GlossaryTerm[]>;
    addTerm(payload: AddGlossaryTermPayload): Promise<GlossaryTerm>;
    updateTerm(payload: UpdateGlossaryTermPayload): Promise<GlossaryTerm>;
    deleteTerm(id: string): Promise<void>;
}

/** Send chat message payload. */
export interface SendChatMessagePayload {
    sessionId: string;
    content: string;
}

/** Chat API exposed to renderer via contextBridge. */
export interface ChatAPI {
    listSessions(): Promise<ChatSessionSummary[]>;
    loadSession(id: string): Promise<ChatSession | null>;
    createSession(title: string): Promise<ChatSession>;
    deleteSession(id: string): Promise<void>;
    sendMessage(payload: SendChatMessagePayload): Promise<ChatMessage>;
}

/** Add knowledge entry payload. */
export interface AddKnowledgeEntryPayload {
    title: string;
    content?: string;
    tags?: string[];
}

/** Update knowledge entry payload. */
export interface UpdateKnowledgeEntryPayload {
    id: string;
    title?: string;
    content?: string;
    tags?: string[];
}

/** Knowledge API exposed to renderer via contextBridge. */
export interface KnowledgeAPI {
    loadEntries(): Promise<KnowledgeEntry[]>;
    addEntry(payload: AddKnowledgeEntryPayload): Promise<KnowledgeEntry>;
    updateEntry(payload: UpdateKnowledgeEntryPayload): Promise<KnowledgeEntry>;
    deleteEntry(id: string): Promise<void>;
}

// ─── Global Rules ───────────────────────────────────

/** Add global rule payload. */
export interface AddGlobalRulePayload {
    name: string;
    text: string;
    category: GlobalRuleCategory;
}

/** Update global rule payload. */
export interface UpdateGlobalRulePayload {
    id: string;
    name?: string;
    text?: string;
    category?: GlobalRuleCategory;
}

/** Global Rules API exposed to renderer. */
export interface GlobalRulesAPI {
    loadRules(): Promise<GlobalRule[]>;
    addRule(payload: AddGlobalRulePayload): Promise<GlobalRule>;
    updateRule(payload: UpdateGlobalRulePayload): Promise<GlobalRule>;
    deleteRule(id: string): Promise<void>;
}

// ─── Global Tests ───────────────────────────────────

/** Add global test payload. */
export interface AddGlobalTestPayload {
    title: string;
    description?: string;
}

/** Update global test payload. */
export interface UpdateGlobalTestPayload {
    id: string;
    title?: string;
    description?: string;
    cases?: GlobalTestCase[];
}

/** Global Tests API exposed to renderer. */
export interface GlobalTestsAPI {
    loadTests(): Promise<GlobalTest[]>;
    addTest(payload: AddGlobalTestPayload): Promise<GlobalTest>;
    updateTest(payload: UpdateGlobalTestPayload): Promise<GlobalTest>;
    deleteTest(id: string): Promise<void>;
}
