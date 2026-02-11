/**
 * @specbook/shared
 * Shared types, constants, and utility functions.
 */

export const SPECBOOK_VERSION = '0.1.0';

// Spec domain types
export type { SpecSummary, SpecDetail, SpecIndex, SpecIndexEntry, SpecTreeNode } from './spec/types';
export { SPEC_DIR, SPEC_INDEX_FILE, SPECS_SUBDIR, SPEC_FILE_EXT } from './spec/types';

// Validation & ID generation
export { validateTitle, generateId } from './spec/validations';
export type { ValidationResult } from './spec/validations';

// IPC contract
export type { AddSpecPayload, UpdateSpecPayload, MoveSpecPayload, SpecAPI } from './spec/messages';
export { IPC } from './spec/messages';
