/**
 * IPC channel names and payload types.
 * Shared between main process and renderer.
 */
import type {
    ObjectSummary, ObjectDetail, ObjectTreeNode, ObjectAction, RelatedFile, ImplData,
    AiConfig, AnalysisResult, TokenUsage,
    GlossaryTerm, ChatSession, ChatSessionSummary, ChatMessage,
    KnowledgeEntry,
    GlobalRule, GlobalTest,
    Issue,
    FeatureMappingIndex, ObjectMappingResult, ScanProgressEvent, PromptResult,
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
    SET_WORKSPACE: 'workspace:set',
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
    // Feature mapping scanner
    SCAN_MAPPING: 'scan:mapping',
    LOAD_MAPPING: 'scan:load-mapping',
    SCAN_PROGRESS: 'scan:progress',
    SCAN_SINGLE: 'scan:single-object',
    // Prompt (correction & translation)
    PROMPT_LIST_SESSIONS: 'prompt:list-sessions',
    PROMPT_LOAD_SESSION: 'prompt:load-session',
    PROMPT_CREATE_SESSION: 'prompt:create-session',
    PROMPT_DELETE_SESSION: 'prompt:delete-session',
    PROMPT_SEND: 'prompt:send',
    PROMPT_GENERATE_FEATURES: 'prompt:generate-features',
    // Issues channels
    ISSUES_LOAD: 'issues:load',
    ISSUES_ADD: 'issues:add',
    ISSUES_UPDATE: 'issues:update',
    ISSUES_DELETE: 'issues:delete',
    // Window management
    NEW_WINDOW: 'window:new',
    // Recent workspaces
    RECENT_WORKSPACES: 'workspace:recent',
    REMOVE_RECENT_WORKSPACE: 'workspace:remove-recent',
    // Home page
    HOME_LOAD: 'home:load',
    HOME_SAVE: 'home:save',
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
    implLocations?: import('./types').ImplementationLocation[];
    implRules?: import('./types').ObjectRule[];
    testLocations?: import('./types').ImplementationLocation[];
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
    setWorkspace(workspace: string): Promise<void>;
    getWorkspace(): Promise<string | null>;
    getRecentWorkspaces(): Promise<string[]>;
    removeRecentWorkspace(workspace: string): Promise<void>;
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
    description?: string;
    category?: string;
}

/** Update glossary term payload. */
export interface UpdateGlossaryTermPayload {
    id: string;
    name?: string;
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
    content: string;
}

/** Update global rule payload. */
export interface UpdateGlobalRulePayload {
    id: string;
    content?: string;
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
    rules?: import('./types').ObjectRule[];
    locations?: import('./types').ImplementationLocation[];
}

/** Global Tests API exposed to renderer. */
export interface GlobalTestsAPI {
    loadTests(): Promise<GlobalTest[]>;
    addTest(payload: AddGlobalTestPayload): Promise<GlobalTest>;
    updateTest(payload: UpdateGlobalTestPayload): Promise<GlobalTest>;
    deleteTest(id: string): Promise<void>;
}

// ─── Feature Mapping Scanner ────────────────────────

/** Mapping API exposed to renderer. */
export interface MappingAPI {
    scanMapping(): Promise<FeatureMappingIndex>;
    loadMapping(): Promise<FeatureMappingIndex | null>;
    scanSingleObject(objectId: string): Promise<ObjectMappingResult>;
    onScanProgress(callback: (event: ScanProgressEvent) => void): () => void;
}

// ─── Prompt (Correction & Translation) ──────────────

/** Send prompt message payload. */
export interface SendPromptPayload {
    sessionId: string;
    text: string;
}

/** Prompt API exposed to renderer. */
export interface PromptAPI {
    listSessions(): Promise<ChatSessionSummary[]>;
    loadSession(id: string): Promise<ChatSession | null>;
    createSession(title: string): Promise<ChatSession>;
    deleteSession(id: string): Promise<void>;
    sendPrompt(payload: SendPromptPayload): Promise<string>;
    generateFeatures(sessionId: string): Promise<string>;
}

// ─── Issues ─────────────────────────────────────────

/** Add issue payload. */
export interface AddIssuePayload {
    title: string;
    description?: string;
    priority?: import('./types').IssuePriority;
    labels?: string[];
}

/** Update issue payload. */
export interface UpdateIssuePayload {
    id: string;
    title?: string;
    description?: string;
    status?: import('./types').IssueStatus;
    priority?: import('./types').IssuePriority;
    labels?: string[];
}

/** Issues API exposed to renderer. */
export interface IssuesAPI {
    loadIssues(): Promise<Issue[]>;
    addIssue(payload: AddIssuePayload): Promise<Issue>;
    updateIssue(payload: UpdateIssuePayload): Promise<Issue>;
    deleteIssue(id: string): Promise<void>;
}

/** Window management API exposed to renderer. */
export interface WindowAPI {
    newWindow(): Promise<void>;
}

// ─── Home Page ──────────────────────────────────────

/** Home API exposed to renderer. */
export interface HomeAPI {
    loadHome(): Promise<import('./types').HomeData>;
    saveHome(content: string): Promise<void>;
}
