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

/** Index entry — stored in specs.json */
export interface ObjectIndexEntry {
    id: string;
    title: string;
    parentId: string | null;
    completed: boolean;
    isState: boolean;
    contentHash: string | null;
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
    isState: boolean;
    completed: boolean;
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
