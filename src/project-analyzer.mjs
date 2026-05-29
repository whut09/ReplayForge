import path from "node:path";
import { listFiles, readJsonIfExists, readTextIfExists } from "./fs-utils.mjs";

export async function analyzeProject(cwd) {
  const packageJson = await readJsonIfExists(path.join(cwd, "package.json"));
  const readme = await readTextIfExists(path.join(cwd, "README.md"));
  const files = await listFiles(cwd);
  const type = detectProjectType({ packageJson, files });
  const runCommands = detectRunCommands(packageJson, type);
  const installCommands = detectInstallCommands(files, packageJson);
  const highlights = extractHighlights({ readme, packageJson, files });

  return {
    name: packageJson?.name ?? path.basename(cwd),
    description: packageJson?.description ?? extractReadmeIntro(readme) ?? "",
    type,
    installCommands,
    runCommands,
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

function detectRunCommands(packageJson, type) {
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
  return candidates;
}

function detectInstallCommands(files) {
  if (files.includes("pnpm-lock.yaml")) {
    return ["pnpm install"];
  }
  if (files.includes("bun.lockb") || files.includes("bun.lock")) {
    return ["bun install"];
  }
  if (files.includes("yarn.lock")) {
    return ["yarn install"];
  }
  if (files.includes("package-lock.json") || files.includes("package.json")) {
    return ["npm install"];
  }
  if (files.includes("pyproject.toml")) {
    return ["pip install -e ."];
  }
  return [];
}

function extractHighlights({ readme, packageJson, files }) {
  const highlights = [];
  if (packageJson?.description) {
    highlights.push(packageJson.description);
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
