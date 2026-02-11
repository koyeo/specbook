import type { ObjectAPI, AiAPI } from '@specbook/shared';

declare global {
    interface Window {
        api: ObjectAPI;
        aiApi: AiAPI;
    }
}
