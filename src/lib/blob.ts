import "server-only";

/**
 * Whether a Vercel Blob store is attached to this deployment.
 *
 * When it is, reference uploads go from the browser straight to Blob; when it
 * is not, they fall back to posting through our own route to fal storage. The
 * difference matters: a Function request body is capped at 4.5MB, so the
 * fallback cannot carry most video.
 */
export const blobConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
