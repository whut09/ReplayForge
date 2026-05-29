export function renderPresentationHtml({ profile, config, storyboard }) {
  const sceneCards = storyboard.scenes.map((scene, index) => renderHtmlScene(scene, index)).join("\n");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(profile.name)} ReplayForge Demo</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #101214;
        --panel: #1b1f23;
        --text: #f5f7fa;
        --muted: #b9c0c7;
        --accent: #42d392;
        --accent-2: #7aa2ff;
        --line: #30363d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(100vw, 1280px);
        aspect-ratio: 16 / 9;
        position: relative;
        overflow: hidden;
        background: linear-gradient(135deg, #101214 0%, #18202a 50%, #13191d 100%);
        border: 1px solid var(--line);
      }
      .brand {
        position: absolute;
        top: 34px;
        left: 48px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--muted);
        font-size: 18px;
      }
      .mark {
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
      }
      .scene {
        position: absolute;
        inset: 96px 64px 56px;
        display: grid;
        grid-template-columns: 0.95fr 1.05fr;
        gap: 36px;
        opacity: 0;
        transform: translateY(18px);
        animation: scene ${storyboard.scenes.length * 5}s infinite;
      }
      ${storyboard.scenes.map((_, index) => `.scene-${index} { animation-delay: ${index * 5}s; }`).join("\n      ")}
      @keyframes scene {
        0%, 6% { opacity: 0; transform: translateY(18px); }
        10%, 24% { opacity: 1; transform: translateY(0); }
        30%, 100% { opacity: 0; transform: translateY(-18px); }
      }
      .copy {
        align-self: center;
      }
      .eyebrow {
        color: var(--accent);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 15px;
        margin-bottom: 18px;
      }
      h1 {
        margin: 0 0 20px;
        font-size: 58px;
        line-height: 1.02;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: var(--muted);
        font-size: 22px;
        line-height: 1.45;
      }
      .visual {
        align-self: center;
        min-height: 390px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: rgba(27, 31, 35, 0.82);
        padding: 24px;
        box-shadow: 0 26px 80px rgba(0, 0, 0, 0.35);
      }
      .item {
        display: flex;
        gap: 12px;
        padding: 14px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        color: #dce3ea;
        font-size: 18px;
        line-height: 1.35;
      }
      .item:last-child { border-bottom: 0; }
      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        margin-top: 8px;
        flex: 0 0 auto;
        background: var(--accent-2);
      }
      .terminal {
        font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
        font-size: 16px;
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="brand"><span class="mark"></span><span>ReplayForge</span></div>
      ${sceneCards}
    </main>
  </body>
</html>`;
}

export function renderAnimatedSvg({ profile, storyboard }) {
  const width = 1280;
  const height = 720;
  const sceneDuration = 5;
  const totalDuration = storyboard.scenes.length * sceneDuration;
  const scenes = storyboard.scenes.map((scene, index) => renderSvgScene(scene, index, totalDuration)).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .bg { fill: #101214; }
    .panel { fill: #1b1f23; stroke: #30363d; stroke-width: 1; }
    .title { fill: #f5f7fa; font: 700 54px system-ui, sans-serif; }
    .eyebrow { fill: #42d392; font: 700 16px system-ui, sans-serif; letter-spacing: 2px; }
    .body { fill: #b9c0c7; font: 22px system-ui, sans-serif; }
    .item { fill: #dce3ea; font: 18px system-ui, sans-serif; }
    .mono { fill: #dce3ea; font: 16px Consolas, monospace; }
    .scene { opacity: 0; animation: show ${totalDuration}s infinite; }
    ${storyboard.scenes.map((_, index) => `.s${index} { animation-delay: ${index * sceneDuration}s; }`).join("\n    ")}
    @keyframes show {
      0%, 6% { opacity: 0; transform: translateY(18px); }
      10%, 24% { opacity: 1; transform: translateY(0); }
      30%, 100% { opacity: 0; transform: translateY(-18px); }
    }
  </style>
  <rect class="bg" width="${width}" height="${height}"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#18202a" opacity="0.55"/>
  <rect x="48" y="38" width="28" height="28" rx="7" fill="#42d392"/>
  <text x="88" y="60" class="body" font-size="18">ReplayForge</text>
  <text x="48" y="676" class="body" font-size="16">${escapeXml(profile.name)} demo generated from project signals</text>
  ${scenes}
</svg>`;
}

function renderHtmlScene(scene, index) {
  const isTerminal = scene.visual === "terminal";
  const bullets = (scene.bullets ?? []).slice(0, 8);
  return `<section class="scene scene-${index}">
        <div class="copy">
          <div class="eyebrow">${escapeHtml(scene.eyebrow)}</div>
          <h1>${escapeHtml(scene.title)}</h1>
          <p>${escapeHtml(scene.body)}</p>
        </div>
        <div class="visual ${isTerminal ? "terminal" : ""}">
          ${bullets.map((bullet) => `<div class="item"><span class="dot"></span><span>${escapeHtml(String(bullet))}</span></div>`).join("\n          ")}
        </div>
      </section>`;
}

function renderSvgScene(scene, index) {
  const bullets = (scene.bullets ?? []).slice(0, 6);
  const lines = [
    `<g class="scene s${index}">`,
    `<text x="64" y="178" class="eyebrow">${escapeXml(scene.eyebrow.toUpperCase())}</text>`,
    ...wrapSvgText(scene.title, 64, 245, 54, "title", 22),
    ...wrapSvgText(scene.body, 64, 354, 22, "body", 46),
    `<rect x="690" y="136" width="526" height="420" rx="8" class="panel"/>`
  ];

  bullets.forEach((bullet, bulletIndex) => {
    const y = 190 + bulletIndex * 54;
    lines.push(`<circle cx="728" cy="${y - 6}" r="5" fill="#7aa2ff"/>`);
    lines.push(...wrapSvgText(String(bullet), 748, y, 18, "item", 48));
  });

  lines.push("</g>");
  return lines.join("\n  ");
}

function wrapSvgText(text, x, y, size, className, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 3).map((line, index) => `<text x="${x}" y="${y + index * (size + 10)}" class="${className}">${escapeXml(line)}</text>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replaceAll("'", "&apos;");
}
