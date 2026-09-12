/** Keep label detail while leaving room for the campaign brief in API bodies. */
export const CAMPAIGN_REFERENCE_MAX_DATA_URL_BYTES = 2_500_000;
export const CAMPAIGN_REFERENCE_MAX_SOURCE_BYTES = 24 * 1024 * 1024;

/** Called only after an explicit upload/sample choice or Analyze action. */
export async function prepareCampaignReference(src: string | Blob, maxBytes = CAMPAIGN_REFERENCE_MAX_DATA_URL_BYTES): Promise<string> {
  if (typeof src !== "string" && src.size > CAMPAIGN_REFERENCE_MAX_SOURCE_BYTES) {
    throw new Error("Choose a product image smaller than 24 MB.");
  }
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image. Try a PNG, JPEG or WebP."));
      el.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("This image has no readable dimensions.");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare the product image. Try again.");
    // Fit quality before reducing dimensions. Most packshots retain a 2048px edge.
    for (const maxSide of [2048, 1792, 1536, 1280, 1024, 768, 512]) {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.92, 0.86, 0.8]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        // JPEG data URLs are ASCII, so their character count equals their byte size.
        if (dataUrl.startsWith("data:image/jpeg;base64,") && dataUrl.length <= Math.min(maxBytes, CAMPAIGN_REFERENCE_MAX_DATA_URL_BYTES)) return dataUrl;
      }
    }
    throw new Error("This image could not fit the campaign request. Try a smaller PNG, JPEG or WebP.");
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
