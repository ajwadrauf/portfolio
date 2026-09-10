# S05 deterministic chocolate spread

Implemented in `work/blender/velune_spread.py` and executed in Blender 5.2.1 LTS on 2026-09-10.

Replace the previous loft block inside `question()` with:

```python
from velune_spread import build_question_spread
spread = build_question_spread(ROOT, M['shell'], pts, window_fn=window)
```

The script directory must be present in `sys.path`; insert `str(Path(__file__).resolve().parent)` if required by the launcher.

The twelve bonbons remain caller-owned. Preserve exactly one birth per picture n79–90 and hold the full question through n92. For n93–99, progressively lower the bonbon roots from local z0.115 to z0.04 while reducing their z scale from7 to0.8; x/y scale may increase from7 to8.5. Hide bonbon descendants at n100. This buries the residual solids into the filling spread before their visibility switches off. Keep the fork fixed.

The helper creates one baked mesh per picture n93–112, with constant visibility keys. Source metaballs are converted immediately and removed. There is no render-time simulation, scalar-field evaluation, or hidden external dependency. Growth is deterministic: connected adjacent bridges at n93/94, lobes advancing inward from existing chocolate rather than appearing as detached pools, solid interior by n100, then restrained spreading and settling through n112. A few raised areas remain for curved highlights. Every mesh touches the action plane at z−0.02 (customizable via `ground_z`).

Validation in `spread-validation.json` covers all20 frames:

- Exactly one connected component each.
- Zero nonmanifold edges each.
- Zero BVH-detected triangle intersections between faces without shared vertices each.
- 1,500–4,690 vertices and1,760–5,081 polygons per baked frame.
- Ground contact at z−0.02 within floating-point tolerance.

The n94/n100/n112 isolated render inspection confirmed that the question opening is filled by n100 and stays filled at n112. The final silhouette is an irregular thick spoonful with restrained surface remnants, not a crossing tubular loft. The full scene still needs integrated inspection with the original bonbons and fork; this geometry check does not approve the complete film or final beauty shading. Baked frame replacement supports exact picture timing but not subframe deformation motion blur; the existing guide renders with motion blur off.
