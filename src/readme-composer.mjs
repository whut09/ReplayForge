export function composeReadmeSection({ profile, config, storyboard }) {
  const title = config.readme?.title ?? "Demo";
  const start = config.readme?.insertStart ?? "<!-- replayforge:start -->";
  const end = config.readme?.insertEnd ?? "<!-- replayforge:end -->";
  const assetPath = `./${(config.outputDir ?? "assets/replayforge").replaceAll("\\", "/")}/demo.svg`;
  const install = profile.installCommands?.[0];
  const run = profile.runCommands?.[0] ?? config.capture?.commands?.[0];

  const lines = [
    start,
    `## ${title}`,
    "",
    `![${profile.name} demo](${assetPath})`,
    "",
    storyboard.summary || profile.description || "ReplayForge generated this project demo from configuration, code and runtime signals.",
    ""
  ];

  if (install || run) {
    lines.push("### Quick Start", "");
    lines.push("```bash");
    if (install) {
      lines.push(install);
    }
    if (run) {
      lines.push(run);
    }
    lines.push("```", "");
  }

  lines.push("### What ReplayForge Generated", "");
  for (const scene of storyboard.scenes) {
    lines.push(`- **${scene.eyebrow}: ${scene.title}** - ${scene.body}`);
  }
  lines.push("", end, "");
  return lines.join("\n");
}
