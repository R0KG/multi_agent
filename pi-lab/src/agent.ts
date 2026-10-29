import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';

export interface AgentSpec { name: string; systemPrompt: string; prompt: string }
export interface Usage { input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number }
export interface AgentResult { name: string; text: string; durationMs: number; usage?: Usage }
export type AgentRunner = (agent: AgentSpec, signal: AbortSignal) => Promise<AgentResult>;
export type RunEvent = {
  at: string;
  agent: string;
  type: 'agent_started' | 'session_ready' | 'text_delta' | 'agent_finished' | 'agent_failed';
  effectiveSystemPrompt?: string;
  input?: AgentSpec;
  delta?: string;
  result?: AgentResult;
  error?: string;
};
export interface SessionLike {
  readonly systemPrompt?: string;
  readonly messages: readonly { role: string; stopReason?: string; errorMessage?: string; usage?: Usage }[];
  subscribe(listener: (event: AgentSessionEvent) => void): () => void;
  prompt(text: string): Promise<void>;
  abort(): Promise<void>;
  dispose(): void;
  getLastAssistantText(): string | undefined;
}

export function createRunner(
  createSession: (agent: AgentSpec) => Promise<SessionLike>,
  emit: (event: RunEvent) => void,
  timeoutMs: number,
): AgentRunner {
  return async (agent, parentSignal) => {
    parentSignal.throwIfAborted();
    const started = performance.now();
    const local = new AbortController();
    const signal = AbortSignal.any([parentSignal, local.signal]);
    const timer = setTimeout(() => local.abort(new Error(`${agent.name} timed out after ${timeoutMs} ms`)), timeoutMs);
    let session: SessionLike | undefined;
    let unsubscribe: (() => void) | undefined;
    let abortWork: Promise<void> | undefined;
    const stop = () => {
      // abort() is asynchronous; dispose only after it settles.
      abortWork = session?.abort().catch(() => {});
    };
    const event = (data: Omit<RunEvent, 'agent' | 'at'>) => emit({ ...data, agent: agent.name, at: new Date().toISOString() });
    try {
      event({ type: 'agent_started', input: agent });
      session = await createSession(agent);
      signal.addEventListener('abort', stop, { once: true });
      signal.throwIfAborted();
      event({ type: 'session_ready', effectiveSystemPrompt: session.systemPrompt });
      unsubscribe = session.subscribe((e) => {
        if (e.type === 'message_update' && e.assistantMessageEvent.type === 'text_delta') {
          event({ type: 'text_delta', delta: e.assistantMessageEvent.delta });
        }
      });
      await session.prompt(agent.prompt);
      signal.throwIfAborted();
      const last = [...session.messages].reverse().find((message) => message.role === 'assistant');
      if (!last || !['stop', 'length'].includes(last.stopReason ?? '')) {
        throw new Error(last?.errorMessage || `${agent.name} did not finish successfully (${last?.stopReason ?? 'no assistant message'})`);
      }
      // Truncation is not a usable successful handoff.
      if (last.stopReason === 'length') throw new Error(`${agent.name} reached its output token limit`);
      const text = session.getLastAssistantText()?.trim();
      if (!text) throw new Error(`${agent.name} returned no text`);
      const result = { name: agent.name, text, durationMs: Math.round(performance.now() - started), usage: last.usage };
      event({ type: 'agent_finished', result });
      return result;
    } catch (error) {
      const reason = signal.aborted ? signal.reason : error;
      event({ type: 'agent_failed', error: reason instanceof Error ? reason.message : String(reason) });
      throw reason;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      await abortWork;
      unsubscribe?.();
      session?.dispose();
    }
  };
}
