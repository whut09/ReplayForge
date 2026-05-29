import test from "node:test";
import assert from "node:assert/strict";
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
