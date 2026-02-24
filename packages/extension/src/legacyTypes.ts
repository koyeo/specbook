/**
 * Legacy types for the VS Code extension.
 * These were originally in @specbook/shared but removed during the desktop app refactoring.
 */

/** Spec YAML filename (legacy). */
export const SPEC_FILENAME = 'spec.yaml';

/** A single spec item. */
export interface SpecItem {
    id: string;
    description: string;
    group: string;
    createdAt: string;
}

/** Root spec file structure. */
export interface SpecFile {
    version: string;
    items: SpecItem[];
}

/** Validate a spec description. */
export function validateDescription(description: string): { valid: boolean; error?: string } {
    const trimmed = description.trim();
    if (!trimmed) return { valid: false, error: 'Description cannot be empty.' };
    if (trimmed.length > 500) return { valid: false, error: 'Description must be 500 characters or fewer.' };
    return { valid: true };
}

/** Messages from webview to extension. */
export type WebviewToExtensionMessage =
    | { type: 'loadItems' }
    | { type: 'addItem'; description: string; group: string }
    | { type: 'deleteItem'; id: string }
    | { type: 'updateItem'; item: SpecItem };

/** Messages from extension to webview. */
export type ExtensionToWebviewMessage =
    | { type: 'itemsLoaded'; items: SpecItem[] }
    | { type: 'error'; message: string };
