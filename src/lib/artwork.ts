/** Browser-only artwork import. Original files never leave this device. */
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export type ArtworkCrop = { x: number; y: number; width: number; height: number };
export const FULL_ARTWORK_CROP: ArtworkCrop = { x: 0, y: 0, width: 1, height: 1 };
export const MAX_ARTWORK_BYTES = 40 * 1024 * 1024;
export const MAX_ARTWORK_PAGES = 50;
const MAX_IMAGE_PIXELS = 80_000_000;

export type ArtworkRaster = { dataUrl: string; width: number; height: number };
export type ArtworkSource = {
  id: string;
  name: string;
  kind: "pdf" | "image";
  file: File;
  pageCount: number;
  rasterize: (page: number, crop?: ArtworkCrop, maxSide?: number, signal?: AbortSignal) => Promise<ArtworkRaster>;
  dispose: () => void;
};

export function validArtworkCrop(crop: ArtworkCrop): boolean {
  return Object.values(crop).every(Number.isFinite) && crop.x >= 0 && crop.y >= 0 &&
    crop.width >= 0.001 && crop.height >= 0.001 &&
    crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001;
}

function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Artwork operation cancelled", "AbortError");
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not create an artwork canvas.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
}

function rasterResult(canvas: HTMLCanvasElement): ArtworkRaster {
  const result = { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  canvas.width = canvas.height = 1;
  if (!result.dataUrl.startsWith("data:image/png;base64,")) throw new Error("The artwork is too large for this browser. Try a smaller crop.");
  return result;
}

/** Read original pixels for every crop, rather than enlarging the page preview. */
export async function openArtwork(file: File, signal?: AbortSignal): Promise<ArtworkSource> {
  if (!file.size || file.size > MAX_ARTWORK_BYTES) throw new Error("Choose an artwork file smaller than 40 MB.");
  abortIfNeeded(signal);
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = ["image/png", "image/jpeg", "image/webp"].includes(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!isPdf && !isImage) throw new Error("Use a PDF, PNG, JPEG, or WebP file. Export other artwork formats to one of these first.");
  const id = crypto.randomUUID();
  if (isPdf) {
    // PDF.js' compatibility build keeps imports working on browsers without the newest JS helpers.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    // Served by this app; PDF data and page rendering never use a remote service.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    abortIfNeeded(signal);
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      isEvalSupported: false,
      useSystemFonts: true,
      // Do not follow embedded attachment, annotation, or form actions.
      enableXfa: false,
    });
    const onAbort = () => { void loading.destroy(); };
    signal?.addEventListener("abort", onAbort, { once: true });
    let pdf: PDFDocumentProxy;
    try {
      pdf = await loading.promise;
      abortIfNeeded(signal);
    } catch (error) {
      void loading.destroy();
      if (signal?.aborted) throw new DOMException("Artwork operation cancelled", "AbortError");
      if (error instanceof Error && error.name === "PasswordException") throw new Error("This PDF needs a password. Save an unlocked copy and import it again.");
      throw new Error("This PDF could not be opened. Try exporting a fresh PDF or a PNG of the artwork.");
    } finally {
      signal?.removeEventListener("abort", onAbort);
    }
    if (pdf.numPages > MAX_ARTWORK_PAGES) {
      void pdf.destroy();
      throw new Error("Use a PDF with 50 pages or fewer. Export only the artwork pages first.");
    }
    let disposed = false;
    const tasks = new Set<RenderTask>();
    return {
      id, name: file.name, kind: "pdf", file, pageCount: pdf.numPages,
      async rasterize(pageNumber, crop = FULL_ARTWORK_CROP, maxSide = 1600, cropSignal) {
        abortIfNeeded(cropSignal);
        if (disposed) throw new Error("This source has been removed. Import the artwork again.");
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pdf.numPages || !validArtworkCrop(crop)) throw new Error("Choose a valid PDF page and artwork crop.");
        const page = await pdf.getPage(pageNumber);
        abortIfNeeded(cropSignal);
        const natural = page.getViewport({ scale: 1 });
        // A cropped canvas avoids allocating a giant full-page bitmap for small panels.
        const scale = Math.min(12, Math.min(4096, Math.max(1, maxSide)) / Math.max(natural.width * crop.width, natural.height * crop.height));
        const viewport = page.getViewport({ scale });
        const { canvas, context } = makeCanvas(viewport.width * crop.width, viewport.height * crop.height);
        const task = page.render({
          canvas, canvasContext: context, viewport,
          transform: [1, 0, 0, 1, -viewport.width * crop.x, -viewport.height * crop.y],
          annotationMode: pdfjs.AnnotationMode.DISABLE,
          background: "rgb(255,255,255)",
        });
        tasks.add(task);
        const cancel = () => task.cancel();
        cropSignal?.addEventListener("abort", cancel, { once: true });
        try {
          await task.promise;
          abortIfNeeded(cropSignal);
          return rasterResult(canvas);
        } finally {
          tasks.delete(task);
          cropSignal?.removeEventListener("abort", cancel);
          canvas.width = canvas.height = 1;
        }
      },
      dispose() {
        disposed = true;
        for (const task of tasks) task.cancel();
        void pdf.destroy();
      },
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("This image could not be opened. Try exporting a fresh PNG or JPEG."));
      image.src = url;
    });
    abortIfNeeded(signal);
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) throw new Error("Use an image smaller than 80 megapixels. Export just the artwork area first.");
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  let disposed = false;
  return {
    id, name: file.name, kind: "image", file, pageCount: 1,
    async rasterize(_page, crop = FULL_ARTWORK_CROP, maxSide = 1600, cropSignal) {
      abortIfNeeded(cropSignal);
      if (disposed) throw new Error("This source has been removed. Import the artwork again.");
      if (!validArtworkCrop(crop)) throw new Error("Keep the crop inside the artwork and give it a width and height.");
      const width = image.naturalWidth * crop.width;
      const height = image.naturalHeight * crop.height;
      const scale = Math.min(1, Math.min(4096, Math.max(1, maxSide)) / Math.max(width, height));
      const { canvas, context } = makeCanvas(width * scale, height * scale);
      // At native resolution, retain exact artwork pixels and avoid sampling outside a crop edge.
      context.imageSmoothingEnabled = scale < 1;
      context.drawImage(image, crop.x * image.naturalWidth, crop.y * image.naturalHeight, width, height, 0, 0, canvas.width, canvas.height);
      abortIfNeeded(cropSignal);
      return rasterResult(canvas);
    },
    dispose() { disposed = true; image.src = ""; URL.revokeObjectURL(url); },
  };
}

export function artworkFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "box";
}

export function downloadLocalFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function pngDataBytes(dataUrl: string): Uint8Array<ArrayBuffer> {
  if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("Only local PNG images can be exported.");
  const binary = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
