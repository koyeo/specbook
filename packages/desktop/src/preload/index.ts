/**
 * Preload script — contextBridge.
 * Exposes a typed SpecAPI to the renderer process.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@specbook/shared';
import type { SpecAPI, AddSpecPayload, UpdateSpecPayload } from '@specbook/shared';

const api: SpecAPI = {
    loadSpecs: () => ipcRenderer.invoke(IPC.LOAD_SPECS),
    addSpec: (payload: AddSpecPayload) => ipcRenderer.invoke(IPC.ADD_SPEC, payload),
    updateSpec: (payload: UpdateSpecPayload) => ipcRenderer.invoke(IPC.UPDATE_SPEC, payload),
    deleteSpec: (id: string) => ipcRenderer.invoke(IPC.DELETE_SPEC, id),
    getSpec: (id: string) => ipcRenderer.invoke(IPC.GET_SPEC, id),
    selectWorkspace: () => ipcRenderer.invoke(IPC.SELECT_WORKSPACE),
    getWorkspace: () => ipcRenderer.invoke(IPC.GET_WORKSPACE),
};

contextBridge.exposeInMainWorld('api', api);
