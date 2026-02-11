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
