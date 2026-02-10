/**
 * Type augmentation for window.api exposed by preload.
 */
import type { SpecAPI } from '@specbook/shared';

declare global {
    interface Window {
        api: SpecAPI;
    }
}
