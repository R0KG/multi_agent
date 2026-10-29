# Pi orchestration MVP

Build a small, editable TypeScript CLI in `pi-lab/`. The user explicitly requested
a Pi MVP and authorized using the existing Command Code API key. Run two specialist
sessions concurrently, then pass only their final answers to a coordinator session.
Use the existing Command Code endpoint and model, loading `COMMAND_CODE` from the
environment or workspace `.env` without copying or displaying the secret.

## Approach

Use Pi SDK in process with ordinary TypeScript scheduling. This follows the selected
Pi-only approach; RPC adds an unnecessary process protocol for this TypeScript MVP,
and a durable workflow engine adds infrastructure beyond the current requirement.
CLI is the implementation choice for making execution easy to inspect and edit.

## Behavior

- Accept a quoted task; provide a harmless default task and offline demo mode.
- Keep each agent's context independent; use explicit system prompts and handoffs.
- Disable tools and automatic resource discovery; send only the task and handoffs.
- Show agent start/completion/error progress, elapsed time, and available usage.
- Save prompts, answers, events, status, and final Markdown under ignored `runs/`.
- Use a per-agent deadline, Ctrl+C cancellation, cleanup, and nonzero failure exits.
- Do not run synthesis if a specialist fails; retain successful partial results.
- Include focused tests for concurrency, handoff ordering, cancellation, and failure.

This is an orchestration MVP, not automatic crash recovery. Persisted artifacts
are for inspection; resume, sandboxed tool execution, web UI, and distributed workers
are outside its scope.
