export function planDemo({ profile, config, captureResult }) {
  const mode = config.mode ?? "hybrid";
  const scenes = [];

  if (mode === "explain" || mode === "hybrid") {
    scenes.push(...explainScenes(profile, config));
  }

  if (mode === "capture" || mode === "hybrid") {
    scenes.push(...captureScenes(profile, config, captureResult));
  }

  scenes.push({
    id: "readme-ready",
    title: "README-ready output",
    eyebrow: "Export",
    body: "ReplayForge writes a reusable README section plus a browser-ready presentation asset.",
    bullets: ["README.demo.md", "demo.svg", "demo.html", "storyboard.json"],
    visual: "readme"
  });

  return {
    mode,
    project: profile.name,
    summary: config.project?.tagline || profile.description,
    scenes
  };
}

function explainScenes(profile, config) {
  const highlights = (profile.highlights?.length ? profile.highlights : [
    "Scans project metadata, documentation, examples and source structure.",
    "Turns project facts into a clear visual explanation.",
    "Keeps README demo content reproducible through config."
  ]).slice(0, config.explain?.maxHighlights ?? 5);

  return [
    {
      id: "project-value",
      title: profile.name,
      eyebrow: "Explain",
      body: config.project?.tagline || profile.description || "ReplayForge explains what this project does before showing it in action.",
      bullets: highlights,
      visual: "overview"
    },
    {
      id: "project-understanding",
      title: "Code and docs become scenes",
      eyebrow: "Analyze",
      body: "The generator reads common project files and promotes the strongest facts into a storyboard.",
      bullets: [
        `Detected type: ${profile.type}`,
        `Install: ${profile.installCommands[0] ?? "custom command"}`,
        `Files sampled: ${profile.files.length}`
      ],
      visual: "files"
    }
  ];
}

function captureScenes(profile, config, captureResult) {
  if (captureResult?.kind === "browser") {
    return [
      {
        id: "browser-capture",
        title: "Real browser flow",
        eyebrow: "Capture",
        body: "ReplayForge can open the project URL and turn important UI states into demo scenes.",
        bullets: captureResult.transcript,
        visual: "browser"
      }
    ];
  }

  const transcript = captureResult?.transcript?.length
    ? captureResult.transcript
    : ["Configure capture.commands to record the real terminal flow."];

  return [
    {
      id: "terminal-capture",
      title: "Real command output",
      eyebrow: "Capture",
      body: "ReplayForge captures the commands users should trust most: install, run, generate and verify.",
      bullets: transcript.slice(0, 8),
      visual: "terminal"
    }
  ];
}
