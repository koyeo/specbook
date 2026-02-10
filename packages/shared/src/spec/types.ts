/**
 * Spec domain types.
 */

/** Index entry — stored in specs.json */
export interface SpecSummary {
    id: string;
    context: string;
    title: string;
    createdAt: string;
}

/** Full spec detail — stored in specs/{id}.spec.json */
export interface SpecDetail extends SpecSummary {
    content: string;
    updatedAt: string;
}

/** Root index file structure (.spec/specs.json) */
export interface SpecIndex {
    version: string;
    specs: SpecSummary[];
}

/** Directory name for spec storage. */
export const SPEC_DIR = '.spec';

/** Index file name. */
export const SPEC_INDEX_FILE = 'specs.json';

/** Subdirectory for individual spec files. */
export const SPECS_SUBDIR = 'specs';
