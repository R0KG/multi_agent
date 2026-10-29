import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRunner, type SessionLike } from '../src/agent.js';

const spec = { name: 'test', systemPrompt: 'test role', prompt: 'test input' };
function fakeSession(overrides: Partial<SessionLike> = {}) {
  let disposed = false;
  let aborted = false;
  const session: SessionLike = {
    messages: [{ role: 'assistant', stopReason: 'stop' }],
    subscribe: () => () => {},
    prompt: async () => {},
    abort: async () => { aborted = true; },
    dispose: () => { disposed = true; },
    getLastAssistantText: () => 'answer',
    ...overrides,
  };
  return { session, disposed: () => disposed, aborted: () => aborted };
}

test('returns final answer and disposes session', async () => {
  const fake = fakeSession();
  const runner = createRunner(async () => fake.session, () => {}, 1000);
  assert.equal((await runner(spec, new AbortController().signal)).text, 'answer');
  assert.equal(fake.disposed(), true);
});

test('SDK error messages fail even when prompt resolves and text exists', async () => {
  const fake = fakeSession({ messages: [{ role: 'assistant', stopReason: 'error', errorMessage: 'HTTP 401' }] });
  const runner = createRunner(async () => fake.session, () => {}, 1000);
  await assert.rejects(runner(spec, new AbortController().signal), /HTTP 401/);
  assert.equal(fake.disposed(), true);
});

test('deadline aborts a running session and releases resources', async () => {
  let release!: () => void;
  const fake = fakeSession({
    prompt: () => new Promise<void>((resolve) => { release = resolve; }),
    abort: async () => release(),
  });
  const runner = createRunner(async () => fake.session, () => {}, 20);
  await assert.rejects(runner(spec, new AbortController().signal), /timed out/);
  assert.equal(fake.disposed(), true);
});

test('parent cancellation aborts an active session', async () => {
  const controller = new AbortController();
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  const fake = fakeSession({
    prompt: () => { started(); return new Promise<void>((resolve) => { release = resolve; }); },
    abort: async () => release(),
  });
  const runner = createRunner(async () => fake.session, () => {}, 1000);
  const pending = runner(spec, controller.signal);
  await ready;
  controller.abort(new Error('cancelled by user'));
  await assert.rejects(pending, /cancelled by user/);
  assert.equal(fake.disposed(), true);
});
