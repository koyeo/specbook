/**
 * IPC channel names and payload types.
 * Shared between main process and renderer.
 */
import type { SpecSummary, SpecDetail } from './types';

/** IPC channel names. */
export const IPC = {
    LOAD_SPECS: 'spec:load-all',
    ADD_SPEC: 'spec:add',
    UPDATE_SPEC: 'spec:update',
    DELETE_SPEC: 'spec:delete',
    GET_SPEC: 'spec:get',
    SELECT_WORKSPACE: 'workspace:select',
    GET_WORKSPACE: 'workspace:get',
} as const;

/** Add spec payload. */
export interface AddSpecPayload {
    title: string;
    context: string;
    content?: string;
}

/** Update spec payload. */
export interface UpdateSpecPayload {
    id: string;
    title?: string;
    context?: string;
    content?: string;
}

/** API exposed to renderer via contextBridge. */
export interface SpecAPI {
    loadSpecs(): Promise<SpecSummary[]>;
    addSpec(payload: AddSpecPayload): Promise<SpecDetail>;
    updateSpec(payload: UpdateSpecPayload): Promise<SpecDetail>;
    deleteSpec(id: string): Promise<void>;
    getSpec(id: string): Promise<SpecDetail | null>;
    selectWorkspace(): Promise<string | null>;
    getWorkspace(): Promise<string | null>;
}
