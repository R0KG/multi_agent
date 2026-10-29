# DeepSeek Harness lab setup

## Command Code in the terminal

The headless profile uses Command Code's OpenAI-compatible API and the `deepseek/deepseek-v4-flash` model. It reads `COMMAND_CODE` from the environment or the workspace `.env`; the key is not copied to the configuration. From the workspace root:

```sh
python3 harness-lab/run.py 'Reply with exactly: setup works'
python3 harness-lab/run.py --json 'Your task here'
```

The first command returned `setup works` in a live request using an isolated temporary Harness home. Requests use your Command Code API allowance. Sessions and JSON events can contain prompts and tool output; treat them as private. The `--json` option exposes available run events, not necessarily complete raw model requests.

## Web interface

The local installation is pinned to `@deepseek-ai/dsh` 0.2.1-rc.2 in `package-lock.json`. Node.js v26.10.0 was used for the initial setup. From the parent `agent_multi` directory, start the web interface with:

```sh
./harness-lab/node_modules/.bin/dsh web
```

The address is printed in the terminal. In Settings → Models, configure your provider and select a model; then choose the `agent_multi` directory as the workspace. Keep credentials in the Harness home, outside this workspace. See the [provider guide](https://deepseek-harness.github.io/deepseek-harness/en/guide/providers) and [quickstart](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart).

For a CLI experiment, `./harness-lab/node_modules/.bin/dsh headless --help` lists session and JSON event options. Model settings are profile-specific; configuring the web profile does not establish that the headless profile is configured.

The web server and CLI help were checked locally. The web profile has not been configured or tested with Command Code; the terminal setup above is separate. npm warned that several dependency install scripts were not yet approved, including native terminal and subprocess helpers; functionality requiring those helpers has not been verified.

To restore dependencies later, run `npm ci --prefix harness-lab`. If your npm cache is inaccessible, use `npm_config_cache=/private/tmp/agent-multi-npm-cache npm ci --prefix harness-lab`.
