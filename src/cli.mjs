import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { analyzeProject } from "./project-analyzer.mjs";
import { loadConfig, writeDefaultConfig } from "./config.mjs";
import { planDemo } from "./demo-planner.mjs";
import { composeReadmeSection } from "./readme-composer.mjs";
import { renderPresentationHtml, renderAnimatedSvg } from "./presentation-renderer.mjs";
import { runCapture } from "./capture-runner.mjs";
import { ensureDir, pathExists, readJsonIfExists } from "./fs-utils.mjs";

const commands = new Set(["init", "analyze", "generate", "record"]);
const execFileAsync = promisify(execFile);

export async function main(argv) {
  const args = argv.slice(2);
  const command = commands.has(args[0]) ? args.shift() : "generate";
  const cwd = process.cwd();
  const options = parseOptions(args);

  if (command === "init") {
    await initCommand(cwd, options);
    return;
  }

  if (command === "analyze") {
    const target = options.target ? await resolveTarget(cwd, options.target) : { cwd };
    const profile = await analyzeProject(target.cwd);
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  if (command === "generate") {
    await generateCommand(cwd, options);
    return;
  }

  if (command === "record") {
    await recordCommand(cwd, options);
  }
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--mode" || arg === "-m") {
      options.mode = args[index + 1];
      index += 1;
    } else if (arg === "--config" || arg === "-c") {
      options.configPath = args[index + 1];
      index += 1;
    } else if (arg === "--out" || arg === "-o") {
      options.outputDir = args[index + 1];
      index += 1;
    } else if (arg === "--allow-run") {
      options.allowRun = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (!arg.startsWith("-") && !options.target) {
      options.target = arg;
    }
  }
  return options;
}

function printHelp() {
  console.log(`ReplayForge

Usage:
  replayforge init
  replayforge analyze [github-url|local-path]
  replayforge generate [github-url|local-path] [--mode capture|explain|hybrid]
  replayforge record

Modes:
  capture  Record or summarize real project runtime behavior.
  explain  Read code and docs to build an explanation animation.
  hybrid   Explain the project first, then show runtime behavior. Default.

Remote repositories:
  replayforge generate https://github.com/owner/repo
  replayforge generate https://github.com/owner/repo --mode explain
  replayforge generate https://github.com/owner/repo --allow-run

By default, ReplayForge does not execute commands from cloned remote repos.
Use --allow-run only for repositories you trust.
`);
}

async function initCommand(cwd, options) {
  const configPath = resolveConfigPath(cwd, options.configPath);
  if (await pathExists(configPath)) {
    console.log(`Config already exists: ${path.relative(cwd, configPath)}`);
    return;
  }

  const profile = await analyzeProject(cwd);
  await writeDefaultConfig(configPath, profile);
  console.log(`Created ${path.relative(cwd, configPath)}`);
}

async function generateCommand(cwd, options) {
  const target = options.target ? await resolveTarget(cwd, options.target) : { cwd };
  const config = await loadConfig(target.cwd, options.configPath);
  if (options.mode) {
    config.mode = options.mode;
  }
  if (options.outputDir) {
    config.outputDir = options.outputDir;
  }
  validateMode(config.mode);

  const remoteNeedsPermission = target.kind === "remote" && !options.allowRun;
  const profile = await analyzeProject(target.cwd);
  const captureResult = shouldCapture(config.mode) && !process.env.REPLAYFORGE_NO_CAPTURE && !remoteNeedsPermission
    ? await runCapture(target.cwd, config)
    : skippedCapture(config, remoteNeedsPermission);
  const storyboard = planDemo({ profile, config, captureResult });
  const outputDir = target.kind === "remote" && !options.outputDir
    ? path.join("assets/replayforge", target.slug)
    : config.outputDir ?? "assets/replayforge";
  config.outputDir = outputDir;
  const outputRoot = path.resolve(cwd, outputDir);
  const internalRoot = path.resolve(cwd, ".replayforge", target.slug ?? "local");

  await ensureDir(outputRoot);
  await ensureDir(internalRoot);

  const readmeSection = composeReadmeSection({ profile, config, storyboard });
  const html = renderPresentationHtml({ profile, config, storyboard });
  const svg = renderAnimatedSvg({ profile, config, storyboard });

  await writeFile(path.join(outputRoot, "README.demo.md"), readmeSection);
  await writeFile(path.join(outputRoot, "demo.html"), html);
  await writeFile(path.join(outputRoot, "demo.svg"), svg);
  await writeFile(path.join(internalRoot, "storyboard.json"), JSON.stringify(storyboard, null, 2));
  await writeFile(path.join(internalRoot, "profile.json"), JSON.stringify(profile, null, 2));

  console.log(`Generated ${path.relative(cwd, outputRoot)}`);
  console.log(`Mode: ${config.mode}`);
  if (target.kind === "remote" && remoteNeedsPermission && shouldCapture(config.mode)) {
    console.log("Remote capture commands were not executed. Re-run with --allow-run for trusted repositories.");
  }
  console.log(`README section: ${path.relative(cwd, path.join(outputRoot, "README.demo.md"))}`);
  console.log(`Animated demo: ${path.relative(cwd, path.join(outputRoot, "demo.svg"))}`);
  console.log(`Presentation: ${path.relative(cwd, path.join(outputRoot, "demo.html"))}`);
}

async function recordCommand(cwd, options) {
  const config = await loadConfig(cwd, options.configPath);
  const storyboardPath = path.resolve(cwd, ".replayforge/storyboard.json");
  const storyboard = await readJsonIfExists(storyboardPath);
  const outputRoot = path.resolve(cwd, options.outputDir ?? config.outputDir ?? "assets/replayforge");

  if (!storyboard) {
    await generateCommand(cwd, options);
    return;
  }

  await mkdir(outputRoot, { recursive: true });
  const plan = {
    status: "ready",
    message: "Open demo.html in a browser or wire this plan to Playwright/ffmpeg for mp4/gif export.",
    input: path.relative(cwd, path.join(outputRoot, "demo.html")),
    recommendedOutputs: ["demo.mp4", "demo.gif"],
    scenes: storyboard.scenes.map((scene) => scene.title)
  };

  await writeFile(path.join(outputRoot, "recording-plan.json"), JSON.stringify(plan, null, 2));
  console.log(`Created recording plan: ${path.relative(cwd, path.join(outputRoot, "recording-plan.json"))}`);
}

function shouldCapture(mode) {
  return mode === "capture" || mode === "hybrid";
}

function validateMode(mode) {
  if (!["capture", "explain", "hybrid"].includes(mode)) {
    throw new Error(`Unsupported mode "${mode}". Use capture, explain, or hybrid.`);
  }
}

function resolveConfigPath(cwd, explicitPath) {
  return path.resolve(cwd, explicitPath ?? "replayforge.config.json");
}

async function resolveTarget(cwd, target) {
  if (isGitHubTarget(target)) {
    return cloneGitHubTarget(cwd, target);
  }

  const targetPath = path.resolve(cwd, target);
  if (!(await pathExists(targetPath))) {
    throw new Error(`Target does not exist: ${target}`);
  }
  return {
    kind: "local-path",
    cwd: targetPath,
    slug: path.basename(targetPath)
  };
}

function isGitHubTarget(target) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+/.test(target)
    || /^git@github\.com:[^/\s]+\/[^/\s]+/.test(target);
}

async function cloneGitHubTarget(cwd, url) {
  const slug = githubSlug(url);
  const remotesRoot = path.resolve(cwd, ".replayforge/remotes");
  const cloneDir = path.join(remotesRoot, slug);
  await ensureDir(remotesRoot);
  await safeRemoveInside(remotesRoot, cloneDir);
  await execFileAsync("git", ["clone", "--depth", "1", url, cloneDir], {
    cwd,
    timeout: 120_000,
    maxBuffer: 1024 * 1024
  });
  return {
    kind: "remote",
    cwd: cloneDir,
    slug,
    url
  };
}

export function githubSlug(url) {
  const normalized = url
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "");
  const match = normalized.match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/);
  if (!match) {
    throw new Error(`Unsupported GitHub URL: ${url}`);
  }
  return `${match[1]}-${match[2]}`.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function safeRemoveInside(parent, target) {
  const resolvedParent = path.resolve(parent);
  const resolvedTarget = path.resolve(target);
  if (!resolvedTarget.startsWith(`${resolvedParent}${path.sep}`)) {
    throw new Error(`Refusing to remove path outside ${resolvedParent}`);
  }
  await rm(resolvedTarget, { recursive: true, force: true });
}

function skippedCapture(config, remoteNeedsPermission) {
  if (!shouldCapture(config.mode)) {
    return null;
  }
  if (!remoteNeedsPermission) {
    return null;
  }
  return {
    kind: config.capture?.kind ?? "terminal",
    transcript: [
      "Remote repository cloned and analyzed.",
      "Runtime commands were skipped for safety.",
      "Re-run with --allow-run to execute capture commands for a trusted repository."
    ]
  };
}
