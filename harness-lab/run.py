#!/usr/bin/env python3
"""Start the headless Harness using COMMAND_CODE from the workspace .env."""
import os
from pathlib import Path
import shlex
import sys

root = Path(__file__).resolve().parent.parent
env = os.environ.copy()
if not env.get("COMMAND_CODE"):
    for line in (root / ".env").read_text().splitlines():
        key, separator, value = line.strip().removeprefix("export ").partition("=")
        if separator and key.strip() == "COMMAND_CODE":
            parts = shlex.split(value, comments=True)
            if len(parts) == 1:
                env["COMMAND_CODE"] = parts[0]
            break
if not env.get("COMMAND_CODE"):
    sys.exit("Set COMMAND_CODE in .env or in your environment.")
os.chdir(root)
os.execve(str(root / "harness-lab/node_modules/.bin/dsh"),
          ["dsh", "--profile", "headless", "--patch", str(root / "harness-lab/command-code.yml"), *sys.argv[1:]], env)
