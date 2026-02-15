/**
 * Public barrel for @specbook/ai.
 */
export { analyzeObjectTree } from './service';
export { buildSystemPrompt, buildUserPrompt } from './prompt';
export { callAnthropic, callChat } from './anthropicAdapter';
export type { AdapterResult } from './anthropicAdapter';
