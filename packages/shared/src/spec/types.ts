/**
 * Spec domain types — shared between extension and web.
 */

/** Raw spec input from the user (content only, name auto-generated). */
export interface SpecInput {
    /** YAML content of the spec. */
    content: string;
    /** ISO 8601 timestamp when created. */
    createdAt: string;
}

/** Persisted spec with its filename. */
export interface SpecEntry {
    /** Auto-generated filename (without extension), e.g. "spec-20260210-193500". */
    filename: string;
    /** YAML content. */
    content: string;
    /** ISO 8601 timestamp. */
    createdAt: string;
}

/** Directory name for storing specs within the workspace. */
export const SPEC_DIR = '.spec';

/** File extension for spec files. */
export const SPEC_EXT = '.yaml';
