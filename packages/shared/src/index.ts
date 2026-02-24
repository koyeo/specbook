/**
 * Public barrel for @specbook/shared.
 *
 * Re-exports everything consumers (desktop / web / extension) need.
 */

// Object domain types
export type { ObjectSummary, ObjectDetail, ObjectIndex, ObjectIndexEntry, ObjectTreeNode, ObjectAction, ActionType, ObjectRule, ImplementationLocation } from './spec/types';
export { ACTION_TYPES, SPEC_DIR, SPEC_INDEX_FILE, SPECS_SUBDIR, SPEC_FILE_EXT, SPEC_ACTION_FILE_EXT, ACTION_ENTRY_COLOR, IMPLS_SUBDIR, TESTS_SUBDIR, MAPPING_FILE_EXT } from './spec/types';

// AI types
export type { AiConfig, TokenUsage, RelatedFile, ImplData, ObjectMapping, AnalysisResult, AnalysisTask, AnalysisLogEntry } from './spec/types';

// Glossary types
export type { GlossaryTerm, GlossaryIndex } from './spec/types';
export { GLOSSARY_FILE } from './spec/types';

// Playground (Chat) types
export type { ChatMessage, ChatSession, ChatSessionSummary } from './spec/types';
export { PLAYGROUND_DIR } from './spec/types';

// Knowledge Base types
export type { KnowledgeEntry, KnowledgeIndex } from './spec/types';
export { KNOWLEDGE_PRESET_TAGS, KNOWLEDGE_FILE } from './spec/types';

// Global Rules types
export type { GlobalRule, GlobalRuleIndex } from './spec/types';
export { GLOBAL_RULES_FILE } from './spec/types';

// Global Tests types
export type { GlobalTest, GlobalTestIndex } from './spec/types';
export { GLOBAL_TESTS_FILE } from './spec/types';

// Feature Mapping types
export type { FeatureMappingEntry, MappingChangeType, MappingChangeEntry, FeatureMappingIndex, ObjectMappingResult, ScanProgressEvent } from './spec/types';
export { MAPPING_FILE, MAPPING_DIR } from './spec/types';

// Prompt (Correction & Translation) types
export type { PromptResult, Correction } from './spec/types';
export { PROMPT_DIR } from './spec/types';

// IPC contract
export { IPC } from './spec/messages';
export type {
    AddObjectPayload, UpdateObjectPayload, MoveObjectPayload, ObjectAPI, AiAPI,
    AddGlossaryTermPayload, UpdateGlossaryTermPayload, GlossaryAPI,
    SendChatMessagePayload, ChatAPI,
    AddKnowledgeEntryPayload, UpdateKnowledgeEntryPayload, KnowledgeAPI,
    AddGlobalRulePayload, UpdateGlobalRulePayload, GlobalRulesAPI,
    AddGlobalTestPayload, UpdateGlobalTestPayload, GlobalTestsAPI,
    MappingAPI,
    PromptAPI, SendPromptPayload,
} from './spec/messages';

// Validations
export { validateTitle, generateId } from './spec/validations';
export type { ValidationResult } from './spec/validations';
