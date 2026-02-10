/**
 * Spec domain types.
 */

/** A single spec item in the table. */
export interface SpecItem {
    /** Unique ID (UUID-like). */
    id: string;
    /** Description text. */
    description: string;
    /** Group/category name. */
    group: string;
    /** ISO 8601 timestamp when created. */
    createdAt: string;
}

/** The full spec file structure (persisted as YAML). */
export interface SpecFile {
    version: string;
    items: SpecItem[];
}

/** Directory name for storing specs within the workspace. */
export const SPEC_DIR = '.spec';

/** Single spec file name. */
export const SPEC_FILENAME = 'spec.yaml';
