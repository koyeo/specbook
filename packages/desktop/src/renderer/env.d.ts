import type { ObjectAPI, AiAPI, GlossaryAPI, ChatAPI, KnowledgeAPI } from '@specbook/shared';

declare global {
    interface Window {
        api: ObjectAPI;
        aiApi: AiAPI;
        glossaryApi: GlossaryAPI;
        chatApi: ChatAPI;
        knowledgeApi: KnowledgeAPI;
    }
}
