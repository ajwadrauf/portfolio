import type { ArtworkCrop } from "./artwork";
import type { BoxFace } from "./packaging";

/** Supplied reference photographs; crops select the panel inside each photograph. */
export const VELUNE_PACKAGE_PANELS: readonly { face: BoxFace; label: string; url: string; crop: ArtworkCrop }[] = [
  { face: "front", label: "Front · Pistachio Praline", url: "/studio/velune/references/v2/01_velune_pistachio_carton.jpeg", crop: { x: .374, y: .122, width: .288, height: .735 } },
  { face: "back", label: "Back · Product story & information", url: "/studio/velune/panels/velune-pistachio-back.png", crop: { x: .047, y: .061, width: .906, height: .867 } },
  { face: "top", label: "Top · VELUNE collection", url: "/studio/velune/panels/velune-pistachio-top.png", crop: { x: .047, y: .128, width: .905, height: .709 } },
  { face: "bottom", label: "Bottom · Barcode panel", url: "/studio/velune/panels/velune-pistachio-bottom.png", crop: { x: .044, y: .237, width: .909, height: .487 } },
  { face: "left", label: "Left · Rising cream line", url: "/studio/velune/panels/velune-pistachio-left.png", crop: { x: .35, y: .046, width: .30, height: .90 } },
  { face: "right", label: "Right · Falling cream line", url: "/studio/velune/panels/velune-pistachio-right.png", crop: { x: .418, y: .026, width: .16, height: .932 } },
];
export const VELUNE_PACKAGE_COLOR = "#98a76b";
