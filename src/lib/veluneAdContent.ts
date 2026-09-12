import { VELUNE_REFERENCES } from "./veluneReferences";
import { VELUNE_GENERATION_SHOTS } from "./veluneDirection";
import type { SoundPlan, EffectCue } from "./soundPlan";

// Archived Seedance direction remains available for older run packs.
export const VELUNE_SEEDANCE_PROMPT = "Create a 15-second, 16:9 premium chocolate commercial for the fictional brand VELUNE. Use the twelve-shot edit in [Video1], the supplied Blender camera study, as the authority for camera movement, framing, scale, timing, object counts and action. The eight still images define appearance. Transform the Blender geometry into photoreal chocolate, packaging, people and environments while preserving its choreography. Do not carry over proxy colours, wireframes or viewport overlays. Aim to preserve the guide's 24 fps rhythm and hard cuts; keep the final composition alive through 15 seconds.\n\nREFERENCE BINDINGS\n[Video1]: 00_velune_blender_motion_15s.mp4 · motion, composition and edit guide.\n[Image1]: 01_velune_packaging.jpeg · the VELUNE carton family: pistachio-green Pistachio Praline, plum Raspberry Ganache, golden Salted Caramel. Match carton proportions, layout, finish and flavour colours. Show only the specified flavour during each solo carton shot; do not show the entire reference lineup in every shot.\n[Image2]: 02_velune_whole_bonbon.jpeg · the rounded pillow-shaped chocolate with the moulded V groove. Carry this shell design consistently into every whole bonbon and cut half.\n[Image3]: 03_velune_pistachio_centre.jpeg · the cut chocolate shell and dense, finely textured pistachio filling for the fork reveal.\n[Image4]: 04_velune_caramel_centre.jpeg · the cut chocolate shell with glossy caramel contained inside, for the serving shot.\n[Image5]: 05_velune_host.jpeg · the same fictional adult host throughout: face, hair and plum outfit for the tunnel and observer shots.\n[Image6]: 06_velune_chocolatier.jpeg · the fictional adult chocolatier: face, hair, ivory chef jacket and plum apron.\n[Image7]: 07_velune_chocolate_tunnel.jpeg · layered chocolate folds, restrained caramel veins and the small central host. Use its materials and atmosphere; retain the opening and closing framings from [Video1].\n[Image8]: 08_velune_discovery_studio.jpeg · the plum-and-cream studio, two BACK-FACING workers and five bonbons arranged three on the left and two on the right. Both workers wear ivory jackets and plum aprons in this scene. This scene wardrobe takes priority over the host's plum portrait outfit.\n\nVISUAL FINISH\nTactile dark chocolate with fine moulded texture, restrained warm highlights, softly rounded edges and believable shell thickness. Muted pistachio green, rich plum, warm caramel amber, ivory and discreet gold. Satin paperboard cartons, soft studio light and clear contact shadows. Faces remain natural and consistent. Retain the guide's subject positions and viewing angles instead of copying the static framing of every reference. Focus and depth of field must keep each hero product legible.\n\nSHOT PLAN: times are seconds; preserve the corresponding cuts in [Video1].\n0.000–1.750 / S01: Chocolate folds frame the host from [Image5], with the material world of [Image7]. Fixed camera. A small upward glance, slight head tilt and curious smile. Keep the guide's title space clear.\n1.750–2.125 / S02: The pistachio carton from [Image1] makes the guide's short, rigid turn on the fixed pedestal. Camera, pivot, scale and contact point remain registered.\n2.125–2.500 / S03: Hard cut to the raspberry carton from [Image1] at the same position and scale. Continue its rigid turn. No dissolve or flavour morph.\n2.500–2.875 / S04: Hard cut to the caramel carton from [Image1], preserving the same staging and turn.\n2.875–4.708 / S05: The low-centre tasting fork begins bare. Twelve bonbons matching [Image2] appear in the guide's order to form a readable question mark by approximately 3.792 seconds. Then chocolate bridges between them, closes the negative space and settles into a thick spread. Preserve the guide's silhouettes and progression, without an explosive splash.\n4.708–5.833 / S06: An already-open pistachio chocolate half matching [Image3] is held on the upright fork. Keep the fork and food steady while the two distinct observers from [Image5] and [Image6] shift behind it as in the guide. Keep one visible filling centre; do not roll the camera or fork.\n5.833–7.917 / S07: Use [Image8] for the discovery studio and [Image2] for the bonbons. Hold on two stacks, three chocolates left and two right. Around 6.833 seconds, follow the guide's actual backward camera move to reveal two back-facing workers and the console. Both workers wear ivory jackets and plum aprons. Props remain fixed in the room; no internal cut, added worker or digital zoom.\n7.917–8.625 / S08: One whole raspberry INGREDIENT rotates on the plum pedestal, already present at the cut. This is a berry, not a chocolate or a filling cutaway.\n8.625–9.292 / S09: Hard cut to an already-open pistachio nut: shell and green kernel rotate as one stable assembly. This is an ingredient, not the chocolate half from [Image3].\n9.292–10.083 / S10: One whole bonbon from [Image2] and one caramel half from [Image4] rotate together on a low cream dish. Preserve stable contact. Caramel stays contained; no new breaking, pouring or dripping action.\n10.083–13.083 / S11: Hold the guide's single flat printed-report surface for three seconds, with only its small initial settling motion. Retain its shape, perspective and graphic regions. The exact “The Centre Report” artwork will be composited onto this surface afterward. Do not turn the pictured packaging into separate moving boxes or invent extra text. There is no ninth image reference.\n13.083–15.000 / S12: Return to the wide chocolate tunnel from [Video1], using [Image7] for its look and [Image5] for the same host. Follow the small tasting/withdrawal gesture and subtle pleased expression. Keep the camera fixed and the right-hand tagline area clear. Hold living motion through the end; no additional shot or fade.\n\nSOUND AND GRAPHICS\nGenerate silent picture. No speech, lip-sync, singing, music or sound effects. Voice, music and effects will be added separately. Match existing packaging artwork and logo placement as closely as possible; exact lettering, the opening title, The Centre Report and closing “Wonder within.” tagline will be finished in post. Do not add new claims, subtitles or logos.\n\n[Exclusions]\nDo not include extra people, extra limbs, extra products, duplicated cartons, changing faces, wardrobe drift, warped rigid packaging, altered flavour colours, plastic-looking chocolate, fluorescent filling, watery caramel, ice cream, random particles, camera shake, unplanned camera moves, inserted cuts, transitions between flavour cartons, watermarks or invented copy. Preserve the deliberate question-mark chocolate merge; do not confuse it with unwanted product morphing.";

// Current Ad Lab example: H3 modality-and-order references, externally finished sound.
export const VELUNE_H3_PROMPT = `Create a 15-second, 16:9 premium chocolate commercial for the fictional brand VELUNE. This is the revised product-led direction, using nine appearance images and one existing Blender guide.

DIRECTION PRIORITY
Video 1 supplies the twelve-shot order, cut timing and main motion beats. The stills define final appearance throughout each shot, not only its first frame. Video 1 is a motion/edit guide, never footage to insert into the result. In S02–S04, use its turn and timing only: replace ALL guide artwork and rendering with the corresponding finished carton from Images 1, 2 and 3 on every frame. Maintain that finished appearance until the next scheduled cut. Do not alternate a photographic carton with its Blender proxy. The explicit shot overrides below take priority over the guide's proxy materials and artwork, visible cast, opening and ending framing, and serving-piece count. Keep the guide unchanged as a reference; transform its placeholders into convincing photographed food, paperboard and environments. Preserve direction elsewhere. In particular, retain the S05 question-mark choreography and the S07 backward camera move. Do not reproduce the guide's host in S01 or S12. S07 includes the specified small working gestures. Aim to match the 24 fps edit rhythm and hold the final composition through 15 seconds; no extra cuts.

REFERENCE BINDINGS
Video 1: 00_velune_blender_motion_15s.mp4 · the original Blender motion and edit study, with the overrides above.
${VELUNE_REFERENCES.map((r) => `Image ${r.index}: ${r.fileName} · ${r.role}`).join("\n")}

VISUAL FINISH
Real-food scale and detail within an imaginative chocolate world. Fine chocolate texture, restrained warm highlights, believable cut edges, dry ingredient surfaces, satin paperboard folds and soft contact shadows. Keep the V-groove shell family coherent. Image 7 defines the whole V-groove bonbon for S05 and S07. For S06, use only the left pistachio half from Image 6 on the fork, without its plate or other flavours. Image 6 defines all three centres for S10 and S12. Carton reference angles differ: register the boxes using the guide's staging without mirroring labels. Chocolate pictures on the cartons are printed artwork, not physical chocolates attached to the box. Ingredients should look natural and irregular; no rubber berry or smooth plastic nut. Fine lettering remains a final graphics check.

SHOT PLAN: seconds; keep these cuts as closely as possible.
${VELUNE_GENERATION_SHOTS.map((s) => `${(s.start / 24).toFixed(3)}–${(s.end / 24).toFixed(3)} / ${s.id}: ${s.note}`).join("\n")}

SOUND AND GRAPHICS
No dialogue, lip-sync, singing or music. Keep any native ambience minimal. The native audio will be discarded and replaced by separate ElevenLabs narration, instrumental music and spot effects after picture approval. Mouth movements are not required for that narration. Match package branding as closely as possible; exact lettering, the opening title, The Centre Report and Wonder within. will be finished in post. The report master is a finishing asset, not an additional reference upload. Do not invent claims or subtitles.

[Exclusions]
No portrait close-ups or faces in the opening and ending. No extra workers, extra limbs, changing product counts outside the specified overrides, duplicated cartons, mirrored lettering, warped packaging, changed flavour colours, toy-like gloss, fluorescent filling, watery caramel, random particles, camera shake, inserted cuts, transitions between flavour cartons, watermarks or invented copy. No inserted Blender frames, flat shield/V proxy carton artwork, render-style switching or extra carton shot between S04 and S05. In S12, darken the environment gradually while preserving readable chocolate centres; no full-frame fade to black. Preserve the deliberate S05 chocolate merge; it is not an unwanted morph.`;

export const VELUNE_MUSIC_BRIEF = "Compose one original 15-second instrumental score for VELUNE, a premium filled-chocolate film. Warm curiosity and restrained discovery. Around 80 BPM in 4/4, soft marimba or felt piano, muted pizzicato and a quiet warm bass. Intimate, tactile and elegant; leave space for four short spoken lines and close product effects. Keep one continuous musical identity across all sections. Do not restart the tune at section boundaries or accent every cut.\n\n0–3s: Introduce a sparse curious motif; leave the opening question clear. Allow small editorial ticks for the carton cuts at 1.750, 2.125 and 2.500s.\n3–6s: Gently develop the motif during the bonbon assembly, then soften under the chocolate merge and second spoken line.\n6–9s: Open the harmony slightly with the studio pullback, retaining a light arrangement for the ingredient inserts.\n9–12s: Settle from the serving shot into a sparse report-reading bed. Reduce melodic activity from about 10.083s for narration and on-screen reading.\n12–15s: Remain quiet beneath the report, then resolve warmly with the returning tunnel and final line. Let the decay finish by 15s.\n\nNo vocals, lyrics, choir, spoken words, epic impacts, EDM drop, busy drums, comedy effects or imitation of a named artist. The voice and spot effects are separate tracks. The Blender edit governs picture timing; these are musical phrases, not instructions to recut the film. Precise accents will be placed in the final mix.";

export const VELUNE_SOUND_PLAN: SoundPlan = {
  "title": "VELUNE · Wonder within · 15s",
  "bpm": 80,
  "narration": "external",
  "voice": {
    "name": "Rachel",
    "stability": 0.5,
    "direction": "Warm, conversational curiosity with restrained delivery. Pronounce VELUNE veh-LOON. Audition the words and pacing; these notes are not spoken."
  },
  "scenes": [
    {
      "id": "velune-audio-1",
      "title": "Curiosity & cartons",
      "seconds": 3,
      "line": "What's within?",
      "music": "Sparse felt-piano or marimba motif. Leave room for the opening voice and three small carton ticks.",
      "voiceStart": 0.2916666666666667,
      "voiceEnd": 1.2083333333333333
    },
    {
      "id": "velune-audio-2",
      "title": "Question & centre",
      "seconds": 3,
      "line": "Something wonderful.",
      "music": "Continue the motif; gentle lift into assembly, then thin beneath the voice and chocolate merge.",
      "voiceStart": 3.2916666666666665,
      "voiceEnd": 4.583333333333333
    },
    {
      "id": "velune-audio-3",
      "title": "Discovery & ingredients",
      "seconds": 3,
      "line": "",
      "music": "Slight harmonic expansion during the pullback; restrained pulse, open space for ingredient accents."
    },
    {
      "id": "velune-audio-4",
      "title": "Serving & report",
      "seconds": 3,
      "line": "Velune. The Centre Report.",
      "music": "Settle into a quiet reading bed from about 10.083 seconds; reduce melody and percussion beneath narration.",
      "voiceStart": 10.375,
      "voiceEnd": 12.416666666666666
    },
    {
      "id": "velune-audio-5",
      "title": "Wonder within",
      "seconds": 3,
      "line": "Wonder within.",
      "music": "Keep the report calm, then resolve warmly under the tunnel. Finish the decay within 15 seconds.",
      "voiceStart": 13.416666666666666,
      "voiceEnd": 14.625
    }
  ]
};

export const VELUNE_EFFECT_CUES: EffectCue[] = [
  {
    "id": "velune-fx-carton",
    "name": "Carton tick",
    "prompt": "One quiet precise satin-cardboard tick with a tiny low wooden tap, clean short transient at the start, dry, no room echo, no voice, no music.",
    "seconds": 0.5,
    "placements": [
      {
        "start": 1.75,
        "end": 1.9583333333333333
      },
      {
        "start": 2.125,
        "end": 2.3333333333333335
      },
      {
        "start": 2.5,
        "end": 2.7083333333333335
      }
    ],
    "note": "Generate one 0.5s take; trim and reuse for all three carton cuts. Editorial punctuation, not a depicted physical impact."
  },
  {
    "id": "velune-fx-merge",
    "name": "Chocolate merge",
    "prompt": "Dense tempered chocolate slowly folding and spreading, rich low viscous movement, restrained sticky detail, no watery splash, no bubbling, no mouth sounds, no voice, no music.",
    "seconds": 1.2,
    "placements": [
      {
        "start": 3.875,
        "end": 4.666666666666667
      }
    ],
    "note": "Generate 1.2s; trim to visible merge; keep low under VO02."
  },
  {
    "id": "velune-fx-pullback",
    "name": "Studio pullback",
    "prompt": "A gentle backward camera-motion swish, faint opening, brief soft swell, smooth settling, warm airy tone, no cinematic boom, no voice, no music.",
    "seconds": 1.3,
    "placements": [
      {
        "start": 6.833333333333333,
        "end": 7.875
      }
    ],
    "note": "Generate 1.3s; trim to pullback; the props do not move."
  },
  {
    "id": "velune-fx-ingredient",
    "name": "Ingredient accents",
    "prompt": "One soft dry ceramic fingertip tick, restrained food-commercial punctuation, short decay, no music, no voices.",
    "seconds": 0.5,
    "placements": [
      {
        "start": 7.916666666666667,
        "end": 8.166666666666666
      },
      {
        "start": 8.625,
        "end": 8.875
      },
      {
        "start": 9.291666666666666,
        "end": 9.541666666666666
      }
    ],
    "note": "Generate one 0.5s take and reuse; editorial accents, not falling ingredients."
  },
  {
    "id": "velune-fx-report",
    "name": "Report settle",
    "prompt": "A small thick coated-paper card flexing once and settling, dry delicate paper rustle, no page turn, no music, no voice.",
    "seconds": 0.8,
    "placements": [
      {
        "start": 10.083333333333334,
        "end": 10.375
      }
    ],
    "note": "Generate 0.8s; keep only the short useful portion before narration; omit if no visible settling."
  }
];

