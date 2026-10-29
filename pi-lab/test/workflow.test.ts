import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runWorkflow } from '../src/workflow.js';
import type { AgentResult, AgentRunner } from '../src/agent.js';

function result(name: string): AgentResult {
  return { name, text: `${name} findings`, durationMs: 1 };
}

test('specialists overlap, then coordinator receives only their explicit handoff', async () => {
  const started: string[] = [];
  const releases: (() => void)[] = [];
  let coordinatorPrompt = '';
  const runner: AgentRunner = async (agent) => {
    started.push(agent.name);
    if (agent.name !== 'coordinator') {
      await new Promise<void>((resolve) => releases.push(resolve));
    } else coordinatorPrompt = agent.prompt;
    return result(agent.name);
  };
  const pending = runWorkflow('Design a queue', runner, new AbortController().signal);
  assert.deepEqual(started, ['designer', 'reviewer']);
  releases[0]();
  await Promise.resolve();
  assert.equal(started.length, 2);
  releases[1]();
  const output = await pending;
  assert.deepEqual(started, ['designer', 'reviewer', 'coordinator']);
  assert.match(coordinatorPrompt, /Design a queue/);
  assert.match(coordinatorPrompt, /designer findings/);
  assert.match(coordinatorPrompt, /reviewer findings/);
  assert.equal(output.final.text, 'coordinator findings');
});

test('failure prevents synthesis and waits for the other specialist to settle', async () => {
  let release!: () => void;
  let finished = false;
  const names: string[] = [];
  const runner: AgentRunner = async (agent) => {
    names.push(agent.name);
    if (agent.name === 'designer') throw new Error('provider unavailable');
    await new Promise<void>((resolve) => { release = resolve; });
    return result(agent.name);
  };
  const pending = runWorkflow('task', runner, new AbortController().signal);
  const rejected = assert.rejects(pending, /provider unavailable/).then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  release();
  await rejected;
  assert.deepEqual(names, ['designer', 'reviewer']);
});

test('already cancelled workflow does not start agents', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled'));
  await assert.rejects(runWorkflow('task', async () => {
    assert.fail('must not start');
  }, controller.signal), /cancelled/);
});
