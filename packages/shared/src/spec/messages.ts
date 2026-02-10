/**
 * Message types for Extension ↔ Webview communication.
 * Shared between extension host and webview JS.
 */

/** Messages sent FROM the Webview TO the Extension. */
export type WebviewToExtensionMessage =
    | { type: 'saveSpec'; content: string }
    | { type: 'loadSpecs' };

/** Messages sent FROM the Extension TO the Webview. */
export type ExtensionToWebviewMessage =
    | { type: 'saveResult'; success: boolean; filename?: string; error?: string }
    | { type: 'specsList'; specs: Array<{ filename: string; content: string; createdAt: string }> };
