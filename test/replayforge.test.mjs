import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { githubSlug, parseOptions } from "../src/cli.mjs";
import { analyzeProject } from "../src/project-analyzer.mjs";
import { planDemo } from "../src/demo-planner.mjs";
import { composeReadmeSection } from "../src/readme-composer.mjs";

const profile = {
  name: "sample-project",
  description: "A sample project",
  type: "cli",
  installCommands: ["npm install"],
  runCommands: ["npm run demo"],
  highlights: ["Fast setup", "Readable demos"],
  files: ["README.md", "src/index.js"]
};

test("hybrid mode explains first and captures second", () => {
  const storyboard = planDemo({
    profile,
    config: {
      mode: "hybrid",
      project: { tagline: "Sample tagline" },
      explain: { maxHighlights: 2 },
      capture: { kind: "terminal" }
    },
    captureResult: {
      kind: "terminal",
      transcript: ["$ npm run demo", "done"]
    }
  });

  assert.equal(storyboard.mode, "hybrid");
  assert.equal(storyboard.scenes[0].eyebrow, "Explain");
  assert.equal(storyboard.scenes[2].eyebrow, "Capture");
  assert.equal(storyboard.scenes.at(-1).eyebrow, "Export");
});

test("readme section points at generated root-relative asset", () => {
  const storyboard = planDemo({
    profile,
    config: { mode: "explain", project: {}, explain: {} },
    captureResult: null
  });

  const markdown = composeReadmeSection({
    profile,
    config: {
      outputDir: "assets/replayforge",
      readme: { title: "Demo" }
    },
    storyboard
  });

  assert.match(markdown, /!\[sample-project demo\]\(\.\/assets\/replayforge\/demo\.svg\)/);
  assert.match(markdown, /npm install/);
  assert.match(markdown, /npm run demo/);
});

test("github urls become stable output slugs", () => {
  assert.equal(githubSlug("https://github.com/whut09/ReplayForge"), "whut09-ReplayForge");
  assert.equal(githubSlug("https://github.com/whut09/ReplayForge.git"), "whut09-ReplayForge");
  assert.equal(githubSlug("git@github.com:whut09/ReplayForge.git"), "whut09-ReplayForge");
});

test("unknown allow-run typo is rejected", () => {
  assert.throws(
    () => parseOptions(["https://github.com/whut09/allTranslate", "--allow-ru"]),
    /Did you mean "--allow-run"/
  );
});

test("python projects use README commands for quick start but not capture", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "replayforge-python-"));
  try {
    await writeFile(path.join(dir, "pyproject.toml"), `[project]
name = "paper-tool"
description = "Short package description"

[project.scripts]
paper-tool = "paper_tool.cli:main"
`);
    await writeFile(path.join(dir, "README.md"), `# paper-tool

Readable README description.

\`\`\`bash
pip install -e .
paper-tool input.pdf -o output
paper-tool -i
\`\`\`
`);

    const analyzed = await analyzeProject(dir);
    assert.equal(analyzed.name, "paper-tool");
    assert.equal(analyzed.description, "Readable README description.");
    assert.deepEqual(analyzed.runCommands, ["paper-tool input.pdf -o output", "paper-tool -i"]);
    assert.deepEqual(analyzed.captureCommands, []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
