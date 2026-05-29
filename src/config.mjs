import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./fs-utils.mjs";

const configNames = ["replayforge.config.json", ".replayforgerc.json"];

export async function loadConfig(cwd, explicitPath) {
  const configPath = await findConfig(cwd, explicitPath);
  if (!configPath) {
    return defaultConfig();
  }

  const raw = await readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  return normalizeConfig(parsed);
}

export async function writeDefaultConfig(configPath, profile) {
  const config = defaultConfig(profile);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

async function findConfig(cwd, explicitPath) {
  if (explicitPath) {
    const fullPath = path.resolve(cwd, explicitPath);
    return (await pathExists(fullPath)) ? fullPath : null;
  }

  for (const name of configNames) {
    const fullPath = path.resolve(cwd, name);
    if (await pathExists(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function normalizeConfig(config) {
  return {
    ...defaultConfig(),
    ...config,
    project: {
      ...defaultConfig().project,
      ...(config.project ?? {})
    },
    capture: {
      ...defaultConfig().capture,
      ...(config.capture ?? {})
    },
    explain: {
      ...defaultConfig().explain,
      ...(config.explain ?? {})
    }
  };
}

function defaultConfig(profile = {}) {
  return {
    mode: "hybrid",
    outputDir: "assets/replayforge",
    project: {
      name: profile.name ?? "ReplayForge Project",
      tagline: profile.description ?? "Generate polished README demos automatically."
    },
    explain: {
      includeFiles: ["README.md", "package.json", "src"],
      maxHighlights: 5
    },
    capture: {
      kind: profile.type === "web" ? "browser" : "terminal",
      commands: profile.runCommands?.length ? profile.runCommands.slice(0, 2) : ["npm run demo"],
      url: "http://localhost:3000",
      actions: []
    },
    readme: {
      title: "Demo",
      insertStart: "<!-- replayforge:start -->",
      insertEnd: "<!-- replayforge:end -->"
    }
  };
}
