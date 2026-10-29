# Pi orchestration MVP

Three independent Pi sessions, coordinated by ordinary TypeScript:

```text
task ──┬── designer ──┐
       └── reviewer ──┴── coordinator ── final.md
```

The designer proposes a solution. The reviewer independently checks the original
task for risks; it does not see the designer's answer. The coordinator receives
the task and both final answers as JSON. The program explicitly schedules all
three sessions; no parent model decides when to spawn them.

## Run

Node.js 22.19 or newer is required. From `pi-lab/`:

```sh
npm ci
npm run demo
npm start -- "Design a minimal background job queue"
npm start -- --timeout-ms 60000 "Explain a safe retry strategy"
npm test
npm run check
```

`demo` uses scripted results, makes no model requests, and needs no key. Its
example answers are fixed even if you supply another task. Live runs read
`COMMAND_CODE` from the environment first, otherwise from the workspace root
`.env`. The key stays in memory and is never copied to Pi's credential files.

The default live model is `deepseek/deepseek-v4-flash` at
`https://api.commandcode.ai/provider/v1`. `--model` accepts another model that
supports OpenAI Chat Completions at that endpoint. Anthropic models need a
different API configuration; changing only the model ID is insufficient.

Each live agent has a 120-second deadline and a configured 1536-token output
limit. These are conservative lab settings. Pi may retry transient errors once
at the session layer; the underlying provider transport may also retry.
Ctrl+C aborts active agents and exits nonzero. An unsuccessful specialist prevents
synthesis; the other specialist is allowed to settle so partial work is retained.

## Inspect a run

Each invocation creates `runs/<timestamp>-<id>/`:

| File | Contents |
| --- | --- |
| `run.json` | Task, model, status, role prompts, explicit inputs, effective system prompts, results, duration, and available token usage |
| `events.jsonl` | Timestamped lifecycle events and streamed text deltas |
| `final.md` | Coordinator's final answer, written only on success |

Artifacts persist as agents finish, including on failure. The configured key is
redacted before writing artifacts. Prompts and answers can contain private task
data, so `runs/` is ignored by Git. These are application-level traces, not raw
HTTP captures or a complete SDK event stream. Dollar costs are not estimated.

## Change the workflow

- **[`src/workflow.ts`](src/workflow.ts):** edit roles, prompts, parallel starts,
  and the coordinator handoff. This is the main orchestration code to learn from.
- **[`src/pi.ts`](src/pi.ts):** model/provider configuration and session creation.
- **[`src/agent.ts`](src/agent.ts):** lifecycle events, deadline, cancellation,
  result checking, and cleanup.
- **[`src/cli.ts`](src/cli.ts):** arguments, credentials, progress, and artifacts.

Try predicting which agents start first, then inspect event timestamps. Next,
remove one analysis from the coordinator's input and inspect that input in
`run.json`. Change one thing per run so its effect is observable.

All sessions have tools disabled. They do not browse, run commands, inspect the
repository, or modify files. Resource discovery is disabled; the effective system
prompt contains the chosen role plus Pi's working-directory metadata. Conversation
history is in memory; the application persists inspection artifacts separately.

## Verification and limits

Automated tests cover parallelism, explicit handoffs, failure gating, cancellation,
timeouts, SDK error handling, and actual SDK configuration without inference.
The offline demo exercises the CLI and artifacts.

The live smoke test on 2026-10-29 completed through Command Code using
`deepseek/deepseek-v4-flash` for all three sessions. The two specialists finished
in about 6.8 and 6.9 seconds, followed by the coordinator in about 9.1 seconds.
Artifact checks confirmed overlapping specialist runs, exact answer handoff,
three successful results, `completed` status, and a nonempty `final.md`.
An earlier attempt received HTTP 401; the subsequent retry succeeded.
To repeat the smoke test, run `npm start` and inspect the resulting run directory.

This MVP does not implement automatic crash recovery, workflow resume, tool
sandboxing, distributed workers, or a production service. A failed run must be
started again. Adding tools requires deliberate changes to session configuration.

References: [Pi SDK](https://pi.dev/docs/latest/sdk),
[Command Code Provider API](https://commandcode.ai/blog/command-code-provider-api).
