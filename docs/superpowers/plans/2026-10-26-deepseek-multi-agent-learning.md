# DeepSeek Harness: small multi-agent learning lab

**Goal:** Understand the agent loop, sessions, context, explicit handoffs, and parallel work by running small experiments with the actual DeepSeek Harness. Stop after each experiment to inspect and explain what happened.

**Method:** Predict → run → inspect → explain → change one thing. Keep the examples editable and record the Harness revision, model route, inputs, outputs, and available trace evidence. Distinguish source-level expectations from behavior observed in a real run.

**Scope:** Use Harness capabilities directly. A small host script or configuration is fine where needed to make an experiment runnable; do not build a general-purpose orchestration framework. The lab is educational, not production-ready.

## Setup

- [ ] Choose a Harness version or revision and follow its installation instructions. Record the commands, runtime requirements, and model configuration actually used. Keep credentials outside the repository and traces.
- [ ] Find the supported way to run an agent and inspect its session, tool calls, and relevant request/context information. Record any visibility limitations rather than assuming every raw model request is exposed.
- [ ] Pick a tiny coding task, such as a function with a few example inputs and outputs. Use the same task for the first two experiments.

The earlier source inspection used revision [`22ddee3792402c3e70ec5f86a63c3e3e895a2f60`](https://github.com/deepseek-ai/deepseek-harness/tree/22ddee3792402c3e70ec5f86a63c3e3e895a2f60); check the chosen revision before relying on its APIs. No live Harness run has yet been verified in this workspace.

## 1. One agent

- [ ] Predict the sequence from prompt to final answer, including when the model and tools are called.
- [ ] Run one agent on the small coding task, with a tool call that can be observed.
- [ ] Inspect the available session and trace: prompt, model interactions where visible, tool call and result, and final output. Run a simple check on the produced code.
- [ ] Explain what the model, agent loop, tool, and session each contributed. Change one instruction or tool result and observe what changes.

**Checkpoint:** We can walk through one actual run and identify what is visible and what is not.

## 2. Two agents and an explicit handoff

- [ ] Run a builder on the same task. Pass its code and a short task description explicitly to a fresh reviewer agent.
- [ ] Ask the reviewer for concrete findings, and run the same simple code check independently.
- [ ] Inspect what was sent to the reviewer, what it returned, and which information remained only in the builder's session. If useful, inject a small defect and repeat.

**Checkpoint:** We can show the handoff and explain how separate sessions differ from shared memory. A reviewer saying the code is correct is not itself proof that it works.

## 3. Parallelism and context

- [ ] Give two independent reviewers the same small task. Run them sequentially and then in parallel using supported Harness orchestration. Inspect start/end events and results; report timings as observations from these runs, not a benchmark.
- [ ] Put a synthetic marker in a completed parent turn and compare `spawn` and `fork`. Inspect the available child context evidence and the answers; avoid putting the marker in a file the child could independently read.
- [ ] Explain which information crossed the boundary, what did not, and any limits of the evidence. Change one input and repeat if the result is unclear.

The inspected source describes `spawn` as fresh context and `fork` as inheriting a completed parent-history prefix; verify the selected version and actual run rather than assuming this behavior. See the [spawn](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/subagent/subagent-spawn-in-process/src/index.ts), [fork](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/subagent/subagent-fork-in-process/src/index.ts), and [Workflow](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/workflow/workflow/README.md) sources.

**Checkpoint:** We can explain what ran concurrently and what each child could know, backed by the observed trace where available.

## Optional next experiments

- **Permissions:** Configure one restricted tool call, attempt it, and inspect the denial and resulting state. A role prompt alone is not an enforced permission.
- **Failure:** Make one child fail and observe what the caller receives and how the run ends. Document the behavior; do not build durable recovery unless a later experiment needs it.
- **Agent Teams:** Try a small message or task-board example after the basic handoff works. Teams are experimental; inspect the chosen version's behavior, and do not assume shared workspace file hints enforce isolation. See the [Agent Teams documentation](https://github.com/deepseek-ai/deepseek-harness/blob/22ddee3792402c3e70ec5f86a63c3e3e895a2f60/packages/experimental/agent-team/README.md).

## Working style and deliverables

Keep only the scripts or configuration needed to run the experiments, plus short notes and sanitized traces. Use the smallest supported Harness integration that exposes the mechanism being studied; decide exact files and commands after checking the selected version. Record failures and missing visibility as findings.

Start with experiment 1 and review its trace together before implementing experiment 2. Add isolation, checkpoints, formal schemas, or repeated comparisons only when a specific new question or application requires them.
