Shot 1A - "The Wall"   PC The Decadent Chocolate Chip (classic)
========================================================================

Clay control pass for Seedance 2.5. Lane A only: this clip carries camera
path, blocking, timing, occlusion order and light direction. It carries no
brand colour, no material and no type - those are Lane B stills and post.

DELIVERY   640x480 - 4:3 - 24 fps - 288 frames - 12.0 s - last 12 frames locked
SURFACE    <Dreamina UI / ModelArk API / reseller — confirm before upload>
MODE       Clay Renderer / Omni Reference

UPLOAD ORDER - most surfaces index by upload order, not filename.

  @Video 1   01_clay_1A.mp4
  @Image 1   02_look_chips.png          macro chocolate chips
  @Image 2   03_look_cookie.png         classic Decadent hero cookie
  @Image 3   04_look_pack_chip.png      The Decadent Chocolate Chip
  @Image 4   05_look_pack_soft.png      The Decadent Soft Baked
  @Image 5   06_look_pack_pb.png        The Decadent Peanut Butter Chunk
  @Image 6   07_look_pack_reverse.png   The Reverse Decadent
  @Image 7   08_look_lighting.png       mood and contrast reference

SUBJECT MAPPING - linear base colour, not sRGB hex.

  chips      (0.05, 0.20, 0.80)     -> @Image 1  semi-sweet chocolate chips
  cookie     (0.90, 0.35, 0.02)     -> @Image 2  hero cookie, classic Decadent
  pack_chip  (0.10, 0.60, 0.15)     -> @Image 3  The Decadent Chocolate Chip
  pack_soft  (0.75, 0.05, 0.55)     -> @Image 4  The Decadent Soft Baked
  pack_pb    (0.95, 0.80, 0.05)     -> @Image 5  The Decadent Peanut Butter Chunk
  pack_rev   (0.05, 0.70, 0.75)     -> @Image 6  The Reverse Decadent

CAMERA

  36 mm full frame, sensor_fit HORIZONTAL, DOF off, motion blur off
  near clip 2 mm - the default 100 mm would cut into the macro opening

   frame     dist     lens    elev     azim    frame w    frame h
       1    0.100    100.0     2.0    205.0       36 mm       27 mm
      72    0.100    100.0     2.0    245.0       36 mm       27 mm
     144    0.450    100.0    12.0    245.0      162 mm      122 mm
     204    0.720     85.0    22.0    300.0      305 mm      229 mm
     276    1.550     45.0    22.0    300.0     1240 mm      930 mm
     288    1.550     45.0    22.0    300.0     1240 mm      930 mm

FINAL FRAME - forced perspective is doing the work. The cookie is a
quarter the height of a pack and still reads as the largest object,
because it sits three times closer to the lens.

  cookie   450 mm from lens, leaning 58 deg   15.3% frame width
  packs    1.55 m from lens, 165 mm apart      10.5% each, row 50.4%
  order    left to right: pack_chip, pack_soft, pack_pb, pack_rev
  the cookie sits in front of the GAP between packs 2 and 3, never in
  front of a pack, which removes the occlusion ambiguity entirely.

COMPOSITE AFTER GENERATION - nothing with readable type goes through
the generator. It garbles type reliably, and it is a registered mark.

  - four pack fronts (exact artwork)
  - PC wordmark
  - The Decadent logotype
  - 300 g
  - legal line
  - superscripts
  - end card
  - music and sound design

REBUILD

  python3 build.py --checkpoints        # stills, layout + exposure checks
  python3 build.py --draft --animation  # 640x480 clip
  python3 build.py --animation          # 960x720 clip

  Built with Blender 5.0.1. On a machine with no GPU, prefix with:
  LIBGL_ALWAYS_SOFTWARE=1 EGL_PLATFORM=surfaceless GALLIUM_DRIVER=llvmpipe

