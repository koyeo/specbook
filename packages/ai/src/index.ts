/**
 * Public barrel for @specbook/ai.
 */
export { analyzeObjectTree } from './service';
export { buildSystemPrompt, buildUserPrompt } from './prompt';
export { callAnthropic, callChat } from './anthropicAdapter';
export { scanProjectTree, scanKeyFiles } from './scanner';
export type { AdapterResult } from './anthropicAdapter';

// Agentic scanner
export { scanSingleObject } from './agentScanner';
export type { ScanSingleObjectOptions } from './agentScanner';
export { scanObjectTreeDFS } from './dfsOrchestrator';
export type { DfsScanOptions, DfsScanResult, GetObjectDetailFn } from './dfsOrchestrator';
