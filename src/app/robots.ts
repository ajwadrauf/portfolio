import type { MetadataRoute } from "next";

/**
 * The site is meant to be found; the API routes are not. Nothing here is a
 * security boundary — the gate does that — it just keeps generation
 * endpoints out of search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: "https://ajwadrauf.com/sitemap.xml",
  };
}
