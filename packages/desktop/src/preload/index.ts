/**
 * Preload script — contextBridge.
 * Exposes typed APIs to the renderer process.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@specbook/shared';
import type {
    ObjectAPI, AddObjectPayload, UpdateObjectPayload, MoveObjectPayload, ObjectAction, RelatedFile,
    AiAPI, AiConfig, ObjectTreeNode,
    GlossaryAPI, AddGlossaryTermPayload, UpdateGlossaryTermPayload,
    ChatAPI, SendChatMessagePayload,
    KnowledgeAPI, AddKnowledgeEntryPayload, UpdateKnowledgeEntryPayload,
    GlobalRulesAPI, AddGlobalRulePayload, UpdateGlobalRulePayload,
    GlobalTestsAPI, AddGlobalTestPayload, UpdateGlobalTestPayload,
    MappingAPI, ScanProgressEvent,
    PromptAPI, SendPromptPayload,
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
    loadImpls: (id: string) => ipcRenderer.invoke(IPC.LOAD_IMPLS, id),
    saveImpls: (id: string, files: RelatedFile[], summary?: string) => ipcRenderer.invoke(IPC.SAVE_IMPLS, id, files, summary),
    loadTests: (id: string) => ipcRenderer.invoke(IPC.LOAD_TESTS, id),
    saveTests: (id: string, files: RelatedFile[]) => ipcRenderer.invoke(IPC.SAVE_TESTS, id, files),
    exportMarkdown: () => ipcRenderer.invoke(IPC.EXPORT_MARKDOWN),
    openInEditor: (filePath: string, line?: number) => ipcRenderer.invoke(IPC.OPEN_IN_EDITOR, filePath, line),
    selectWorkspace: () => ipcRenderer.invoke(IPC.SELECT_WORKSPACE),
    getWorkspace: () => ipcRenderer.invoke(IPC.GET_WORKSPACE),
};

const aiApi: AiAPI = {
    getAiConfig: () => ipcRenderer.invoke(IPC.AI_GET_CONFIG),
    saveAiConfig: (config: AiConfig) => ipcRenderer.invoke(IPC.AI_SAVE_CONFIG, config),
    analyzeObjects: (objectTree: ObjectTreeNode[]) => ipcRenderer.invoke(IPC.AI_ANALYZE, objectTree),
    getTokenUsage: () => ipcRenderer.invoke(IPC.AI_GET_USAGE),
};

const glossaryApi: GlossaryAPI = {
    loadTerms: () => ipcRenderer.invoke(IPC.GLOSSARY_LOAD),
    addTerm: (payload: AddGlossaryTermPayload) => ipcRenderer.invoke(IPC.GLOSSARY_ADD, payload),
    updateTerm: (payload: UpdateGlossaryTermPayload) => ipcRenderer.invoke(IPC.GLOSSARY_UPDATE, payload),
    deleteTerm: (id: string) => ipcRenderer.invoke(IPC.GLOSSARY_DELETE, id),
};

const chatApi: ChatAPI = {
    listSessions: () => ipcRenderer.invoke(IPC.CHAT_LIST_SESSIONS),
    loadSession: (id: string) => ipcRenderer.invoke(IPC.CHAT_LOAD_SESSION, id),
    createSession: (title: string) => ipcRenderer.invoke(IPC.CHAT_CREATE_SESSION, title),
    deleteSession: (id: string) => ipcRenderer.invoke(IPC.CHAT_DELETE_SESSION, id),
    sendMessage: (payload: SendChatMessagePayload) => ipcRenderer.invoke(IPC.CHAT_SEND_MESSAGE, payload),
};

const knowledgeApi: KnowledgeAPI = {
    loadEntries: () => ipcRenderer.invoke(IPC.KNOWLEDGE_LOAD),
    addEntry: (payload: AddKnowledgeEntryPayload) => ipcRenderer.invoke(IPC.KNOWLEDGE_ADD, payload),
    updateEntry: (payload: UpdateKnowledgeEntryPayload) => ipcRenderer.invoke(IPC.KNOWLEDGE_UPDATE, payload),
    deleteEntry: (id: string) => ipcRenderer.invoke(IPC.KNOWLEDGE_DELETE, id),
};

const globalRulesApi: GlobalRulesAPI = {
    loadRules: () => ipcRenderer.invoke(IPC.GLOBAL_RULES_LOAD),
    addRule: (payload: AddGlobalRulePayload) => ipcRenderer.invoke(IPC.GLOBAL_RULES_ADD, payload),
    updateRule: (payload: UpdateGlobalRulePayload) => ipcRenderer.invoke(IPC.GLOBAL_RULES_UPDATE, payload),
    deleteRule: (id: string) => ipcRenderer.invoke(IPC.GLOBAL_RULES_DELETE, id),
};

const globalTestsApi: GlobalTestsAPI = {
    loadTests: () => ipcRenderer.invoke(IPC.GLOBAL_TESTS_LOAD),
    addTest: (payload: AddGlobalTestPayload) => ipcRenderer.invoke(IPC.GLOBAL_TESTS_ADD, payload),
    updateTest: (payload: UpdateGlobalTestPayload) => ipcRenderer.invoke(IPC.GLOBAL_TESTS_UPDATE, payload),
    deleteTest: (id: string) => ipcRenderer.invoke(IPC.GLOBAL_TESTS_DELETE, id),
};

const mappingApi: MappingAPI = {
    scanMapping: () => ipcRenderer.invoke(IPC.SCAN_MAPPING),
    loadMapping: () => ipcRenderer.invoke(IPC.LOAD_MAPPING),
    scanSingleObject: (objectId: string) => ipcRenderer.invoke(IPC.SCAN_SINGLE, objectId),
    onScanProgress: (callback: (event: ScanProgressEvent) => void) => {
        const handler = (_event: any, data: ScanProgressEvent) => callback(data);
        ipcRenderer.on(IPC.SCAN_PROGRESS, handler);
        return () => { ipcRenderer.removeListener(IPC.SCAN_PROGRESS, handler); };
    },
};

const promptApi: PromptAPI = {
    listSessions: () => ipcRenderer.invoke(IPC.PROMPT_LIST_SESSIONS),
    loadSession: (id: string) => ipcRenderer.invoke(IPC.PROMPT_LOAD_SESSION, id),
    createSession: (title: string) => ipcRenderer.invoke(IPC.PROMPT_CREATE_SESSION, title),
    deleteSession: (id: string) => ipcRenderer.invoke(IPC.PROMPT_DELETE_SESSION, id),
    sendPrompt: (payload: SendPromptPayload) => ipcRenderer.invoke(IPC.PROMPT_SEND, payload),
    generateFeatures: (sessionId: string) => ipcRenderer.invoke(IPC.PROMPT_GENERATE_FEATURES, sessionId),
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('aiApi', aiApi);
contextBridge.exposeInMainWorld('glossaryApi', glossaryApi);
contextBridge.exposeInMainWorld('chatApi', chatApi);
contextBridge.exposeInMainWorld('knowledgeApi', knowledgeApi);
contextBridge.exposeInMainWorld('globalRulesApi', globalRulesApi);
contextBridge.exposeInMainWorld('globalTestsApi', globalTestsApi);
contextBridge.exposeInMainWorld('mappingApi', mappingApi);
contextBridge.exposeInMainWorld('promptApi', promptApi);
