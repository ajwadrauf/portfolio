# VELUNE visual references — revision 2

Updated 11 September 2026. The selected pack contains nine newly supplied images. The original eight files remain available so saved projects keep their original inputs. New example copies use only the nine selected v2 JPEGs.

## Names and upload order

| Upload file | Original supplied filename |
| --- | --- |
| `01_velune_pistachio_carton.jpeg` | `ChatGPT Image Sep 11, 2026, 07_44_02 PM.png` |
| `02_velune_raspberry_carton.jpeg` | `ChatGPT Image Sep 11, 2026, 07_44_37 PM.png` |
| `03_velune_caramel_carton.jpeg` | `ChatGPT Image Sep 11, 2026, 07_44_48 PM.png` |
| `04_velune_raspberry_ingredient.jpeg` | `ChatGPT Image Sep 11, 2026, 07_44_53 PM.png` |
| `05_velune_pistachio_ingredient.jpeg` | `ChatGPT Image Sep 11, 2026, 07_44_56 PM.png` |
| `06_velune_three_flavour_serving.jpeg` | `Codex Image Sep 11, 2026, 06_49_18 PM.png` |
| `07_velune_working_studio.jpeg` | `ChatGPT Image Sep 11, 2026, 07_45_01 PM.png` |
| `08_velune_opening_chocolate.jpeg` | `ChatGPT Image Sep 11, 2026, 07_45_05 PM.png` |
| `09_velune_final_reveal.jpeg` | `ChatGPT Image Sep 11, 2026, 07_45_09 PM.png` |

New PNGs were converted to JPEG at their original 1672 × 941 dimensions, quality 96 with 4:4:4 chroma. The retained whole bonbon and pistachio-centre JPEGs are byte-for-byte copies at 1254 × 1254. Originals in Downloads were not renamed or edited.

The extra `Codex Image Sep 11, 2026, 06_50_35 PM.png` is a collage. Its individual subjects already have dedicated images, so it is excluded from the site reference pack and provider request. See `REFERENCE_V2_FILES.json` for machine-readable provenance.

## Where these are used

- `src/lib/veluneReferences.ts`: versioned manifest, roles, actual dimensions and scene associations. `VELUNE_REFERENCES` is current; `VELUNE_ALL_REFERENCES` allows old URLs to remain usable and measurable.
- `public/studio/velune/references/v2/`: the eleven archived v2 JPEGs, of which nine are selected now.
- `/velune#visual-references`: grouped gallery, numbered upload slots and downloads.
- Ad Lab's top **Load VELUNE example** button: fresh **VELUNE v2 · 9-image working copy**, H3 Max, nine images plus the existing Blender video. Existing saved drafts are not migrated.
- Prompt Builder and project assets use the same current manifest. Campaign Studio's single-image starter now correctly describes the solo pistachio carton. Packshots' flat-artwork loader remains unchanged.

The two older chocolate studies control S05/S07 shell detail and S06 cutaway. The new serving controls the three-flavour plate; its more visible nut pieces do not redefine the older S06 reference. The new opening is tight and empty; the ending uses a wider product reveal. Carton camera angles differ, so the prompt requests registered turns without mirrored lettering.

## Downloads and finishing

`public/studio/velune/velune_h3_v2_pack.zip` contains the nine selected JPEGs, unchanged Blender guide, current H3 prompt, separate ElevenLabs direction, provenance and the revised report SVG. Build it from checked-in assets with `node scripts/build-velune-reference-pack.cjs`.

`public/studio/velune/finishing/velune_centre_report_v2.svg` is a self-contained exact graphic built from the supplied carton/serving images and typeset headings. It is a finishing document in the project, not an additional image reference. It must be composited over the generated S11 interval in the final edit; the application does not claim it has already been inserted into an MP4.

No new paid film or audio generation was run during integration. The updated final film is still pending. The Seedance example toggle is explicitly deferred.

## Nine-image correction

H3 permits nine images independently of its twelve-file combined limit. The older whole bonbon and pistachio-centre studies remain archived but are excluded from the current example, gallery and upload ZIP. The current manifest and downloaded filenames are numbered 01–09. Hosted URLs retain their original v2 paths for compatibility; the `download` filenames and prompt match the new order. `REFERENCE_V2_FILES.json` records the original ingestion names; the ZIP source manifest maps the current names.
