# VELUNE supplied visual references

Integrated 11 September 2026. These are the eight AI-generated JPEGs supplied by Ajwad, preserved with their original names and bytes under `public/studio/velune/references/`.

The public walkthrough is `/velune#visual-references`. It distinguishes the appearance studies from the original Blender layouts and flat artwork. The finished Seedance film remains pending.

| Image token | Original filename | Purpose / shots |
| --- | --- | --- |
| Image1 | 01_velune_packaging.jpeg | Three flavour cartons; S02–04, artwork direction for S11 |
| Image2 | 02_velune_whole_bonbon.jpeg | V-groove shell and whole product; S05, S07, S10 |
| Image3 | 03_velune_pistachio_centre.jpeg | Cut shell and filling; S06 |
| Image4 | 04_velune_caramel_centre.jpeg | Contained caramel half; S10 |
| Image5 | 05_velune_host.jpeg | Synthetic host appearance; S01, S06, S12 |
| Image6 | 06_velune_chocolatier.jpeg | Synthetic chocolatier appearance; S06, S07 |
| Image7 | 07_velune_chocolate_tunnel.jpeg | Chocolate folds and central aperture; S01, S12 |
| Image8 | 08_velune_discovery_studio.jpeg | Two back-facing workers and 3+2 bonbon stacks; S07 |

`Video1` remains the actual Blender camera study. It defines the motion, composition, registered product movement and twelve-shot 15-second edit. Each image is attached once; multiple shots can refer to the same token. The separate report concept remains a compositing artifact, not an invented ninth image upload.

The shared manifest is `src/lib/veluneReferences.ts`. New VELUNE project copies include all eight images with provenance, named roles, file names and shot associations. General Prompt Builder, Blender and Ad Lab use the same ordering. Campaign Studio starts from the three-carton appearance reference. Packshots retains its original flat-artwork loader because a perspective product image is not a replacement for a printable panel.

Existing projects and drafts are preserved. **Project & assets → Add visual references** adds only missing reference assets; it does not replace edited prompts, paid results or reference assignments. **Load VELUNE example** makes a fresh copy with the updated defaults. Missing files in older projects are explicitly marked in Ad Lab's slot manifest and block unresolved bindings from silently shifting to another image.

Two production details are explicit in the new direction:

- Discovery-studio clothing comes from Image8: both workers face away and wear ivory jackets/plum aprons. The host's plum portrait outfit does not override that scene.
- S08/S09 are raspberry and pistachio ingredient inserts. The uploaded cut-centre bonbons must not replace them. No raspberry-filling reference has been supplied.

Verification: production build/TypeScript; 137 production-brief checks including the actual JPEG bytes inside a nine-input ZIP; connected-project and Ad binding checks; existing campaign and audio/draft suites. Browser checks verified all eight gallery images, mobile width, adding to an older project, and a fresh Ad example with eight images plus the Blender guide and matching positional bindings. All generation checks were offline/mocked; no paid request was made.
