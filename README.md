# Agent orchestration experiments

Start with [pi-lab](pi-lab/README.md): an editable TypeScript workflow using
Pi SDK and the Command Code Provider API.

```sh
cd pi-lab
npm ci
npm run demo
```

To call the real model, set `COMMAND_CODE` in your environment or copy the root
`.env.example` to `.env` and fill it in. Then:

```sh
npm start -- "Design a minimal background job queue"
```

The live run uses your Command Code API allowance. `.env`, dependencies, and
run artifacts are ignored by Git. Keep keys out of source files and commits.

The earlier [DeepSeek Harness lab](harness-lab/README.md) remains a separate
experiment. It is not used by the Pi workflow.
