/**
 * Preload script — contextBridge.
 * Exposes a typed ObjectAPI and AiAPI to the renderer process.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@specbook/shared';
import type {
    ObjectAPI, AddObjectPayload, UpdateObjectPayload, MoveObjectPayload, ObjectAction,
    AiAPI, AiConfig, ObjectTreeNode,
} from '@specbook/shared';

const api: ObjectAPI = {
    loadObjects: () => ipcRenderer.invoke(IPC.LOAD_OBJECTS),
    addObject: (payload: AddObjectPayload) => ipcRenderer.invoke(IPC.ADD_OBJECT, payload),
    updateObject: (payload: UpdateObjectPayload) => ipcRenderer.invoke(IPC.UPDATE_OBJECT, payload),
    deleteObject: (id: string) => ipcRenderer.invoke(IPC.DELETE_OBJECT, id),
    getObject: (id: string) => ipcRenderer.invoke(IPC.GET_OBJECT, id),
    moveObject: (payload: MoveObjectPayload) => ipcRenderer.invoke(IPC.MOVE_OBJECT, payload),
    loadActions: (id: string) => ipcRenderer.invoke(IPC.LOAD_ACTIONS, id),
    saveActions: (id: string, actions: ObjectAction[]) => ipcRenderer.invoke(IPC.SAVE_ACTIONS, id, actions),
    exportMarkdown: () => ipcRenderer.invoke(IPC.EXPORT_MARKDOWN),
    selectWorkspace: () => ipcRenderer.invoke(IPC.SELECT_WORKSPACE),
    getWorkspace: () => ipcRenderer.invoke(IPC.GET_WORKSPACE),
};

const aiApi: AiAPI = {
    getAiConfig: () => ipcRenderer.invoke(IPC.AI_GET_CONFIG),
    saveAiConfig: (config: AiConfig) => ipcRenderer.invoke(IPC.AI_SAVE_CONFIG, config),
    analyzeObjects: (objectTree: ObjectTreeNode[]) => ipcRenderer.invoke(IPC.AI_ANALYZE, objectTree),
    getTokenUsage: () => ipcRenderer.invoke(IPC.AI_GET_USAGE),
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('aiApi', aiApi);

