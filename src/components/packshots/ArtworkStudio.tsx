"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { PACK_ANGLES, type PackAngle } from "@/lib/packshot";
import {
  BOX_FACES, BOX_FACE_LABELS, artworkManifest, coverageForAngle, faceDimensions,
  mappedFaces, validBoxDimensions, type BoxFace, type BoxFinish, type BoxPanel,
  type BoxDimensions, type BoxPanels, type BoxSettings, type PackageShape,
} from "@/lib/packaging";
import {
  FULL_ARTWORK_CROP, artworkFileName, downloadLocalFile, openArtwork, pngDataBytes,
  validArtworkCrop, type ArtworkCrop, type ArtworkRaster, type ArtworkSource,
} from "@/lib/artwork";
import {
  COMPANY_PRESET_STORAGE_KEY, MAX_COMPANY_PRESETS, MAX_PRESET_LIBRARY_BYTES, STARTER_PACKAGE_PRESETS,
  createCompanyPreset, mergePresetLibraries, parsePresetLibrary, presetMatches, presetProvenance,
  readPackagePreset, serializePresetLibrary, type PackagePreset, type PresetProvenance,
} from "@/lib/package-presets";
import { BoxPreview, type BoxPreviewHandle } from "./BoxPreview";
import { PackshotActions as CampaignHandoffButton } from "./PackshotActions";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import styles from "./ArtworkStudio.module.css";

type PanelOrigin = { sourceName: string; page: number; crop: ArtworkCrop; pixels: { width: number; height: number } };
type PanelOrigins = Partial<Record<BoxFace, PanelOrigin>>;
type RenderedView = { angle: PackAngle; dataUrl: string };
type RenderBatch = {
  views: RenderedView[];
  revision: number;
  name: string;
  settings: BoxSettings;
  origins: PanelOrigins;
  size: number;
  preset: PresetProvenance | null;
};
type BoxProject = { schema: "packshot-box-project"; version: 1; name: string; settings: BoxSettings; origins: PanelOrigins; preset?: PackagePreset | null; presetProvenance?: PresetProvenance | null; displayUnit?: "mm" | "in" };

const INITIAL_DIMENSIONS = { width: "80", height: "120", depth: "45" };
const MAX_SOURCES = 12;
const MAX_TOTAL_SOURCE_BYTES = 120 * 1024 * 1024;
const isColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
const messageFor = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const isCancelled = (error: unknown) => error instanceof Error && ["AbortError", "RenderingCancelledException"].includes(error.name);
const tidyNumber = (value: number) => Number(value.toFixed(4)).toString();

/** Import only our plain data schema. Never load a URL or executable source from a project. */
function readProject(text: string): BoxProject {
  let raw: BoxProject;
  try { raw = JSON.parse(text) as BoxProject; } catch { throw new Error("This is not a valid box project JSON file."); }
  if (raw?.schema !== "packshot-box-project" || raw.version !== 1 || !raw.settings || !raw.settings.dimensions ||
    !validBoxDimensions(raw.settings.dimensions) || !isColor(raw.settings.baseColor) ||
    !["matte", "satin"].includes(raw.settings.finish) || !raw.settings.panels || typeof raw.settings.panels !== "object" ||
    (raw.settings.shape !== undefined && !["carton", "pillow-bag"].includes(raw.settings.shape)) ||
    (raw.displayUnit !== undefined && !["mm", "in"].includes(raw.displayUnit))) {
    throw new Error("This file is not a supported box project. Choose a project saved by this studio.");
  }
  const panels: BoxPanels = {};
  const origins: PanelOrigins = {};
  for (const face of BOX_FACES) {
    const panel = raw.settings.panels[face];
    if (!panel) continue;
    if (typeof panel.dataUrl !== "string" || panel.dataUrl.length > 30_000_000 ||
      !/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/.test(panel.dataUrl) ||
      ![0, 90, 180, 270].includes(panel.rotation) || !["contain", "cover"].includes(panel.fit) || !isColor(panel.background)) {
      throw new Error(`The ${face} panel is invalid or too large. Import the original artwork again.`);
    }
    // Reject oversized image dimensions before the browser allocates the decoded bitmap.
    const header = atob(panel.dataUrl.slice("data:image/png;base64,".length, "data:image/png;base64,".length + 44));
    const bytes = Uint8Array.from(header, (char) => char.charCodeAt(0));
    if (bytes.length < 24 || bytes[0] !== 137 || String.fromCharCode(...bytes.slice(1, 4)) !== "PNG") throw new Error(`The ${face} panel is not a valid PNG.`);
    const view = new DataView(bytes.buffer);
    const width = view.getUint32(16), height = view.getUint32(20);
    if (!width || !height || width > 4096 || height > 4096) throw new Error(`The ${face} panel exceeds the 4096 pixel artwork limit.`);
    panels[face] = { dataUrl: panel.dataUrl, name: typeof panel.name === "string" ? panel.name.slice(0, 250) : face, rotation: panel.rotation, fit: panel.fit, background: panel.background };
    const origin = raw.origins?.[face];
    if (origin && typeof origin.sourceName === "string" && Number.isInteger(origin.page) && origin.page > 0 && origin.crop && validArtworkCrop(origin.crop)) {
      origins[face] = { sourceName: origin.sourceName.slice(0, 250), page: origin.page, crop: { x: origin.crop.x, y: origin.crop.y, width: origin.crop.width, height: origin.crop.height }, pixels: { width, height } };
    }
  }
  return {
    schema: "packshot-box-project", version: 1,
    name: typeof raw.name === "string" ? raw.name.slice(0, 100) : "My box",
    settings: { dimensions: { width: raw.settings.dimensions.width, height: raw.settings.dimensions.height, depth: raw.settings.dimensions.depth }, panels, baseColor: raw.settings.baseColor, finish: raw.settings.finish, shape: raw.settings.shape ?? "carton" },
    origins,
    preset: raw.preset ? readPackagePreset(raw.preset) : null,
    displayUnit: raw.displayUnit ?? "mm",
  };
}

export function ArtworkStudio({ onUseAsReferences }: { onUseAsReferences?: (references: RenderedView[]) => void }) {
  const { project: studioProject, saveDraft } = useStudioProject();
  const [sources, setSources] = useState<ArtworkSource[]>([]);
  const sourcesRef = useRef<ArtworkSource[]>([]);
  const [sourceId, setSourceId] = useState("");
  const source = sources.find((item) => item.id === sourceId);
  const [page, setPage] = useState(1);
  const [pageImage, setPageImage] = useState<ArtworkRaster | null>(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [crop, setCrop] = useState<ArtworkCrop>({ ...FULL_ARTWORK_CROP });
  const [activeFace, setActiveFace] = useState<BoxFace>("front");
  const [panels, setPanels] = useState<BoxPanels>({});
  const [origins, setOrigins] = useState<PanelOrigins>({});
  const [dimensionInputs, setDimensionInputs] = useState(INITIAL_DIMENSIONS);
  const [unit, setUnit] = useState<"mm" | "in">("mm");
  // Keep physical measurements canonical: switching display units must not round the geometry.
  const [dimensions, setDimensions] = useState<BoxDimensions>({ width: 80, height: 120, depth: 45 });
  const [shape, setShape] = useState<PackageShape>("carton");
  const [finish, setFinish] = useState<BoxFinish>("matte");
  const [companyPresets, setCompanyPresets] = useState<PackagePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PackagePreset | null>(null);
  const [presetName, setPresetName] = useState("");
  const [libraryStorage, setLibraryStorage] = useState<"loading" | "ready" | "unavailable">("loading");
  const [baseColor, setBaseColor] = useState("#ffffff");
  const [name, setName] = useState("My box");
  const [size, setSize] = useState(2048);
  const [revision, setRevision] = useState(0);
  const [batch, setBatch] = useState<RenderBatch | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const previewRef = useRef<BoxPreviewHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const projectInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const importAbort = useRef<AbortController | null>(null);
  const cropAbort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const renderToken = useRef(0);
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null);
  const rendering = progress !== null;
  const editingBusy = rendering || assigning || importing;
  const validDimensions = validBoxDimensions(dimensions);
  const assigned = mappedFaces(panels);
  const selectedPanel = panels[activeFace];
  const selectedFaceSize = faceDimensions(dimensions, activeFace);
  const stale = batch !== null && batch.revision !== revision;
  const presetModified = selectedPreset !== null && !presetMatches(selectedPreset, { dimensions, shape, finish });
  const availablePresets = [...STARTER_PACKAGE_PRESETS, ...companyPresets];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COMPANY_PRESET_STORAGE_KEY);
      if (saved) setCompanyPresets(parsePresetLibrary(saved));
      setLibraryStorage("ready");
    } catch {
      // Keep unreadable saved data untouched; session work can still be exported as JSON.
      setLibraryStorage("unavailable");
      setNotice("Saved presets could not be read in this browser. New presets will stay in this session; export the library to keep them.");
    }
    function syncLibrary(event: StorageEvent) {
      if (event.key !== COMPANY_PRESET_STORAGE_KEY) return;
      if (event.newValue === null) {
        setLibraryStorage("unavailable");
        setNotice("Preset storage was cleared in another tab. Export this session’s library to keep a copy.");
        return;
      }
      try {
        const incoming = parsePresetLibrary(event.newValue);
        setCompanyPresets((previous) => {
          try { return mergePresetLibraries(incoming, previous, () => `company:${crypto.randomUUID()}`).presets; }
          catch { return previous; }
        });
        setLibraryStorage("ready");
      } catch {
        setLibraryStorage("unavailable");
        setNotice("A preset library update from another tab could not be read. Your current presets are kept in this session.");
      }
    }
    window.addEventListener("storage", syncLibrary);
    return () => window.removeEventListener("storage", syncLibrary);
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      renderToken.current++;
      importAbort.current?.abort();
      cropAbort.current?.abort();
      for (const item of sourcesRef.current) item.dispose();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPageImage(null);
    setCrop({ ...FULL_ARTWORK_CROP });
    if (!source) { setPageLoading(false); return () => controller.abort(); }
    setPageLoading(true);
    void source.rasterize(page, FULL_ARTWORK_CROP, 1600, controller.signal).then((raster) => {
      if (!controller.signal.aborted) setPageImage(raster);
    }).catch((cause) => {
      if (!controller.signal.aborted && !isCancelled(cause)) setError(messageFor(cause));
    }).finally(() => {
      if (!controller.signal.aborted) setPageLoading(false);
    });
    return () => controller.abort();
  }, [source, page]);

  function changed() { setRevision((value) => value + 1); }

  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const selected = Array.from(files);
    if (sources.length + selected.length > MAX_SOURCES) { setError("Keep up to 12 source files in one project. Remove a source to add another."); return; }
    if ([...sources.map((item) => item.file), ...selected].reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_SOURCE_BYTES) { setError("Keep the combined source files below 120 MB. Export just the artwork pages if needed."); return; }
    const controller = new AbortController();
    importAbort.current?.abort();
    importAbort.current = controller;
    setImporting(true);
    const opened: ArtworkSource[] = [];
    const failures: string[] = [];
    try {
      for (const file of selected) {
        try {
          const item = await openArtwork(file, controller.signal);
          if (controller.signal.aborted || !alive.current) { item.dispose(); break; }
          opened.push(item);
        } catch (cause) {
          if (controller.signal.aborted) break;
          failures.push(`${file.name}: ${messageFor(cause)}`);
        }
      }
      if (controller.signal.aborted || !alive.current) { for (const item of opened) item.dispose(); return; }
      if (opened.length) {
        const next = [...sourcesRef.current, ...opened];
        sourcesRef.current = next;
        setSources(next);
        setSourceId(opened[0].id);
        setPage(1);
        setNotice(`${opened.length} source ${opened.length === 1 ? "file is" : "files are"} ready. Select the artwork area for a box face.`);
      }
      if (failures.length) setError(failures.join(" "));
    } finally {
      if (alive.current && importAbort.current === controller) setImporting(false);
    }
  }

  function removeSource() {
    if (!source) return;
    const remaining = sourcesRef.current.filter((item) => item.id !== source.id);
    sourcesRef.current = remaining;
    setSources(remaining);
    setSourceId(remaining[0]?.id ?? "");
    setPage(1);
    source.dispose();
    setNotice("Source removed. Artwork already assigned to faces is kept.");
  }

  function setCropValue(key: keyof ArtworkCrop, percent: number) {
    if (!Number.isFinite(percent)) return;
    setCrop((old) => {
      const next = { ...old, [key]: Math.min(1, Math.max(key === "width" || key === "height" ? 0.001 : 0, percent / 100)) };
      next.x = Math.min(next.x, 0.999);
      next.y = Math.min(next.y, 0.999);
      next.width = Math.min(next.width, 1 - next.x);
      next.height = Math.min(next.height, 1 - next.y);
      return next;
    });
  }

  function cropPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)), y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)) };
  }

  function startCrop(event: PointerEvent<HTMLDivElement>) {
    if (editingBusy || event.button !== 0) return;
    const point = cropPoint(event);
    drag.current = { ...point, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveCrop(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const end = cropPoint(event);
    const width = Math.abs(end.x - start.x), height = Math.abs(end.y - start.y);
    if (width < 0.003 || height < 0.003) return;
    setCrop({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width, height });
  }

  async function assignCrop() {
    if (!source || !pageImage || !validArtworkCrop(crop)) return;
    setError(null);
    setAssigning(true);
    const controller = new AbortController();
    cropAbort.current?.abort();
    cropAbort.current = controller;
    try {
      const raster = await source.rasterize(page, crop, 4096, controller.signal);
      if (controller.signal.aborted || !alive.current) return;
      setPanels((previous) => ({ ...previous, [activeFace]: {
        dataUrl: raster.dataUrl, name: `${source.name}${source.kind === "pdf" ? ` · page ${page}` : ""}`,
        rotation: previous[activeFace]?.rotation ?? 0, fit: previous[activeFace]?.fit ?? "contain", background: previous[activeFace]?.background ?? baseColor,
      } }));
      setOrigins((previous) => ({ ...previous, [activeFace]: { sourceName: source.name, page, crop: { ...crop }, pixels: { width: raster.width, height: raster.height } } }));
      changed();
      setNotice(`${BOX_FACE_LABELS[activeFace]} artwork assigned at ${raster.width} × ${raster.height} pixels. Inspect its orientation in the preview.`);
    } catch (cause) { if (!controller.signal.aborted && !isCancelled(cause)) setError(messageFor(cause)); }
    finally { if (alive.current) setAssigning(false); }
  }

  function updatePanel(patch: Partial<BoxPanel>) {
    if (!panels[activeFace]) return;
    setPanels((previous) => ({ ...previous, [activeFace]: { ...previous[activeFace]!, ...patch } }));
    changed();
  }

  function removePanel() {
    setPanels((previous) => { const next = { ...previous }; delete next[activeFace]; return next; });
    setOrigins((previous) => { const next = { ...previous }; delete next[activeFace]; return next; });
    changed();
  }

  function switchUnit(next: "mm" | "in") {
    const factor = next === "in" ? 25.4 : 1;
    setDimensionInputs({ width: tidyNumber(dimensions.width / factor), height: tidyNumber(dimensions.height / factor), depth: tidyNumber(dimensions.depth / factor) });
    setUnit(next);
  }

  function updateDimension(key: keyof BoxDimensions, value: string) {
    setDimensionInputs((previous) => ({ ...previous, [key]: value }));
    setDimensions((previous) => ({ ...previous, [key]: Number(value) * (unit === "in" ? 25.4 : 1) }));
    changed();
  }

  function applyPreset(id: string) {
    const preset = availablePresets.find((item) => item.id === id);
    if (!preset) { setSelectedPreset(null); changed(); return; }
    const factor = preset.unit === "in" ? 25.4 : 1;
    setSelectedPreset(preset);
    setDimensions({ ...preset.dimensions });
    setDimensionInputs({ width: tidyNumber(preset.dimensions.width / factor), height: tidyNumber(preset.dimensions.height / factor), depth: tidyNumber(preset.dimensions.depth / factor) });
    setShape(preset.shape); setFinish(preset.finish); setUnit(preset.unit);
    changed();
    setNotice(`${preset.name} applied. ${preset.source === "starter-example" ? "These are sample measurements; replace them with your package specifications. " : ""}Existing artwork is kept. Review its fit and crop on every face.`);
  }

  function keepCompanyLibrary(next: PackagePreset[]) {
    let combined = next;
    if (libraryStorage !== "ready") { setCompanyPresets(next); return { persisted: false, presets: next }; }
    try {
      // Another tab may have saved since this view mounted. Retain those presets too.
      const latest = localStorage.getItem(COMPANY_PRESET_STORAGE_KEY);
      if (latest) combined = mergePresetLibraries(parsePresetLibrary(latest), next, () => `company:${crypto.randomUUID()}`).presets;
      localStorage.setItem(COMPANY_PRESET_STORAGE_KEY, serializePresetLibrary(combined));
      setCompanyPresets(combined);
      return { persisted: true, presets: combined };
    } catch (cause) {
      // Never replace a library that cannot be safely read or merged.
      if (cause instanceof Error && /exceed 100|unique ID/.test(cause.message)) throw cause;
      setCompanyPresets(combined); setLibraryStorage("unavailable");
      return { persisted: false, presets: combined };
    }
  }

  function saveCompanyPreset() {
    setError(null);
    try {
      if (!validDimensions) throw new Error("Enter valid package dimensions before saving a preset.");
      if (companyPresets.length >= MAX_COMPANY_PRESETS) throw new Error("This browser already holds 100 company presets. Export a library to keep your current collection.");
      if (availablePresets.some((preset) => preset.name.toLocaleLowerCase() === presetName.trim().toLocaleLowerCase())) throw new Error("That preset name already exists. Choose a new name; existing presets will be kept.");
      const preset = createCompanyPreset(presetName, { dimensions, shape, finish }, unit, selectedPreset, `company:${crypto.randomUUID()}`);
      const { persisted, presets: saved } = keepCompanyLibrary([...companyPresets, preset]);
      const storedPreset = saved.find((item) => item.id === preset.id) ?? saved.find((item) => item.name === preset.name) ?? preset;
      setSelectedPreset(storedPreset); setPresetName(""); changed();
      setNotice(`${storedPreset.name} saved ${persisted ? "in this browser" : "for this session only"}. Export the company preset library to share it or keep a separate copy.${persisted ? "" : " Browser storage is unavailable."}`);
    } catch (cause) { setError(messageFor(cause)); }
  }

  function exportPresetLibrary() {
    try {
      downloadLocalFile(new Blob([serializePresetLibrary(companyPresets)], { type: "application/json" }), "company-package-presets.json");
      setNotice("Company preset library exported. Share the JSON file with your team; this library does not sync through the cloud.");
    } catch (cause) { setError(messageFor(cause)); }
  }

  async function importPresetLibrary(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_PRESET_LIBRARY_BYTES) { setError("Choose a preset library smaller than 1 MB."); return; }
    setImporting(true); setError(null);
    try {
      const incoming = parsePresetLibrary(await file.text());
      if (!alive.current) return;
      const result = mergePresetLibraries(companyPresets, incoming, () => `company:${crypto.randomUUID()}`);
      const { persisted } = keepCompanyLibrary(result.presets);
      setNotice(`${result.added} company presets imported ${persisted ? "into this browser" : "for this session"}; ${result.skipped} duplicates skipped${result.renamed ? `; ${result.renamed} name conflicts kept as renamed copies` : ""}. Existing presets and the current package are kept.${persisted ? "" : " Export the library to retain it."}`);
    } catch (cause) { if (alive.current) setError(messageFor(cause)); }
    finally { if (alive.current) setImporting(false); }
  }

  async function renderViews() {
    if (!validDimensions || !assigned.length || !previewRef.current) return;
    const token = ++renderToken.current;
    const snapshot: RenderBatch = { views: [], revision, name, settings: { dimensions, panels, finish, baseColor, shape }, origins, size, preset: presetProvenance(selectedPreset, { dimensions, shape, finish }) };
    setError(null);
    setProgress(0);
    try {
      for (const angle of PACK_ANGLES) {
        if (token !== renderToken.current || !alive.current) return;
        const dataUrl = await previewRef.current.renderAngle(angle.id, size);
        if (token !== renderToken.current || !alive.current) return;
        snapshot.views.push({ angle: angle.id, dataUrl });
        setProgress(snapshot.views.length);
        // Give the browser a frame to show progress and accept cancellation.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (token !== renderToken.current || !alive.current) return;
      setBatch(snapshot);
      setNotice("Seven PNG views are ready. Review the mapped and plain faces before downloading.");
    } catch (cause) { if (token === renderToken.current && alive.current) setError(messageFor(cause)); }
    finally { if (token === renderToken.current && alive.current) setProgress(null); }
  }

  async function downloadZip() {
    if (!batch) return;
    setDownloading(true);
    setError(null);
    try {
      const { zip, strToU8 } = await import("fflate");
      const prefix = artworkFileName(batch.name);
      const files: Record<string, Uint8Array> = {};
      for (const view of batch.views) files[`${prefix}_${view.angle}.png`] = pngDataBytes(view.dataUrl);
      const manifest = { ...artworkManifest(batch.settings, batch.views.map((view) => view.angle), batch.size), projectName: batch.name, preset: batch.preset, crops: batch.origins, note: "User-assigned artwork on a package model. Starter preset dimensions are examples, not approved company specifications. Pillow bags are illustrative models. Unassigned faces are plain. No generative image model was used. Review artwork, dimensions, color, and orientation before publication." };
      files[`${prefix}_manifest.json`] = strToU8(JSON.stringify(manifest, null, 2));
      const bytes = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => zip(files, { level: 0 }, (cause, data) => cause ? reject(cause) : resolve(new Uint8Array(data))));
      if (alive.current) downloadLocalFile(new Blob([bytes], { type: "application/zip" }), `${prefix}_packshots.zip`);
    } catch (cause) { if (alive.current) setError(messageFor(cause)); }
    finally { if (alive.current) setDownloading(false); }
  }

  function saveProject() {
    if (!validDimensions) { setError("Enter valid box dimensions before saving the project."); return; }
    const project: BoxProject = { schema: "packshot-box-project", version: 1, name, settings: { dimensions, panels, finish, baseColor, shape }, origins, preset: selectedPreset, presetProvenance: presetProvenance(selectedPreset, { dimensions, shape, finish }), displayUnit: unit };
    try {
      const json = JSON.stringify(project);
      const blob = new Blob([json], { type: "application/json" });
      if (blob.size > 96 * 1024 * 1024) throw new Error("This box project exceeds the 96 MB save limit. Use smaller artwork images or tighter crops before saving.");
      // Apply exactly the same format and per-panel limits that Open box project uses.
      readProject(json);
      downloadLocalFile(blob, `${artworkFileName(name)}.box-project.json`);
      setNotice("Box project saved with its assigned artwork. Keep your original source files separately to make new crops later.");
    } catch (cause) { setError(messageFor(cause)); }
  }

  async function loadProject(file: File | undefined) {
    if (!file) return;
    if (file.size > 96 * 1024 * 1024) { setError("Choose a box project smaller than 96 MB."); return; }
    setImporting(true);
    setError(null);
    try {
      const project = readProject(await file.text());
      if (!alive.current) return;
      for (const item of sourcesRef.current) item.dispose();
      sourcesRef.current = [];
      setSources([]); setSourceId(""); setPage(1);
      setName(project.name);
      const nextUnit = project.displayUnit ?? "mm";
      const factor = nextUnit === "in" ? 25.4 : 1;
      setUnit(nextUnit);
      setDimensions(project.settings.dimensions);
      setDimensionInputs({ width: tidyNumber(project.settings.dimensions.width / factor), height: tidyNumber(project.settings.dimensions.height / factor), depth: tidyNumber(project.settings.dimensions.depth / factor) });
      setShape(project.settings.shape ?? "carton"); setSelectedPreset(project.preset ?? null);
      setPanels(project.settings.panels); setOrigins(project.origins);
      setFinish(project.settings.finish); setBaseColor(project.settings.baseColor);
      setBatch(null); changed();
      setNotice("Box project restored. Import an original source file if you want to make new crops.");
    } catch (cause) { if (alive.current) setError(messageFor(cause)); }
    finally { if (alive.current) setImporting(false); }
  }

  async function keepInStudio() {
    try {
      const data = readProject(JSON.stringify({ schema: "packshot-box-project", version: 1, name, settings: { dimensions, panels, finish, baseColor, shape }, origins, preset: selectedPreset, displayUnit: unit }));
      await saveDraft("artwork", data); setNotice("Package settings and assigned artwork saved in this studio project.");
    } catch (cause) { setError(messageFor(cause)); }
  }
  async function loadVelune() {
    setImporting(true); setError(null);
    try {
      const response = await fetch("/studio/velune/box-pistachio-front.png");
      if (!response.ok) throw new Error("The VELUNE artwork could not be opened.");
      const file = new File([await response.blob()], "VELUNE-pistachio-concept.png", { type: "image/png" });
      const source = await openArtwork(file);
      try {
        const raster = await source.rasterize(1, FULL_ARTWORK_CROP, 4096);
        if (!alive.current) return;
        setName("VELUNE · Pistachio concept"); setDimensions({ width: 120, height: 180, depth: 40 }); setDimensionInputs({ width: "120", height: "180", depth: "40" }); setUnit("mm"); setShape("carton"); setSelectedPreset(null); setBaseColor("#556c50");
        setPanels({ front: { dataUrl: raster.dataUrl, name: file.name, rotation: 0, fit: "contain", background: "#556c50" } }); setOrigins({ front: { sourceName: file.name, page: 1, crop: { ...FULL_ARTWORK_CROP }, pixels: { width: raster.width, height: raster.height } } }); setBatch(null); changed();
        setNotice("Loaded the Blender front-panel concept on its proposed 120 × 180 × 40 mm carton. Other faces are plain. These are creative dimensions, not approved manufacturing specifications.");
      } finally { source.dispose(); }
    } catch (cause) { if (alive.current) setError(messageFor(cause)); }
    finally { if (alive.current) setImporting(false); }
  }
  useEffect(() => {
    if (!studioProject?.drafts.artwork) return;
    void loadProject(new File([JSON.stringify(studioProject.drafts.artwork)], "saved.box-project.json", { type: "application/json" }));
    // The parent mounts a fresh session for each project. Save echoes must not reset the editor.
  }, []);

  return (
    <div className={styles.studio}>
      <div className={styles.intro}>
        <div><span className={styles.eyebrow}>Artwork → package model</span><p>Choose a package preset or enter measurements, apply your flat artwork, then render seven views. No product photo needed.</p></div>
        <span className={styles.localBadge}>On this device · no AI charge</span>
      </div>

      {studioProject?.example === "velune" && <div className="my-4 rounded border border-border-soft p-4"><p className="mb-3 text-sm">VELUNE front-panel concept · the artwork used in the Blender carton study. Loading replaces the current package setup.</p><button type="button" className={styles.secondary} disabled={editingBusy} onClick={() => void loadVelune()}>Load VELUNE carton artwork</button></div>}
      <div className={styles.projectBar}>
        <label className={styles.nameField}>Project name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} disabled={editingBusy} /></label>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={() => void keepInStudio()} disabled={editingBusy || !validDimensions || !studioProject}>Keep in studio project</button>
          <button type="button" className={styles.secondary} onClick={saveProject} disabled={editingBusy || !validDimensions}>Save box project</button>
          <button type="button" className={styles.secondary} onClick={() => projectInput.current?.click()} disabled={editingBusy}>Open box project</button>
          <input ref={projectInput} type="file" accept=".json,application/json" className={styles.hidden} aria-label="Open box project JSON" onChange={(event) => { void loadProject(event.target.files?.[0]); event.target.value = ""; }} />
        </div>
      </div>

      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
      <p className={styles.status} role="status" aria-live="polite">{notice || "Your originals stay in this browser session. Save a box project to keep the assigned artwork and settings."}</p>

      <section className={styles.stage} aria-labelledby="artwork-source-title">
        <header className={styles.stageHeader}><span className={styles.step}>01</span><div><h2 id="artwork-source-title">Select your artwork</h2><p>Import a PDF or image, choose a page, and crop one printed face at a time.</p></div></header>
        <div className={styles.stageBody}>
          <fieldset disabled={editingBusy} className={styles.resetFieldset}>
            <div className={styles.sourceBar}>
              <div><button type="button" className={styles.primary} onClick={() => fileInput.current?.click()}>{importing ? "Opening artwork…" : "Upload artwork"}</button><p className={styles.hint}>PDF, PNG, JPEG, WebP · 40 MB per file · up to 50 PDF pages</p></div>
              <input ref={fileInput} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp" className={styles.hidden} aria-label="Upload packaging artwork" onChange={(event) => { void importFiles(event.target.files); event.target.value = ""; }} />
              {sources.length > 0 && <div className={styles.sourceControls}>
                <label>Source artwork<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setPage(1); }}>{sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                {source?.kind === "pdf" && <label className={styles.pageField}>PDF page<select value={page} onChange={(event) => setPage(Number(event.target.value))}>{Array.from({ length: source.pageCount }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} of {source.pageCount}</option>)}</select></label>}
                <button type="button" className={styles.textButton} onClick={removeSource}>Remove source</button>
              </div>}
            </div>
          </fieldset>
          <p className={styles.sourceNote}>Use the packaging artwork as the source. For a printer proof or dieline, select the artwork only; exclude notes, measurements, color bars, bleed, and cutting guides. Page size does not set the box dimensions.</p>
          {source ? <div className={styles.cropLayout}>
            <div className={styles.cropCanvasWrap}>
              {pageLoading && <div className={styles.cropPlaceholder} role="status">Rendering page preview on your device…</div>}
              {pageImage && <div className={styles.cropCanvas} style={{ aspectRatio: `${pageImage.width} / ${pageImage.height}`, maxWidth: `${540 * pageImage.width / pageImage.height}px` }} onPointerDown={startCrop} onPointerMove={moveCrop} onPointerUp={(event) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }}>
                {/* Local page pixels; Next image optimization would upload neither useful nor necessary data. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pageImage.dataUrl} alt={`${source.name}, page ${page}. The outlined rectangle is the selected artwork crop.`} draggable={false} />
                <div className={styles.cropSelection} style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}><span>Artwork crop</span></div>
              </div>}
              {!pageLoading && !pageImage && <div className={styles.cropPlaceholder}>This page could not be previewed. Choose another page or source file.</div>}
              <p className={styles.hint}>Drag a rectangle over the artwork, or use the percentage fields. Each new crop uses the original file.</p>
            </div>
            <fieldset disabled={editingBusy || !pageImage} className={styles.cropControls}>
              <legend>Crop &amp; assign</legend>
              <label>Box face<select value={activeFace} onChange={(event) => setActiveFace(event.target.value as BoxFace)}>{BOX_FACES.map((face) => <option key={face} value={face}>{BOX_FACE_LABELS[face]}{panels[face] ? " · has artwork" : " · unassigned"}</option>)}</select></label>
              <div className={styles.cropNumbers}>{(["x", "y", "width", "height"] as const).map((key) => <label key={key}>{key === "x" ? "Left" : key === "y" ? "Top" : key === "width" ? "Width" : "Height"} %<input type="number" min={key === "x" || key === "y" ? 0 : 0.1} max={100} step="0.1" value={Number((crop[key] * 100).toFixed(2))} onChange={(event) => setCropValue(key, event.target.valueAsNumber)} /></label>)}</div>
              <button type="button" className={styles.secondary} onClick={() => setCrop({ ...FULL_ARTWORK_CROP })}>Use full page / image</button>
              <p className={styles.hint}>Selected face: {BOX_FACE_LABELS[activeFace]}{validDimensions ? ` · ${tidyNumber(selectedFaceSize.width)} × ${tidyNumber(selectedFaceSize.height)} mm` : ""}. Set the box’s measured size below.</p>
              <button type="button" className={styles.primary} onClick={() => void assignCrop()} disabled={!pageImage || !validArtworkCrop(crop)}>{assigning ? "Preparing artwork…" : `${selectedPanel ? "Replace" : "Assign"} ${BOX_FACE_LABELS[activeFace].toLowerCase()} artwork`}</button>
              <p className={styles.hint}>Crops keep original proportions. Rotate and adjust fit in the next step.</p>
            </fieldset>
          </div> : <div className={styles.emptyArtwork}><span>PDF / IMAGE</span><p>Start with flat packaging artwork.</p><small>A single panel image works too. Add more artwork files as you map the remaining faces.</small></div>}
        </div>
      </section>

      <section className={styles.stage} aria-labelledby="artwork-box-title">
        <header className={styles.stageHeader}><span className={styles.step}>02</span><div><h2 id="artwork-box-title">Build the package</h2><p>Choose a starting shape, enter physical measurements, and inspect each face.</p></div><span className={styles.coverageBadge}>{assigned.length} / 6 faces assigned</span></header>
        <div className={`${styles.stageBody} ${styles.boxLayout}`}>
          <fieldset disabled={editingBusy} className={styles.boxControls}>
            <legend className={styles.hidden}>Box dimensions and face artwork</legend>
            <div className={styles.presetBlock}>
              <label>Package preset<select value={selectedPreset?.id ?? ""} onChange={(event) => applyPreset(event.target.value)}>
                <option value="">Custom measurements</option>
                <optgroup label="Starter examples · verify dimensions">{STARTER_PACKAGE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}{selectedPreset?.id === preset.id && presetModified ? " · modified" : ""}</option>)}</optgroup>
                {companyPresets.length > 0 && <optgroup label={libraryStorage === "ready" ? "Company presets · this browser" : "Company presets · this session"}>{companyPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}{selectedPreset?.id === preset.id && presetModified ? " · modified" : ""}</option>)}</optgroup>}
                {selectedPreset && !availablePresets.some((preset) => preset.id === selectedPreset.id) && <option value={selectedPreset.id}>{selectedPreset.name} · from project{presetModified ? " · modified" : ""}</option>}
              </select></label>
              <p className={styles.presetDisclosure}>Starter dimensions are illustrative examples, not approved company specifications. Weights in preset names are labels; they do not determine package size.</p>
              {selectedPreset && <p className={styles.presetStatus}><strong>{presetModified ? "Modified preset" : selectedPreset.source === "starter-example" ? "Starter example" : "Company preset"}</strong><span>{presetModified ? "Your measurements, shape, or finish differ from the saved preset." : "Review measurements against your own specifications."}</span></p>}
              <p className={styles.hint}>Changing presets keeps assigned artwork. Review its fit and crop on every face.</p>
              <details className={styles.presetLibrary}>
                <summary>Save &amp; share company presets <span>{companyPresets.length} saved</span></summary>
                <div className={styles.presetSaveRow}><label>New company preset name<input value={presetName} maxLength={100} placeholder="e.g. ACME-CHIPS-300G" onChange={(event) => setPresetName(event.target.value)} /></label><button type="button" className={styles.secondary} disabled={!validDimensions || !presetName.trim() || libraryStorage === "loading"} onClick={saveCompanyPreset}>Save as company preset</button></div>
                <p className={styles.hint}>Saves shape, dimensions, finish, and display unit. Artwork stays in the package project. Saved presets are user supplied and are not marked as approved specifications.</p>
                <div className={styles.actions}><button type="button" className={styles.secondary} disabled={!companyPresets.length} onClick={exportPresetLibrary}>Export company library</button><button type="button" className={styles.secondary} disabled={libraryStorage === "loading"} onClick={() => libraryInput.current?.click()}>Import company library</button></div>
                <input ref={libraryInput} type="file" accept=".json,application/json" className={styles.hidden} aria-label="Import company preset library JSON" onChange={(event) => { void importPresetLibrary(event.target.files?.[0]); event.target.value = ""; }} />
                <p className={styles.hint}>{libraryStorage === "unavailable" ? "Browser storage is unavailable. Export your library before leaving this session." : "Saved in this browser. Share the exported JSON with your team; presets do not sync through the cloud."} Imports keep existing presets and rename conflicting copies.</p>
              </details>
              <label>Package shape<select value={shape} onChange={(event) => { setShape(event.target.value as PackageShape); changed(); setNotice("Package shape changed. Assigned artwork is kept; review its fit and orientation."); }}><option value="carton">Rectangular carton</option><option value="pillow-bag">Pillow bag · illustrative model</option></select></label>
            </div>
            <div className={styles.sectionLabel}><h3>Measured dimensions</h3><label className={styles.unitField}><span className={styles.hidden}>Dimension unit</span><select aria-label="Dimension unit" value={unit} onChange={(event) => switchUnit(event.target.value as "mm" | "in")}><option value="mm">mm</option><option value="in">inches</option></select></label></div>
            <div className={styles.dimensions}>{(["width", "height", "depth"] as const).map((key) => <label key={key}>{key[0].toUpperCase() + key.slice(1)} ({unit})<input type="number" min="0.01" max={unit === "mm" ? 10000 : 393.7} step="any" value={dimensionInputs[key]} onChange={(event) => updateDimension(key, event.target.value)} /></label>)}</div>
            <p className={styles.hint}>Enter the package’s external width, height, and depth. Starter measurements are examples; artwork page size is separate.</p>
            {!validDimensions && <p className={styles.validation}>Each dimension must be greater than 0 and no more than 10,000 mm.</p>}
            <div className={styles.sectionLabel}><h3>Face artwork</h3><span className={styles.hint}>Select a face to adjust it</span></div>
            <div className={styles.faceGrid}>{BOX_FACES.map((face) => <button type="button" key={face} className={styles.face} aria-pressed={activeFace === face} onClick={() => setActiveFace(face)}>
              <span className={styles.faceThumb} style={{ backgroundColor: panels[face]?.background ?? baseColor }}>{panels[face] ? <img src={panels[face]!.dataUrl} alt="" style={{ transform: `rotate(${panels[face]!.rotation}deg)` }} /> : <span aria-hidden="true">＋</span>}</span>
              <strong>{BOX_FACE_LABELS[face]}</strong><small>{panels[face] ? "Assigned" : "Unassigned"}</small>
            </button>)}</div>
            <div className={styles.panelEditor}>
              <div className={styles.sectionLabel}><h3>{BOX_FACE_LABELS[activeFace]} panel</h3>{selectedPanel && <button type="button" className={styles.textButton} onClick={removePanel}>Clear face</button>}</div>
              {selectedPanel ? <>
                <p className={styles.sourceName}>{selectedPanel.name}</p>
                <div className={styles.panelOptions}><label>Rotation<select value={selectedPanel.rotation} onChange={(event) => updatePanel({ rotation: Number(event.target.value) as BoxPanel["rotation"] })}><option value={0}>0° · original</option><option value={90}>90° clockwise</option><option value={180}>180°</option><option value={270}>270° clockwise</option></select></label><label>Artwork fit<select value={selectedPanel.fit} onChange={(event) => updatePanel({ fit: event.target.value as BoxPanel["fit"] })}><option value="contain">Fit entire artwork</option><option value="cover">Fill face · crop edges</option></select></label></div>
                <label className={styles.colorField}>Panel background<input type="color" value={selectedPanel.background} onChange={(event) => updatePanel({ background: event.target.value })} /><span>{selectedPanel.background}</span></label>
                <p className={styles.hint}>{selectedPanel.fit === "cover" ? "Fill face trims artwork at the edges. Check that text and marks remain visible." : "Fit entire artwork keeps every edge visible; unused space uses the panel background."}</p>
              </> : <p className={styles.hint}>This face is plain. Select its artwork above and assign the crop to {BOX_FACE_LABELS[activeFace].toLowerCase()}.</p>}
            </div>
            <div className={styles.materialRow}><label>Surface finish<select value={finish} onChange={(event) => { setFinish(event.target.value as BoxFinish); changed(); }}><option value="matte">Matte</option><option value="satin">Satin</option></select></label><label className={styles.colorField}>Plain faces<input type="color" value={baseColor} onChange={(event) => { setBaseColor(event.target.value); changed(); }} /><span>{baseColor}</span></label></div>
          </fieldset>
          <div className={styles.previewPanel}>
            <div className={styles.sectionLabel}><h3>Live package preview</h3><span className={styles.eyebrow}>{shape === "pillow-bag" ? "Illustrative bag" : "Measured geometry"}</span></div>
            <BoxPreview ref={previewRef} dimensions={dimensions} panels={panels} finish={finish} baseColor={baseColor} shape={shape} displayUnit={unit} />
            <p className={styles.previewNote}>{assigned.length === 6 ? "All six faces have assigned artwork. Inspect every face for crop, orientation, and fit." : `${6 - assigned.length} ${6 - assigned.length === 1 ? "face is" : "faces are"} unassigned and will stay plain: ${BOX_FACES.filter((face) => !panels[face]).map((face) => BOX_FACE_LABELS[face].toLowerCase()).join(", ")}.`}</p>
            <p className={styles.hint}>{shape === "pillow-bag" ? "An illustrative pillow bag with a curved body and sealed ends. It does not predict the exact filled shape, wrinkles, or seam construction of a real bag." : "A simple rectangular carton. This preview does not fold arbitrary dielines or reproduce metallic inks."} Check artwork and label accuracy before publication.</p>
          </div>
        </div>
      </section>

      <section className={styles.stage} aria-labelledby="artwork-render-title">
        <header className={styles.stageHeader}><span className={styles.step}>03</span><div><h2 id="artwork-render-title">Render the views</h2><p>Front, back, left, right, top, bottom, and a three-quarter hero on white.</p></div></header>
        <div className={styles.stageBody}>
          <div className={styles.renderBar}>
            <label>PNG size<select value={size} disabled={editingBusy} onChange={(event) => setSize(Number(event.target.value))}><option value={1024}>1024 × 1024 · draft</option><option value={2048}>2048 × 2048 · standard</option><option value={4096}>4096 × 4096 · large</option></select></label>
            <button type="button" className={styles.primary} onClick={() => void renderViews()} disabled={editingBusy || !validDimensions || !assigned.length}>{rendering ? `Rendering ${progress} of 7…` : "Render 7 views locally"}<span aria-hidden="true">↗</span></button>
            {rendering && <button type="button" className={styles.secondary} onClick={() => { renderToken.current++; setProgress(null); setNotice("Rendering cancelled. Your box settings and previous results are kept."); }}>Cancel</button>}
          </div>
          <p className={styles.hint}>{!assigned.length ? "Assign artwork to at least one face to render." : "Artwork is mapped directly onto the package, with no generated lettering. Local rendering is free; the browser needs to stay open."}</p>
          {rendering && <progress className={styles.progress} value={progress ?? 0} max={7} aria-label="Packshot render progress" />}
          {batch && <div className={styles.results}>
            <div className={styles.resultsHeader}><div><h3>Seven rendered views</h3><p>{batch.size} × {batch.size} PNG · {batch.name || "My box"}</p></div><button type="button" className={styles.primary} disabled={downloading || rendering} onClick={() => void downloadZip()}>{downloading ? "Preparing ZIP…" : "Download all + manifest"}</button></div>
            {stale && <p className={styles.stale} role="status">The package has changed since these views were rendered. Render again to include your latest edits.</p>}
            <div className={styles.resultGrid}>{batch.views.map((view) => {
              const coverage = coverageForAngle(view.angle, batch.settings.panels, batch.settings.shape);
              const label = PACK_ANGLES.find((angle) => angle.id === view.angle)!.label;
              return <article className={styles.result} key={view.angle}>
                <a href={view.dataUrl} download={`${artworkFileName(batch.name)}_${view.angle}.png`} aria-label={`Download ${label} PNG`}><img src={view.dataUrl} alt={`${label} view of ${batch.name || "the box"}`} /></a>
                <div><strong>{label}</strong><span>{coverage.complete ? (batch.settings.shape === "pillow-bag" ? "Visible regions assigned" : "Visible faces assigned") : `Plain: ${coverage.blank.join(", ")}`}</span><a className={styles.downloadLink} href={view.dataUrl} download={`${artworkFileName(batch.name)}_${view.angle}.png`}>Download PNG ↓</a>
                  {!stale && !rendering && !!view.dataUrl && coverage.mapped.length > 0 && <CampaignHandoffButton source={view.dataUrl} meta={{
                    name: `${batch.name || "Package"} · ${label}`,
                    angle: view.angle,
                    source: "artwork",
                    variant: "Local artwork render",
                    review: "needs-review",
                    note: `${batch.settings.shape === "pillow-bag" ? "Illustrative pillow bag. " : "Measured carton. "}${coverage.complete ? "Visible artwork regions are assigned; check crop, orientation and labels." : `Unassigned visible regions: ${coverage.blank.join(", ")}.`}`,
                  }} />}
                </div>
              </article>;
            })}</div>
            {batch.settings.shape === "pillow-bag" && <p className={styles.hint}>Bag coverage includes neighbouring regions that can appear along the curved flanks and shoulders.</p>}
            <p className={styles.hint}>The ZIP includes all seven images and a manifest of dimensions, source crops, face assignments, and settings. These renders are not a certification of packaging or print accuracy.</p>
            {onUseAsReferences && <div className={styles.optionalAI}><div><h3>Optional: continue in the photo workflow</h3><p>Use the six face renders as references for AI restyling. AI can alter text and details; keep these local PNGs as your originals.</p></div><button type="button" className={styles.secondary} disabled={rendering || stale} onClick={async () => { try { await onUseAsReferences(batch.views.filter((view) => view.angle !== "hero34")); } catch (cause) { if (alive.current) setError(messageFor(cause)); } }}>Use renders as photo references</button></div>}
          </div>}
        </div>
      </section>
    </div>
  );
}

export default ArtworkStudio;
