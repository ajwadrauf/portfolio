/** Supplied AI-generated appearance references, in the user's generation order.
 * These are fictional concept assets, not authenticated product photography.
 * Keep token order stable across Prompt Builder, Blender and Ad Lab.
 */
export type VeluneReference = {
  id: string; index: number; fileName: string; url: string; title: string;
  role: string; shotIds: readonly string[]; kind: "product" | "casting" | "scene";
  width: number; height: number;
};
const reference = (index: number, id: string, fileName: string, title: string, kind: VeluneReference["kind"], role: string, shotIds: readonly string[], width: number, height: number): VeluneReference =>
  ({ index, id: `velune-ref-${id}`, fileName, url: `/studio/velune/references/${fileName}`, title, kind, role, shotIds, width, height });

export const VELUNE_REFERENCES: readonly VeluneReference[] = [
  reference(1, "packaging", "01_velune_packaging.jpeg", "Three-flavour packaging", "product", "Carton proportions, VELUNE branding and flavour colours: pistachio green, raspberry plum and caramel gold. Use each matching carton during the registered turns; this perspective image is not flat label artwork.", ["S02", "S03", "S04", "S11"], 1672, 941),
  reference(2, "bonbon", "02_velune_whole_bonbon.jpeg", "Whole bonbon", "product", "Rounded pillow shape, restrained V groove, shell finish and highlight behaviour. Preserve the Blender scene's product counts and arrangement.", ["S05", "S07", "S10"], 1254, 1254),
  reference(3, "pistachio", "03_velune_pistachio_centre.jpeg", "Pistachio centre", "product", "Cut shell and textured pistachio filling for the chocolate-half reveal. S09 is a separate ingredient insert, not another cutaway bonbon.", ["S06"], 1254, 1254),
  reference(4, "caramel", "04_velune_caramel_centre.jpeg", "Caramel centre", "product", "Same shell family with a glossy, contained caramel centre. Match the whole-and-half serving shot without turning the filling into a pouring liquid.", ["S10"], 1254, 1254),
  reference(5, "host", "05_velune_host.jpeg", "Host character", "casting", "User-supplied synthetic host concept: facial appearance, plum clothing and restrained expressions. Apply the portrait wardrobe only to the host appearances, not the discovery-studio workers.", ["S01", "S06", "S12"], 1122, 1402),
  reference(6, "chocolatier", "06_velune_chocolatier.jpeg", "Chocolatier character", "casting", "User-supplied synthetic chocolatier concept: appearance, ivory jacket and plum apron. Keep the two observers and the back-facing studio workers distinct.", ["S06", "S07"], 1122, 1402),
  reference(7, "tunnel", "07_velune_chocolate_tunnel.jpeg", "Chocolate tunnel", "scene", "Receding chocolate folds, thin caramel veins and the small central host. Use for scene appearance; the Blender video controls camera, timing and framing.", ["S01", "S12"], 1672, 941),
  reference(8, "studio", "08_velune_discovery_studio.jpeg", "Discovery studio", "scene", "Two back-facing workers in ivory jackets and plum aprons, with five bonbons stacked three left and two right. This scene-specific wardrobe and staging take priority over the host portrait.", ["S07"], 1672, 941),
];

export function veluneShotReferenceIds(shotId: string): string[] {
  return VELUNE_REFERENCES.filter((reference) => reference.shotIds.includes(shotId)).map((reference) => reference.id);
}
