import { validBoxDimensions, type BoxDimensions, type BoxFinish, type PackageShape } from "./packaging";

export type PresetSource = "starter-example" | "local-company";
export type PresetIdentity = { id: string; name: string; source: PresetSource };
export type PackagePreset = PresetIdentity & {
  dimensions: BoxDimensions;
  shape: PackageShape;
  finish: BoxFinish;
  unit: "mm" | "in";
  basedOn?: PresetIdentity;
};
export type PackageMeasurements = { dimensions: BoxDimensions; shape?: PackageShape; finish: BoxFinish };
export type PresetProvenance = PresetIdentity & { modified: boolean; basedOn?: PresetIdentity };

export const COMPANY_PRESET_STORAGE_KEY = "packshot-company-presets-v1";
export const MAX_COMPANY_PRESETS = 100;
export const MAX_PRESET_LIBRARY_BYTES = 1024 * 1024;

/** Deliberately illustrative; product weight in a name does not establish physical size. */
export const STARTER_PACKAGE_PRESETS: readonly PackagePreset[] = [
  { id: "starter:brand-a-chips-300g", name: "BRAND-A-CHIPS-300G", dimensions: { width: 190, height: 300, depth: 80 }, shape: "pillow-bag", finish: "satin", unit: "mm", source: "starter-example" },
  { id: "starter:brand-a-cookies-box-500g", name: "BRAND-A-COOKIES-BOX-500G", dimensions: { width: 220, height: 150, depth: 65 }, shape: "carton", finish: "matte", unit: "mm", source: "starter-example" },
  { id: "starter:brand-a-cereal-box-375g", name: "BRAND-A-CEREAL-BOX-375G", dimensions: { width: 190, height: 280, depth: 60 }, shape: "carton", finish: "matte", unit: "mm", source: "starter-example" },
  { id: "starter:brand-a-crackers-box-200g", name: "BRAND-A-CRACKERS-BOX-200G", dimensions: { width: 140, height: 210, depth: 50 }, shape: "carton", finish: "matte", unit: "mm", source: "starter-example" },
  { id: "starter:brand-a-tea-box-100g", name: "BRAND-A-TEA-BOX-100G", dimensions: { width: 90, height: 135, depth: 65 }, shape: "carton", finish: "matte", unit: "mm", source: "starter-example" },
  { id: "starter:brand-a-chocolate-box-200g", name: "BRAND-A-CHOCOLATE-BOX-200G", dimensions: { width: 180, height: 95, depth: 25 }, shape: "carton", finish: "matte", unit: "mm", source: "starter-example" },
];

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validName = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 100;
const validId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9._:-]{1,100}$/.test(value);

function identity(value: unknown): PresetIdentity | undefined {
  if (!record(value) || !validId(value.id) || !validName(value.name) || typeof value.source !== "string" || !["starter-example", "local-company"].includes(value.source)) return undefined;
  return { id: value.id, name: value.name.trim(), source: value.source as PresetSource };
}

export function readPackagePreset(value: unknown): PackagePreset {
  const label = identity(value);
  if (!record(value) || !label || !record(value.dimensions) || !validBoxDimensions(value.dimensions as BoxDimensions) ||
    typeof value.shape !== "string" || !["carton", "pillow-bag"].includes(value.shape) ||
    typeof value.finish !== "string" || !["matte", "satin"].includes(value.finish) ||
    typeof value.unit !== "string" || !["mm", "in"].includes(value.unit)) {
    throw new Error("A preset has an invalid name, shape, finish, unit, or physical measurement.");
  }
  const dimensions = value.dimensions as BoxDimensions;
  const basedOn = value.basedOn === undefined ? undefined : identity(value.basedOn);
  if (value.basedOn !== undefined && !basedOn) throw new Error("A preset contains invalid source information.");
  return { ...label, dimensions: { width: dimensions.width, height: dimensions.height, depth: dimensions.depth }, shape: value.shape as PackageShape, finish: value.finish as BoxFinish, unit: value.unit as "mm" | "in", ...(basedOn ? { basedOn } : {}) };
}

export function presetMatches(preset: PackagePreset, settings: PackageMeasurements): boolean {
  return preset.shape === (settings.shape ?? "carton") && preset.finish === settings.finish &&
    (["width", "height", "depth"] as const).every((key) => Math.abs(preset.dimensions[key] - settings.dimensions[key]) < 0.000001);
}

export function presetProvenance(preset: PackagePreset | null, settings: PackageMeasurements): PresetProvenance | null {
  if (!preset) return null;
  return { id: preset.id, name: preset.name, source: preset.source, modified: !presetMatches(preset, settings), ...(preset.basedOn ? { basedOn: { ...preset.basedOn } } : {}) };
}

export function createCompanyPreset(name: string, settings: PackageMeasurements, unit: "mm" | "in", basedOn: PackagePreset | null, id: string): PackagePreset {
  return readPackagePreset({ id, name: name.trim(), dimensions: settings.dimensions, shape: settings.shape ?? "carton", finish: settings.finish, unit, source: "local-company", ...(basedOn ? { basedOn: { id: basedOn.id, name: basedOn.name, source: basedOn.source } } : {}) });
}

export function parsePresetLibrary(text: string): PackagePreset[] {
  if (text.length > MAX_PRESET_LIBRARY_BYTES) throw new Error("Choose a preset library smaller than 1 MB.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("This is not a valid preset library JSON file."); }
  if (!record(raw) || raw.schema !== "packshot-preset-library" || raw.version !== 1 || !Array.isArray(raw.presets) || raw.presets.length > MAX_COMPANY_PRESETS) {
    throw new Error("Choose a version 1 preset library with no more than 100 presets.");
  }
  return raw.presets.map((value) => {
    const preset = readPackagePreset(value);
    if (preset.source !== "local-company") throw new Error("Company preset libraries may contain saved company presets only. The six starter examples are already available in the studio.");
    return preset;
  });
}

export function serializePresetLibrary(presets: PackagePreset[]): string {
  const json = JSON.stringify({ schema: "packshot-preset-library", version: 1, presets }, null, 2);
  parsePresetLibrary(json);
  return json;
}

/** Imports add copies or skip exact duplicates; they never replace an existing preset. */
export function mergePresetLibraries(existing: PackagePreset[], incoming: PackagePreset[], newId: () => string) {
  const presets = existing.map((preset) => readPackagePreset(preset));
  let added = 0, skipped = 0, renamed = 0;
  for (const candidate of incoming) {
    const preset = readPackagePreset(candidate);
    const sameName = presets.find((item) => item.name.toLocaleLowerCase() === preset.name.toLocaleLowerCase());
    const sameProvenance = sameName && sameName.source === preset.source &&
      sameName.basedOn?.id === preset.basedOn?.id && sameName.basedOn?.name === preset.basedOn?.name && sameName.basedOn?.source === preset.basedOn?.source;
    if (sameName && presetMatches(sameName, preset) && sameName.unit === preset.unit && sameProvenance) { skipped++; continue; }
    if (presets.length >= MAX_COMPANY_PRESETS) throw new Error("This import would exceed 100 company presets. Split the shared library into a smaller file.");
    const occupiedIds = new Set([...STARTER_PACKAGE_PRESETS, ...presets].map((item) => item.id));
    if (occupiedIds.has(preset.id)) {
      preset.id = newId();
      if (!validId(preset.id) || occupiedIds.has(preset.id)) throw new Error("Could not assign a unique ID to an imported preset. Please retry.");
    }
    const occupiedNames = new Set([...STARTER_PACKAGE_PRESETS, ...presets].map((item) => item.name.toLocaleLowerCase()));
    if (occupiedNames.has(preset.name.toLocaleLowerCase())) {
      let index = 2;
      let name: string;
      do { name = `${preset.name.slice(0, 85)} (import ${index++})`; } while (occupiedNames.has(name.toLocaleLowerCase()));
      preset.name = name;
      renamed++;
    }
    presets.push({ ...preset, source: "local-company" });
    added++;
  }
  return { presets, added, skipped, renamed };
}
