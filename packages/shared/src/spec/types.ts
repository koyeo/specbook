/**
 * Object domain types.
 */

/** Available action types for object actions. */
export const ACTION_TYPES = [
    'Click',
    'Double Click',
    'Mouse Enter',
    'Mouse Leave',
    'Mouse Down',
    'Mouse Up',
    'Right Click',
    'Press and Drag',
] as const;

export type ActionType = typeof ACTION_TYPES[number];

/** A single object action — describes a user interaction and the resulting state change. */
export interface ObjectAction {
    action: ActionType;
    stateChange: string;
}

/** A single object rule — describes a constraint or requirement. */
export interface ObjectRule {
    id: string;
    text: string;
}

/** Index entry — stored in specs.json */
export interface ObjectIndexEntry {
    id: string;
    title: string;
    parentId: string | null;
    completed: boolean;
    isState: boolean;
    contentHash: string | null;
    implRules?: ObjectRule[];
    testRules?: ObjectRule[];
    createdAt: string;
    updatedAt: string;
}

/** In-memory summary — assembled from index + markdown files */
export interface ObjectSummary {
    id: string;
    parentId: string | null;
    title: string;
    hasContent: boolean;
    hasActions: boolean;
    hasImpls: boolean;
    hasTests: boolean;
    isState: boolean;
    completed: boolean;
    implRules?: ObjectRule[];
    testRules?: ObjectRule[];
    createdAt: string;
}

/** Full object detail — specs/{id}.md contains only body content */
export interface ObjectDetail extends ObjectSummary {
    content: string;
    updatedAt: string;
}

/** Tree node — ObjectSummary with children for UI rendering */
export interface ObjectTreeNode extends ObjectSummary {
    children?: ObjectTreeNode[];
}

/** Root index file structure (.spec/specs.json) */
export interface ObjectIndex {
    version: string;
    specs: ObjectIndexEntry[];
}

/** Directory name for spec storage. */
export const SPEC_DIR = '.spec';

/** Index file name. */
export const SPEC_INDEX_FILE = 'specs.json';

/** Subdirectory for individual spec files. */
export const SPECS_SUBDIR = 'specs';

/** File extension for individual spec markdown files. */
export const SPEC_FILE_EXT = '.md';

/** File extension for individual spec action files. */
export const SPEC_ACTION_FILE_EXT = '.actions.json';

/** Subdirectory for implementation mapping files. */
export const IMPLS_SUBDIR = 'impls';

/** Subdirectory for test mapping files. */
export const TESTS_SUBDIR = 'tests';

/** File extension for impl/test mapping files. */
export const MAPPING_FILE_EXT = '.json';

/** Color for the "Action Entry" indicator (dot + tag). */
export const ACTION_ENTRY_COLOR = '#1677ff';

// ─── AI Types ────────────────────────────────────────

/** AI provider configuration. */
export interface AiConfig {
    apiKey: string;
    baseUrl: string;          // default: https://api.anthropic.com
    model: string;            // default: claude-sonnet-4-20250514
}

/** Token usage for a single API call. */
export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    model: string;
    timestamp: string;        // ISO 8601
}

/** A file related to an object mapping. */
export interface RelatedFile {
    filePath: string;
    description: string;
    lineRange?: { start: number; end: number };
    /** Classification: implementation code or test code. */
    type?: 'impl' | 'test';
}

/** Wrapper for impl files with an optional AI-generated summary. */
export interface ImplData {
    summary?: string;
    files: RelatedFile[];
}

/** Object mapping result returned by AI. */
export interface ObjectMapping {
    objectId?: string;
    objectTitle: string;
    status: 'implemented' | 'partial' | 'not_found' | 'unknown';
    summary: string;
    relatedFiles: RelatedFile[];
}

/** Full analysis result containing mappings + token usage + prompts for logging. */
export interface AnalysisResult {
    mappings: ObjectMapping[];
    tokenUsage: TokenUsage;
    systemPrompt: string;
    userPrompt: string;
    rawResponse: string;
    directoryTree?: string;
}

/** A single log entry within an analysis task. */
export interface AnalysisLogEntry {
    type: 'context' | 'prompt' | 'response' | 'result' | 'error';
    label: string;
    content: string;
    timestamp: string;
}

/** A tracked analysis task with progress, logs, and results. */
export interface AnalysisTask {
    id: string;
    status: 'running' | 'completed' | 'error';
    objectCount: number;
    model: string;
    createdAt: string;
    completedAt?: string;
    tokenUsage?: TokenUsage;
    mappings?: ObjectMapping[];
    logs: AnalysisLogEntry[];
    errorMessage?: string;
}

// ─── Glossary Types ─────────────────────────────────

/** A single glossary term entry. */
export interface GlossaryTerm {
    id: string;
    name: string;
    aliases: string[];
    description: string;
    category?: string;
    createdAt: string;
    updatedAt: string;
}

/** Root glossary file structure (.spec/glossary.json) */
export interface GlossaryIndex {
    version: string;
    terms: GlossaryTerm[];
}

/** Glossary file name. */
export const GLOSSARY_FILE = 'glossary.json';

// ─── Playground (Chat) Types ────────────────────────

/** A single chat message. */
export interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

/** A chat session with its full message history. */
export interface ChatSession {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: string;
    updatedAt: string;
}

/** Summary of a chat session (without messages, for listing). */
export interface ChatSessionSummary {
    id: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

/** Subdirectory for playground chat sessions. */
export const PLAYGROUND_DIR = 'playground';

// ─── Knowledge Base Types ───────────────────────────

/** Predefined tag suggestions for knowledge entries. */
export const KNOWLEDGE_PRESET_TAGS = [
    'Architecture',
    'Business Logic',
    'Tech Stack',
    'Infrastructure',
    'Conventions',
] as const;

/** A single knowledge base entry. */
export interface KnowledgeEntry {
    id: string;
    title: string;
    content: string;
    tags: string[];
    createdAt: string;
    updatedAt: string;
}

/** Root knowledge file structure (.spec/knowledge.json) */
export interface KnowledgeIndex {
    version: string;
    entries: KnowledgeEntry[];
}

/** Knowledge file name. */
export const KNOWLEDGE_FILE = 'knowledge.json';

// ─── Global Rules Types ─────────────────────────────

/** Category for a global rule. */
export type GlobalRuleCategory = 'impl' | 'test';

/** A single global rule entry. */
export interface GlobalRule {
    id: string;
    name: string;
    text: string;
    category: GlobalRuleCategory;
    createdAt: string;
    updatedAt: string;
}

/** Root global rules file structure (.spec/rules.json) */
export interface GlobalRuleIndex {
    version: string;
    rules: GlobalRule[];
}

/** Global rules file name. */
export const GLOBAL_RULES_FILE = 'rules.json';

// ─── Global Tests Types ─────────────────────────────

/** A single test case within a global test. */
export interface GlobalTestCase {
    id: string;
    text: string;
    createdAt: string;
    updatedAt: string;
}

/** A single global test entry (suite) containing cases. */
export interface GlobalTest {
    id: string;
    title: string;
    description: string;
    cases: GlobalTestCase[];
    createdAt: string;
    updatedAt: string;
}

/** Root global tests file structure (.spec/tests.json) */
export interface GlobalTestIndex {
    version: string;
    tests: GlobalTest[];
}

/** Global tests file name. */
export const GLOBAL_TESTS_FILE = 'tests.json';

// ─── Source Scanner Types ────────────────────────────

/** A single UUID match with its line number. */
export interface ScanMatch {
    uuid: string;
    line: number;
}

/** A single file's scan result for logging. */
export interface ScanLogEntry {
    filePath: string;
    matches: ScanMatch[];
}

/** Result of scanning workspace source files for known UUIDs. */
export interface SourceScanResult {
    /** All UUIDs found in source files (object IDs + rule IDs). */
    foundIds: string[];
    /** Total number of files scanned. */
    scannedFiles: number;
    /** Per-file scan results (only files with UUIDs). */
    scanLog: ScanLogEntry[];
}
