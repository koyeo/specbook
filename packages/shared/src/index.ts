/**
 * @specbook/shared
 * Shared types, constants, and utility functions.
 */

export const SPECBOOK_VERSION = '0.1.0';

// Spec domain
export type { SpecItem, SpecFile } from './spec/types';
export { SPEC_DIR, SPEC_FILENAME } from './spec/types';
export { validateDescription, generateId } from './spec/validations';
export type { ValidationResult } from './spec/validations';
export type { WebviewToExtensionMessage, ExtensionToWebviewMessage } from './spec/messages';
