/**
 * Message types for Extension ↔ Webview communication.
 */
import type { SpecItem } from './types';

/** Messages sent FROM the Webview TO the Extension. */
export type WebviewToExtensionMessage =
    | { type: 'addItem'; description: string; group: string }
    | { type: 'deleteItem'; id: string }
    | { type: 'updateItem'; item: SpecItem }
    | { type: 'loadItems' };

/** Messages sent FROM the Extension TO the Webview. */
export type ExtensionToWebviewMessage =
    | { type: 'itemsLoaded'; items: SpecItem[] }
    | { type: 'error'; message: string };
