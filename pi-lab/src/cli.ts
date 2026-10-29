import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { createRunner, type AgentRunner, type RunEvent } from './agent.js';
import { BASE_URL, DEFAULT_MODEL, createPiFactory } from './pi.js';
import { runWorkflow } from './workflow.js';

const labRoot = fileURLToPath(new URL('..', import.meta.url));
const workspace = resolve(labRoot, '..');
const defaultTask = 'Design a minimal background job queue for a small web application. Explain how to handle failed jobs.';

function options(args: string[]) {
  let demo = false;
  let model = DEFAULT_MODEL;
  let timeoutMs = 120_000;
  const task: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--demo') demo = true;
    else if (arg === '--help') return undefined;
    else if (arg === '--model' || arg === '--timeout-ms') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (arg === '--model') model = value;
      else timeoutMs = Number(value);
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else task.push(arg);
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000) {
    throw new Error('--timeout-ms must be an integer between 1 and 3600000');
  }
  return { demo, model, timeoutMs, task: task.join(' ').trim() || defaultTask };
}

function loadKey() {
  if (process.env.COMMAND_CODE?.trim()) return process.env.COMMAND_CODE.trim();
  try {
    return parseEnv(readFileSync(resolve(workspace, '.env'), 'utf8')).COMMAND_CODE?.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new Error('Could not read the workspace .env file');
  }
}

async function main() {
  const config = options(process.argv.slice(2));
  if (!config) {
    console.log('Usage: npm start -- [--demo] [--model MODEL] [--timeout-ms 120000] "Your task"');
    return;
  }
  const apiKey = config.demo ? undefined : loadKey();
  if (!config.demo && !apiKey) throw new Error('Set COMMAND_CODE in your environment or the workspace .env file. Use --demo for an offline run.');
  const redact = (value: string) => apiKey ? value.replaceAll(apiKey, '[REDACTED]') : value;
  const json = (value: unknown) => redact(JSON.stringify(value, null, 2));
  const runId = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID().slice(0, 8)}`;
  const directory = resolve(labRoot, 'runs', runId);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const controller = new AbortController();
  const cancel = () => controller.abort(new Error('Cancelled by user'));
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const state: Record<string, unknown> = {
    runId, mode: config.demo ? 'offline-demo' : 'live', task: config.task,
    model: config.demo ? 'scripted-demo' : config.model, endpoint: BASE_URL,
    timeoutMs: config.timeoutMs, status: 'running', agents: {},
  };
  const agents = state.agents as Record<string, unknown>;
  const persist = () => writeFileSync(resolve(directory, 'run.json'), json(state) + '\n', { mode: 0o600 });
  const emit = (event: RunEvent) => {
    appendFileSync(resolve(directory, 'events.jsonl'), redact(JSON.stringify(event)) + '\n', { mode: 0o600 });
    if (event.type === 'text_delta') return;
    agents[event.agent] = { ...(agents[event.agent] as object ?? {}), ...event };
    persist();
    if (event.type === 'agent_started') console.log(`[${event.at}] ${event.agent}: started`);
    if (event.type === 'agent_finished') {
      const result = event.result!;
      const usage = result.usage ? `, ${result.usage.totalTokens} tokens` : '';
      console.log(`[${event.at}] ${event.agent}: finished (${result.durationMs} ms${usage})`);
    }
    if (event.type === 'agent_failed') console.error(redact(`[${event.at}] ${event.agent}: failed: ${event.error}`));
  };
  console.log(redact(`Mode: ${state.mode} | Model: ${state.model}\nRun: ${directory}`));
  persist();
  try {
    let runner: AgentRunner;
    if (config.demo) {
      runner = async (agent, signal) => {
        const start = performance.now();
        emit({ type: 'agent_started', agent: agent.name, at: new Date().toISOString(), input: agent });
        try {
          await delay(100, undefined, { signal });
          const texts: Record<string, string> = {
            designer: 'Use a jobs table with an explicit status, attempt count, and scheduled retry time. A worker claims jobs and records outcomes.',
            reviewer: 'Test duplicate delivery, worker crashes, and exhausted retry limits. Use idempotency keys for external side effects.',
            coordinator: 'Offline scripted example: combine the proposal and checks into a jobs table, worker loop, bounded retries, and idempotent handlers. No model was called.',
          };
          const result = { name: agent.name, text: texts[agent.name], durationMs: Math.round(performance.now() - start) };
          emit({ type: 'agent_finished', agent: agent.name, at: new Date().toISOString(), result });
          return result;
        } catch (error) {
          emit({ type: 'agent_failed', agent: agent.name, at: new Date().toISOString(), error: 'Offline demo cancelled' });
          throw error;
        }
      };
    } else {
      const factory = await createPiFactory(apiKey!, config.model);
      runner = createRunner(factory, emit, config.timeoutMs);
    }
    const output = await runWorkflow(config.task, runner, controller.signal);
    state.status = 'completed';
    state.output = output;
    writeFileSync(resolve(directory, 'final.md'), redact(output.final.text) + '\n', { mode: 0o600 });
    console.log(redact(`\n${output.final.text}\n\nSaved: ${directory}/final.md`));
  } catch (error) {
    state.status = controller.signal.aborted ? 'cancelled' : 'failed';
    state.error = error instanceof Error ? error.message : String(error);
    console.error(redact(`Run ${state.status}: ${state.error}\nPartial results: ${directory}/run.json`));
    process.exitCode = controller.signal.aborted ? 130 : 1;
  } finally {
    state.finishedAt = new Date().toISOString();
    persist();
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}

main().catch((error) => {
  // Unexpected setup failures must not expose SDK objects or credentials.
  console.error(error instanceof Error ? error.message : 'Could not start. Run with --help for usage.');
  process.exitCode = 1;
});
