/**
 * Spec domain types.
 */

/** Spec type — required classification for each spec. */
export type SpecType = 'information_display' | 'action_entry' | 'state_change';

/** Display labels for spec types. */
export const SPEC_TYPE_LABELS: Record<SpecType, string> = {
    information_display: 'Information Display',
    action_entry: 'Action Entry',
    state_change: 'State Change',
};

/** Colors for spec types (used in UI). */
export const SPEC_TYPE_COLORS: Record<SpecType, string> = {
    information_display: '#1677ff',
    action_entry: '#52c41a',
    state_change: '#fa8c16',
};
/** Index entry — stored in specs.json */
export interface SpecIndexEntry {
    id: string;
    title: string;
    type: SpecType;
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
    type: SpecType;
    hasContent: boolean;
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
