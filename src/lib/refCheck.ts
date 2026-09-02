/**
 * Pre-flight for reference files, run before a paid render.
 *
 * The generation provider validates references at submit time and reports a
 * failure with one boilerplate sentence — most memorably "may contain
 * likenesses of real people", which is returned for a bag of unrelated causes
 * including a file it could not fetch. That message sends you looking for a
 * face in a photograph of a biscuit. Meanwhile the hard, documented, checkable
 * constraints — reachability, format, size, dimensions, aspect — are never
 * mentioned, and every failed guess is another round trip.
 *
 * So the checkable things are checked here first, per file, and named.
 */

/** ByteDance's published limits for Seedance reference stills. */
export const IMAGE_LIMITS = {
  /** Per file. Generous, but a raw export can exceed it. */
  maxBytes: 30 * 1024 * 1024,
  minSide: 300,
  maxSide: 6000,
  /** width / height. */
  minAspect: 0.4,
  maxAspect: 2.5,
  formats: ["jpeg", "jpg", "png", "webp", "bmp", "tiff", "gif", "heic", "heif"],
} as const;

export type RefFinding = {
  url: string;
  /** Which slot the prompt addresses this as, e.g. "[Image2]". */
  slot: string;
  ok: boolean;
  /** Populated when the file was reachable and decodable. */
  detail?: { bytes?: number; width?: number; height?: number; contentType?: string };
  /** Why it would be rejected, in the order worth acting on. */
  problems: string[];
  /** Things worth knowing that are not, on their own, failures. */
  notes: string[];
};

const ext = (url: string) => {
  const path = url.split("?")[0].split("#")[0];
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
};

/**
 * Reads width and height from the file's own header bytes.
 *
 * Only the container header is needed, so this parses the leading bytes
 * rather than decoding the image — a 4MB PNG costs one small range request,
 * not a full download, wherever the host honours Range.
 */
export function readDimensions(
  buf: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  // PNG: 8-byte signature, then an IHDR chunk whose first two fields are the
  // dimensions as big-endian uint32.
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // GIF: little-endian uint16 pair at offset 6.
  if (buf.length > 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }

  // WEBP (RIFF....WEBPVP8 ), lossy and lossless carry them differently.
  if (
    buf.length > 30 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    const kind = String.fromCharCode(buf[12], buf[13], buf[14], buf[15]);
    if (kind === "VP8 ") {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (kind === "VP8L") {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") {
      const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
      const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
      return { width: w + 1, height: h + 1 };
    }
  }

  // JPEG: walk the segment chain to a start-of-frame marker, which is the
  // only place the dimensions live.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      // SOF0..SOF15, excluding the four that are not frame headers.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
      }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
      i += 2 + view.getUint16(i + 2);
    }
  }

  return null;
}

/** Applies the documented limits to what was read off one file. */
export function judge(
  slot: string,
  url: string,
  detail: RefFinding["detail"],
  fetchProblem?: string,
): RefFinding {
  const problems: string[] = [];
  const notes: string[] = [];

  if (fetchProblem) {
    problems.push(fetchProblem);
    return { url, slot, ok: false, problems, notes };
  }

  const e = ext(url);
  if (e && !IMAGE_LIMITS.formats.includes(e as never)) {
    problems.push(`.${e} is not an accepted format (${IMAGE_LIMITS.formats.join(", ")}).`);
  }

  const { bytes, width, height, contentType } = detail ?? {};
  if (bytes && bytes > IMAGE_LIMITS.maxBytes) {
    problems.push(`${(bytes / 1024 / 1024).toFixed(1)}MB is over the ${IMAGE_LIMITS.maxBytes / 1024 / 1024}MB limit.`);
  }
  if (contentType && !contentType.startsWith("image/")) {
    problems.push(
      `The server returns this as ${contentType}, not an image type. A provider fetching it may refuse it before looking at the pixels.`,
    );
  }

  if (width && height) {
    const small = Math.min(width, height);
    const large = Math.max(width, height);
    if (small < IMAGE_LIMITS.minSide) {
      problems.push(`${width}×${height} — the short edge is under the ${IMAGE_LIMITS.minSide}px minimum.`);
    }
    if (large > IMAGE_LIMITS.maxSide) {
      problems.push(`${width}×${height} — the long edge is over the ${IMAGE_LIMITS.maxSide}px maximum.`);
    }
    const aspect = width / height;
    if (aspect < IMAGE_LIMITS.minAspect || aspect > IMAGE_LIMITS.maxAspect) {
      problems.push(
        `Aspect ${aspect.toFixed(2)}:1 is outside the accepted ${IMAGE_LIMITS.minAspect}–${IMAGE_LIMITS.maxAspect} range.`,
      );
    }
  } else if (!problems.length) {
    notes.push("Reachable, but the dimensions could not be read from the file header — check them by hand.");
  }

  return { url, slot, ok: problems.length === 0, detail, problems, notes };
}
