/**
 * Spec domain types.
 */

/** Available action types for spec actions. */
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

/** A single spec action — describes a user interaction and the resulting state change. */
export interface SpecAction {
    action: ActionType;
    stateChange: string;
}

/** Index entry — stored in specs.json */
export interface SpecIndexEntry {
    id: string;
    title: string;
    parentId: string | null;
    completed: boolean;
    contentHash: string | null;
    createdAt: string;
    updatedAt: string;
}

/** In-memory summary — assembled from index + markdown files */
export interface SpecSummary {
    id: string;
    parentId: string | null;
    title: string;
    hasContent: boolean;
    hasActions: boolean;
    completed: boolean;
    createdAt: string;
}

/** Full spec detail — specs/{id}.md contains only body content */
export interface SpecDetail extends SpecSummary {
    content: string;
    updatedAt: string;
}

/** Tree node — SpecSummary with children for UI rendering */
export interface SpecTreeNode extends SpecSummary {
    children?: SpecTreeNode[];
}

/** Root index file structure (.spec/specs.json) */
export interface SpecIndex {
    version: string;
    specs: SpecIndexEntry[];
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
