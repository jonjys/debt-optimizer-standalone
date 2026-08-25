import type { MetadataRoute } from "next";

// Appen är en enda sida — allt sker i webbläsaren utan navigering.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://debtoptimize.se",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
