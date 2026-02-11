/**
 * Public barrel for @specbook/shared.
 *
 * Re-exports everything consumers (desktop / web / extension) need.
 */

// Object domain types
export type { ObjectSummary, ObjectDetail, ObjectIndex, ObjectIndexEntry, ObjectTreeNode, ObjectAction, ActionType } from './spec/types';
export { ACTION_TYPES, SPEC_DIR, SPEC_INDEX_FILE, SPECS_SUBDIR, SPEC_FILE_EXT, SPEC_ACTION_FILE_EXT, ACTION_ENTRY_COLOR } from './spec/types';

// AI types
export type { AiConfig, TokenUsage, RelatedFile, ObjectMapping, AnalysisResult } from './spec/types';

// IPC contract
export { IPC } from './spec/messages';
export type { AddObjectPayload, UpdateObjectPayload, MoveObjectPayload, ObjectAPI, AiAPI } from './spec/messages';

// Validations
export { validateTitle, generateId } from './spec/validations';
export type { ValidationResult } from './spec/validations';
