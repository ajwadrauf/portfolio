/**
 * Demo mode — every endpoint returns a realistic, clearly-labeled mock when
 * API keys are absent (or DRY_RUN=1). This lets the whole wizard be exercised
 * end-to-end with zero spend, which is itself a studio principle: never test
 * UX on paid inference.
 */
import type { AnalyzeResponse, CampaignBrief } from "./types";

const ASPECT_DIMS: Record<string, [number, number]> = {
  "1:1": [800, 800],
  "4:5": [800, 1000],
  "9:16": [720, 1280],
  "16:9": [1280, 720],
};

export function mockImageDataUrl(opts: {
  label: string;
  sublabel: string;
  aspect: string;
}): string {
  const [w, h] = ASPECT_DIMS[opts.aspect] ?? [800, 800];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1c2733"/>
      <stop offset="1" stop-color="#0d1218"/>
    </linearGradient>
    <radialGradient id="s" cx="0.5" cy="0.42" r="0.55">
      <stop offset="0" stop-color="#3b82f6" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="url(#s)"/>
  <g transform="translate(${w / 2} ${h / 2})">
    <rect x="${-w * 0.14}" y="${-h * 0.2}" width="${w * 0.28}" height="${h * 0.34}" rx="18"
      fill="#22303f" stroke="#3f5266" stroke-width="3"/>
    <rect x="${-w * 0.1}" y="${-h * 0.12}" width="${w * 0.2}" height="${h * 0.1}" rx="8" fill="#3b82f6" opacity="0.85"/>
  </g>
  <text x="${w / 2}" y="${h - 96}" text-anchor="middle" font-family="system-ui,sans-serif"
    font-size="${Math.round(w * 0.032)}" fill="#e5edf5" font-weight="700">${escapeXml(opts.label)}</text>
  <text x="${w / 2}" y="${h - 60}" text-anchor="middle" font-family="system-ui,sans-serif"
    font-size="${Math.round(w * 0.024)}" fill="#8fa3b8">${escapeXml(opts.sublabel)}</text>
  <text x="${w / 2}" y="${h - 28}" text-anchor="middle" font-family="system-ui,sans-serif"
    font-size="${Math.round(w * 0.02)}" fill="#5b7086">DEMO MODE — add API keys for live generation</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export function mockAnalyze(): AnalyzeResponse {
  return {
    productContext: {
      name: "sparkling water",
      category: "beverage",
      colors: ["teal", "silver", "white"],
      texture: "glossy metallic",
      packagingType: "slim can",
    },
    questions: [
      {
        id: "q1",
        question: "What occasion should the campaign lean into?",
        options: ["Everyday refreshment", "Workout recovery", "Social / entertaining"],
        defaultAnswer: "Everyday refreshment",
      },
      {
        id: "q2",
        question: "What brand tone fits best?",
        options: ["Clean & premium", "Playful & bold", "Natural & wholesome"],
        defaultAnswer: "Clean & premium",
      },
    ],
  };
}

export function mockBrief(): CampaignBrief {
  return {
    productName: "sparkling water",
    mood: "Crisp, refreshing, premium-clean",
    setting: "Bright minimal studio with condensation, ice textures and soft daylight",
    palette: "Teal, glacial blue, silver highlights on white",
    targetAudience: "Health-conscious urban adults 25-45",
    headlineEN: "Refreshment, Perfected.",
    headlineFR: "La fraîcheur, perfectionnée.",
    stillPrompt:
      "A chilled slim can of sparkling water beaded with condensation, standing on a wet reflective surface as a gentle splash arcs behind it. Studio daylight, crisp highlights, shallow depth of field.",
    videoPrompt:
      "A chilled slim can of sparkling water stands on a wet reflective surface. Slow push-in as a crystal-clear splash erupts behind it in slow motion, droplets catching studio daylight. The camera settles on the can, condensation rolling down its side. Audio: crisp fizz, gentle splash, a bright minimal music sting. Cinematic 4K, photorealistic lighting, product photography quality.",
    negativePrompt: "blurry, deformed packaging, warped text, watermark, extra cans, cartoonish",
    seasonalTheme: "cozy winter holiday — warm bokeh lights, evergreen sprigs, frosted glass",
  };
}
