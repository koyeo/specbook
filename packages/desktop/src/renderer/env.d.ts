import type { ObjectAPI, AiAPI, GlossaryAPI, ChatAPI, KnowledgeAPI, GlobalRulesAPI, GlobalTestsAPI, IssuesAPI, MappingAPI, PromptAPI, WindowAPI, HomeAPI } from '@specbook/shared';

declare global {
    interface Window {
        api: ObjectAPI;
        aiApi: AiAPI;
        glossaryApi: GlossaryAPI;
        chatApi: ChatAPI;
        knowledgeApi: KnowledgeAPI;
        globalRulesApi: GlobalRulesAPI;
        globalTestsApi: GlobalTestsAPI;
        issuesApi: IssuesAPI;
        mappingApi: MappingAPI;
        promptApi: PromptAPI;
        windowApi: WindowAPI;
        homeApi: HomeAPI;
    }
}
