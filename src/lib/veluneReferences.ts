/** Versioned fictional AI appearance references. Old URLs remain valid for saved drafts. */
export type VeluneReference = {
  id: string; index: number; fileName: string; url: string; title: string;
  role: string; shotIds: readonly string[]; kind: "product" | "casting" | "scene";
  width: number; height: number;
};
const reference = (index: number, id: string, fileName: string, title: string, kind: VeluneReference["kind"], role: string, shotIds: readonly string[], width: number, height: number): VeluneReference =>
  ({ index, id: `velune-ref-${id}`, fileName, url: `/studio/velune/references/${fileName}`, title, kind, role, shotIds, width, height });

export const VELUNE_LEGACY_REFERENCES: readonly VeluneReference[] = [
  reference(1, "packaging", "01_velune_packaging.jpeg", "Three-flavour packaging", "product", "Carton proportions, VELUNE branding and flavour colours: pistachio green, raspberry plum and caramel gold. Use each matching carton during the registered turns; this perspective image is not flat label artwork.", ["S02", "S03", "S04", "S11"], 1672, 941),
  reference(2, "bonbon", "02_velune_whole_bonbon.jpeg", "Whole bonbon", "product", "Rounded pillow shape, restrained V groove, shell finish and highlight behaviour. Preserve the Blender scene's product counts and arrangement.", ["S05", "S07", "S10"], 1254, 1254),
  reference(3, "pistachio", "03_velune_pistachio_centre.jpeg", "Pistachio centre", "product", "Cut shell and textured pistachio filling for the chocolate-half reveal. S09 is a separate ingredient insert, not another cutaway bonbon.", ["S06"], 1254, 1254),
  reference(4, "caramel", "04_velune_caramel_centre.jpeg", "Caramel centre", "product", "Same shell family with a glossy, contained caramel centre. Match the whole-and-half serving shot without turning the filling into a pouring liquid.", ["S10"], 1254, 1254),
  reference(5, "host", "05_velune_host.jpeg", "Host character", "casting", "User-supplied synthetic host concept: facial appearance, plum clothing and restrained expressions. Apply the portrait wardrobe only to the host appearances, not the discovery-studio workers.", ["S01", "S06", "S12"], 1122, 1402),
  reference(6, "chocolatier", "06_velune_chocolatier.jpeg", "Chocolatier character", "casting", "User-supplied synthetic chocolatier concept: appearance, ivory jacket and plum apron. Keep the two observers and the back-facing studio workers distinct.", ["S06", "S07"], 1122, 1402),
  reference(7, "tunnel", "07_velune_chocolate_tunnel.jpeg", "Chocolate tunnel", "scene", "Receding chocolate folds, thin caramel veins and the small central host. Use for scene appearance; the Blender video controls camera, timing and framing.", ["S01", "S12"], 1672, 941),
  reference(8, "studio", "08_velune_discovery_studio.jpeg", "Discovery studio", "scene", "Two back-facing workers in ivory jackets and plum aprons, with five bonbons stacked three left and two right. This scene-specific wardrobe and staging take priority over the host portrait.", ["S07"], 1672, 941),
];

const v2 = (index: number, id: string, fileName: string, title: string, kind: VeluneReference["kind"], role: string, shotIds: readonly string[], width = 1672, height = 941): VeluneReference =>
  ({ ...reference(index, `v2-${id}`, fileName, title, kind, role, shotIds, width, height), url: `/studio/velune/references/v2/${fileName}` });

/** Archived initial v2 selection. Its eleven images exceed H3’s per-image-list cap. */
export const VELUNE_V2_ARCHIVE: readonly VeluneReference[] = [
  v2(1, "pistachio-carton", "01_velune_pistachio_carton.jpeg", "Pistachio carton", "product", "Solo pistachio-green carton: folded paperboard, printed whole-and-cut chocolate, clear side depth. Keep front lettering readable; register its position with the other two carton shots without mirroring the artwork.", ["S02", "S11"]),
  v2(2, "raspberry-carton", "02_velune_raspberry_carton.jpeg", "Raspberry carton", "product", "Solo raspberry-plum carton with exposed berry centre printed on the front. Preserve its flavour colour, paper texture and family proportions; exact side-panel lettering needs finishing review.", ["S03", "S11"]),
  v2(3, "caramel-carton", "03_velune_caramel_carton.jpeg", "Caramel carton", "product", "Solo caramel-gold carton with amber centre printed on the front. The printed chocolate stays on the carton face; preserve the physical fold seams and soft contact shadows.", ["S04", "S11"]),
  v2(4, "bonbon", "04_velune_whole_bonbon.jpeg", "Whole bonbon · retained", "product", "Retained V-groove shell and rounded square bonbon. Use its fine chocolate surface for the question-mark assembly and studio display; avoid toy-like gloss.", ["S05", "S07"], 1254, 1254),
  v2(5, "pistachio-centre", "05_velune_pistachio_centre.jpeg", "Pistachio centre · retained", "product", "Retained cut shell and finely textured pistachio praline for the fork reveal. This image controls S06; the newer serving image controls the three-flavour plate.", ["S06"], 1254, 1254),
  v2(6, "raspberry-ingredient", "06_velune_raspberry_ingredient.jpeg", "Raspberry ingredient", "product", "A whole raspberry with individual drupelets, fine hairs and natural unevenness. Use for the ingredient insert, not the raspberry ganache or a chocolate cutaway.", ["S08"]),
  v2(7, "pistachio-ingredient", "07_velune_pistachio_ingredient.jpeg", "Pistachio ingredient", "product", "An already-open nut with dry cream shell, green kernel and purple skin. Shell and kernel stay one stable assembly during the small turn.", ["S09"]),
  v2(8, "serving", "08_velune_three_flavour_serving.jpeg", "Three-flavour serving", "product", "Exactly three cut halves on an ivory dish: pistachio left, raspberry middle, caramel right. Centres face camera. Replaces the Blender guide's two-piece serving; fillings remain contained.", ["S10", "S11", "S12"]),
  v2(9, "studio", "09_velune_working_studio.jpeg", "A working discovery studio", "scene", "Two workers from behind, heads outside the crop, ivory jackets and plum aprons. Continue the tasting-utensil and open-hand gestures during the camera pullback. Keep the display stacks at three left and two right.", ["S06", "S07"]),
  v2(10, "opening", "10_velune_opening_chocolate.jpeg", "Curiosity · tight opening", "scene", "Close asymmetric chocolate folds around a small empty aperture. No host or plate. This framing overrides the original guide's opening and is deliberately different from the final reveal.", ["S01"]),
  v2(11, "reveal", "11_velune_final_reveal.jpeg", "Wonder within · product reveal", "scene", "A wider chocolate passage with the three-centre dish grounded in the lower left and room for the tagline at right. Overrides the guide's returning host. Match the serving reference for precise food appearance.", ["S12"]),
];

/** H3 permits nine images. Retain URLs/IDs for saved projects, but number the
 * current upload names and tokens consecutively after removing the two older studies. */
export const VELUNE_REFERENCES: readonly VeluneReference[] = VELUNE_V2_ARCHIVE
  .filter((r) => r.index !== 4 && r.index !== 5)
  .map((r, i) => ({ ...r, index: i + 1, fileName: r.fileName.replace(/^\d+/, String(i + 1).padStart(2, "0")),
    ...(r.id === "velune-ref-v2-serving" ? { shotIds: ["S06", "S10", "S11", "S12"], role: "Three cut halves on an ivory dish: pistachio left, raspberry middle, caramel right. Use ONLY the left pistachio half for the solo fork reveal, without the dish or other flavours. Use all three halves for the serving and final reveal; fillings remain contained." } : {}),
    ...(r.id === "velune-ref-v2-studio" ? { shotIds: ["S05", "S06", "S07"], role: "Two back-facing workers, heads outside the crop, ivory jackets and plum aprons. Small tasting-utensil and open-hand gestures during the pullback. Stacks of three bonbons left and two right define the whole V-groove chocolate form, also used for the question-mark assembly." } : {}),
  }));

/** Server allowlisting and cost measurement include the original files for saved projects. */
export const VELUNE_ALL_REFERENCES = [...VELUNE_LEGACY_REFERENCES, ...VELUNE_V2_ARCHIVE];

export function veluneShotReferenceIds(shotId: string): string[] {
  return VELUNE_REFERENCES.filter((reference) => reference.shotIds.includes(shotId)).map((reference) => reference.id);
}
