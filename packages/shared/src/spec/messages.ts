/**
 * IPC channel names and payload types.
 * Shared between main process and renderer.
 */
import type { ObjectSummary, ObjectDetail, ObjectTreeNode, ObjectAction } from './types';

/** IPC channel names. */
export const IPC = {
    LOAD_OBJECTS: 'object:load-all',
    ADD_OBJECT: 'object:add',
    UPDATE_OBJECT: 'object:update',
    DELETE_OBJECT: 'object:delete',
    GET_OBJECT: 'object:get',
    MOVE_OBJECT: 'object:move',
    LOAD_ACTIONS: 'object:load-actions',
    SAVE_ACTIONS: 'object:save-actions',
    EXPORT_MARKDOWN: 'object:export-markdown',
    SELECT_WORKSPACE: 'workspace:select',
    GET_WORKSPACE: 'workspace:get',
} as const;

/** Add object payload. */
export interface AddObjectPayload {
    title: string;
    parentId?: string | null;
    content?: string;
}

/** Update object payload. */
export interface UpdateObjectPayload {
    id: string;
    title?: string;
    content?: string;
    completed?: boolean;
    isState?: boolean;
}

/** Move object payload — change parent. */
export interface MoveObjectPayload {
    id: string;
    newParentId: string | null;
}

/** API exposed to renderer via contextBridge. */
export interface ObjectAPI {
    loadObjects(): Promise<ObjectTreeNode[]>;
    addObject(payload: AddObjectPayload): Promise<ObjectDetail>;
    updateObject(payload: UpdateObjectPayload): Promise<ObjectDetail>;
    deleteObject(id: string): Promise<void>;
    getObject(id: string): Promise<ObjectDetail | null>;
    moveObject(payload: MoveObjectPayload): Promise<void>;
    loadActions(id: string): Promise<ObjectAction[]>;
    saveActions(id: string, actions: ObjectAction[]): Promise<void>;
    exportMarkdown(): Promise<boolean>;
    selectWorkspace(): Promise<string | null>;
    getWorkspace(): Promise<string | null>;
}
