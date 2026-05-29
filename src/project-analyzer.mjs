import path from "node:path";
import { listFiles, readJsonIfExists, readTextIfExists } from "./fs-utils.mjs";

export async function analyzeProject(cwd) {
  const packageJson = await readJsonIfExists(path.join(cwd, "package.json"));
  const pyproject = await readTextIfExists(path.join(cwd, "pyproject.toml"));
  const readme = await readTextIfExists(path.join(cwd, "README.md"));
  const files = await listFiles(cwd);
  const type = detectProjectType({ packageJson, files });
  const runCommands = detectRunCommands({ packageJson, pyproject, readme, type });
  const captureCommands = detectCaptureCommands({ packageJson, type });
  const installCommands = detectInstallCommands(files, packageJson);
  const highlights = extractHighlights({ readme, packageJson, files });

  return {
    name: packageJson?.name ?? pyprojectValue(pyproject, "name") ?? path.basename(cwd),
    description: packageJson?.description ?? extractReadmeIntro(readme) ?? pyprojectValue(pyproject, "description") ?? "",
    type,
    installCommands,
    runCommands,
    captureCommands,
    highlights,
    files: files.slice(0, 40),
    detectedAt: new Date().toISOString()
  };
}

function detectProjectType({ packageJson, files }) {
  const deps = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies
  };
  if (packageJson?.bin) {
    return "cli";
  }
  if (deps.next || deps.vite || deps.react || deps.vue || deps.svelte) {
    return "web";
  }
  if (files.some((file) => file === "pyproject.toml" || file.endsWith(".py"))) {
    return "python";
  }
  if (files.includes("Cargo.toml")) {
    return "rust";
  }
  if (files.includes("go.mod")) {
    return "go";
  }
  return "library";
}

function detectRunCommands({ packageJson, pyproject, readme, type }) {
  const scripts = packageJson?.scripts ?? {};
  const candidates = [];
  for (const script of ["demo", "dev", "start", "generate", "build", "test"]) {
    if (scripts[script]) {
      candidates.push(`npm run ${script}`);
    }
  }
  if (!candidates.length && type === "cli" && packageJson?.bin) {
    const binName = typeof packageJson.bin === "string" ? packageJson.name : Object.keys(packageJson.bin)[0];
    candidates.push(`npx ${binName} --help`);
  }
  if (!candidates.length && type === "python") {
    const projectScripts = pyprojectScriptNames(pyproject);
    candidates.push(...readmeCommands(readme).filter((command) => {
      return projectScripts.some((script) => command === script || command.startsWith(`${script} `));
    }));
  }
  return candidates;
}

function detectCaptureCommands({ packageJson }) {
  const scripts = packageJson?.scripts ?? {};
  return ["demo", "start", "generate", "test"]
    .filter((script) => scripts[script])
    .map((script) => `npm run ${script}`);
}

function detectInstallCommands(files, packageJson) {
  if (files.includes("pnpm-lock.yaml")) {
    return ["pnpm install"];
  }
  if (files.includes("bun.lockb") || files.includes("bun.lock")) {
    return ["bun install"];
  }
  if (files.includes("yarn.lock")) {
    return ["yarn install"];
  }
  if (files.includes("package-lock.json") || files.includes("package.json") || packageJson) {
    return ["npm install"];
  }
  if (files.includes("pyproject.toml")) {
    return ["pip install -e ."];
  }
  return [];
}

function readmeCommands(readme) {
  if (!readme) {
    return [];
  }

  const commands = [];
  const codeBlockPattern = /```(?:bash|sh|shell|zsh)?\r?\n([\s\S]*?)```/gi;
  let match;
  while ((match = codeBlockPattern.exec(readme))) {
    for (const line of match[1].split(/\r?\n/)) {
      const command = line.trim().replace(/^\$\s*/, "");
      if (command && !command.startsWith("#") && !isInstallCommand(command)) {
        commands.push(command);
      }
    }
  }
  return [...new Set(commands)].slice(0, 4);
}

function isInstallCommand(command) {
  return /^(npm|pnpm|yarn|bun|pip|uv|poetry)\s+(install|add|sync)/.test(command);
}

function pyprojectScriptNames(pyproject) {
  const section = tomlSection(pyproject, "project.scripts");
  if (!section) {
    return [];
  }
  return section
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z0-9_.-]+)\s*=/)?.[1])
    .filter(Boolean);
}

function pyprojectValue(pyproject, key) {
  const section = tomlSection(pyproject, "project");
  const match = section?.match(new RegExp(`^${key}\\s*=\\s*["']([^"']+)["']`, "m"));
  return match?.[1] ?? null;
}

function tomlSection(toml, sectionName) {
  if (!toml) {
    return "";
  }
  const lines = toml.split(/\r?\n/);
  const collected = [];
  let inSection = false;
  for (const line of lines) {
    const heading = line.trim().match(/^\[([^\]]+)\]$/);
    if (heading) {
      if (inSection) {
        break;
      }
      inSection = heading[1] === sectionName;
      continue;
    }
    if (inSection) {
      collected.push(line);
    }
  }
  return collected.join("\n");
}

function extractHighlights({ readme, packageJson, files }) {
  const highlights = [];
  if (packageJson?.description) {
    highlights.push(packageJson.description);
  }
  const intro = extractReadmeIntro(readme);
  if (intro) {
    highlights.push(intro);
  }

  if (readme) {
    const bullets = readme
      .split(/\r?\n/)
      .filter((line) => /^[-*]\s+/.test(line.trim()))
      .map((line) => line.replace(/^[-*]\s+/, "").trim())
      .filter(Boolean)
      .slice(0, 4);
    highlights.push(...bullets);
  }

  if (files.some((file) => file.startsWith("examples/"))) {
    highlights.push("Includes runnable examples for quick demos.");
  }
  if (files.some((file) => file.startsWith("docs/"))) {
    highlights.push("Includes documentation that can be transformed into explanation scenes.");
  }

  return [...new Set(highlights)].slice(0, 6);
}

function extractReadmeIntro(readme) {
  if (!readme) {
    return null;
  }
  return readme
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#") && !line.startsWith("![")) ?? null;
}
