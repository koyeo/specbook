/**
 * Public barrel for @specbook/shared.
 *
 * Re-exports everything consumers (desktop / web / extension) need.
 */

// Object domain types
export type { ObjectSummary, ObjectDetail, ObjectIndex, ObjectIndexEntry, ObjectTreeNode, ObjectAction, ActionType } from './spec/types';
export { ACTION_TYPES, SPEC_DIR, SPEC_INDEX_FILE, SPECS_SUBDIR, SPEC_FILE_EXT, SPEC_ACTION_FILE_EXT, ACTION_ENTRY_COLOR } from './spec/types';

// IPC contract
export { IPC } from './spec/messages';
export type { AddObjectPayload, UpdateObjectPayload, MoveObjectPayload, ObjectAPI } from './spec/messages';
