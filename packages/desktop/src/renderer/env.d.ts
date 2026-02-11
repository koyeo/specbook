import type { ObjectAPI } from '@specbook/shared';

declare global {
    interface Window {
        api: ObjectAPI;
    }
}
