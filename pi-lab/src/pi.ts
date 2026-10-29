import { InMemoryCredentialStore, InMemoryModelsStore } from '@earendil-works/pi-ai';
import {
  createAgentSession, createExtensionRuntime, ModelRuntime,
  SessionManager, SettingsManager, type ResourceLoader,
} from '@earendil-works/pi-coding-agent';
import type { AgentSpec } from './agent.js';

export const BASE_URL = 'https://api.commandcode.ai/provider/v1';
export const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash';

// No filesystem resource discovery: each model sees only its role and explicit input.
export function resources(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

export async function createPiFactory(apiKey: string, modelId = DEFAULT_MODEL) {
  const runtime = await ModelRuntime.create({
    credentials: new InMemoryCredentialStore(),
    modelsStore: new InMemoryModelsStore(),
    modelsPath: null,
    refreshOnCreate: false,
  });
  runtime.registerProvider('command-code', {
    baseUrl: BASE_URL,
    api: 'openai-completions',
    models: [{
      id: modelId, name: modelId, reasoning: false, input: ['text'],
      // Conservative lab settings, not assertions about the provider's limits.
      contextWindow: 32768, maxTokens: 1536,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }],
  });
  await runtime.setRuntimeApiKey('command-code', apiKey);
  const model = runtime.getModel('command-code', modelId);
  if (!model) throw new Error(`Model unavailable: ${modelId}`);
  return async (agent: AgentSpec) => {
    const { session } = await createAgentSession({
      cwd: process.cwd(), modelRuntime: runtime, model, thinkingLevel: 'off',
      noTools: 'all', tools: [],
      resourceLoader: resources(agent.systemPrompt),
      sessionManager: SessionManager.inMemory(),
      settingsManager: SettingsManager.inMemory({
        compaction: { enabled: false }, retry: { enabled: true, maxRetries: 1 },
      }),
    });
    return session;
  };
}
