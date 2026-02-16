import type { ObjectAPI, AiAPI, GlossaryAPI, ChatAPI, KnowledgeAPI, GlobalRulesAPI, GlobalTestsAPI, ScanAPI } from '@specbook/shared';

declare global {
    interface Window {
        api: ObjectAPI;
        aiApi: AiAPI;
        glossaryApi: GlossaryAPI;
        chatApi: ChatAPI;
        knowledgeApi: KnowledgeAPI;
        globalRulesApi: GlobalRulesAPI;
        globalTestsApi: GlobalTestsAPI;
        scanApi: ScanAPI;
    }
}
