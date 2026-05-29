import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runCapture(cwd, config) {
  const capture = config.capture ?? {};
  if (capture.kind === "browser") {
    return {
      kind: "browser",
      url: capture.url,
      actions: capture.actions ?? [],
      transcript: [`Open ${capture.url}`, ...(capture.actions ?? []).map((action) => describeAction(action))]
    };
  }

  const commands = (capture.commands ?? []).slice(0, 4);
  const transcript = [];

  for (const command of commands) {
    transcript.push(`$ ${command}`);
    try {
      const result = await runCommand(command, cwd);
      const output = `${result.stdout}${result.stderr}`.trim();
      transcript.push(output ? truncate(output, 1200) : "(command completed)");
    } catch (error) {
      const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
      transcript.push(output ? truncate(output, 1200) : `(command failed: ${error.message})`);
    }
  }

  return {
    kind: "terminal",
    commands,
    transcript
  };
}

async function runCommand(command, cwd) {
  const shell = process.platform === "win32" ? "cmd.exe" : "sh";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-lc", command];
  return execFileAsync(shell, args, {
    cwd,
    env: {
      ...process.env,
      REPLAYFORGE_NO_CAPTURE: "1"
    },
    timeout: 20_000,
    maxBuffer: 1024 * 1024
  });
}

function describeAction(action) {
  if (typeof action === "string") {
    return action;
  }
  return Object.entries(action)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
}

function truncate(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}\n...` : text;
}
