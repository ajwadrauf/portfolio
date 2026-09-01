import type { MetadataRoute } from "next";

const BASE = "https://ajwadrauf.com";

/** Every page worth landing on directly. */
const ROUTES = [
  "",
  "/project-forge",
  "/ai-studio",
  "/ai-studio/studio",
  "/ai-studio/packshots",
  "/ai-studio/ads",
  "/ai-studio/prompts",
  "/ai-studio/blender",
  "/ai-studio/blender/the-wall",
  "/ai-studio/models",
  "/ai-studio/build-vs-buy",
  "/ai-studio/playbook",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: new Date(),
    priority: path === "" ? 1 : path === "/ai-studio" ? 0.9 : 0.7,
  }));
}
