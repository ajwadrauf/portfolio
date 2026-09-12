/* Local editorial finishing. Uses the existing images, H3 take and supplied WAV.
 * Requires ffmpeg/ffprobe on PATH and the project's sharp dependency.
 * No generation provider calls. Run from the repository root. */
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const sharp = require('sharp');

const root = process.cwd();
const base = path.join(root, 'public/studio/velune');
const out = path.join(base, 'delivery');
const work = path.join(root, 'production/velune/work/delivery');
const temp = '/tmp/velune-delivery-review';
const colours = { cream: '#f4edde', plum: '#361624', gold: '#bd9864' };
const svg = (w, h, content) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${content}</svg>`;
const text = (x, y, value, size, extra = '') => `<text x="${x}" y="${y}" font-family="Georgia,serif" font-size="${size}" fill="${colours.cream}" ${extra}>${value}</text>`;
const label = (x, y, value, size = 20, extra = '') => `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" ${extra.includes("letter-spacing") ? "" : 'letter-spacing="3"'} fill="${colours.cream}" ${extra}>${value}</text>`;
const ffmpeg = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const file = name => path.join(temp, name);
async function embed(relative) { return `data:image/jpeg;base64,${(await fs.readFile(path.join(base, relative))).toString('base64')}`; }
async function png(name, markup, published = false) {
  const destination = published ? path.join(out, name) : file(name);
  await sharp(Buffer.from(markup)).png().toFile(destination);
  return destination;
}
async function main() {
  await Promise.all([fs.mkdir(out, { recursive: true }), fs.mkdir(work, { recursive: true }), fs.mkdir(temp, { recursive: true })]);
  const reveal = await embed('references/v2/11_velune_final_reveal.jpeg');
  const serving = await embed('references/v2/08_velune_three_flavour_serving.jpeg');
  const shades = `<defs><linearGradient id="shade"><stop offset="0" stop-color="#140b09" stop-opacity="0"/><stop offset="1" stop-color="#140b09" stop-opacity=".75"/></linearGradient></defs>`;
  const title = `${text(1125, 430, 'VELUNE', 49, 'letter-spacing="9"')}${text(1125, 528, 'Wonder', 90)}${text(1125, 625, 'within.', 90)}<path d="M1127 660 Q1240 648 1425 662" fill="none" stroke="${colours.gold}" stroke-width="3"/>`;
  await png('velune-campaign-still.png', svg(1920,1080,`${shades}<image href="${reveal}" width="1920" height="1080" preserveAspectRatio="xMidYMid slice"/><rect x="940" width="980" height="1080" fill="url(#shade)"/>${title}`), true);
  await png('velune-bilingual-still.png', svg(1080,1350,`<rect width="1080" height="1350" fill="${colours.plum}"/>${text(540,157,'VELUNE',78,'text-anchor="middle" letter-spacing="11"')}<path d="M480 216 H600" stroke="${colours.gold}" stroke-width="2"/><image href="${serving}" x="0" y="302" width="1080" height="608" preserveAspectRatio="xMidYMid meet"/>${text(540,1045,'Wonder within.',62,'text-anchor="middle"')}${text(540,1140,'Un monde à découvrir.',62,'text-anchor="middle"')}<path d="M480 1210 H600" stroke="${colours.gold}" stroke-width="2"/>`), true);
  await png('opening.png', svg(1920,1080,`<defs><linearGradient id="left"><stop stop-color="#180d09" stop-opacity=".55"/><stop offset="1" stop-color="#180d09" stop-opacity="0"/></linearGradient></defs><rect width="1200" height="550" fill="url(#left)"/>${text(124,141,'VELUNE',29,'letter-spacing="5"')}${text(120,240,'What’s within?',84)}`));
  await png('closing.png', svg(1920,1080,`${shades}<rect x="940" width="980" height="1080" fill="url(#shade)"/>${title}`));
  await png('vertical-layout.png', svg(1080,1920,`<rect width="1080" height="1920" fill="${colours.plum}"/>${text(540,258,'VELUNE',91,'text-anchor="middle" letter-spacing="12"')}${label(540,334,'THE FILLED COLLECTION',20,'text-anchor="middle"')}<path d="M478 412 H602" stroke="${colours.gold}" stroke-width="2"/>${text(540,1390,'Wonder within.',79,'text-anchor="middle"')}${label(540,1500,'PISTACHIO · RASPBERRY',21,'text-anchor="middle"')}${label(540,1540,'SALTED CARAMEL',21,'text-anchor="middle"')}`));
  const report = (await fs.readFile(path.join(base,'finishing/velune_centre_report_v2.svg'),'utf8')).replace(' · EDITION 02','');
  await sharp(Buffer.from(report)).resize(1920,1080).png().toFile(file('report.png'));
  const cartons = ['01_velune_pistachio_carton.jpeg','02_velune_raspberry_carton.jpeg','03_velune_caramel_carton.jpeg'];
  for (let i=0;i<cartons.length;i++) {
    // Typesetting/layout rendering only: source imagery is kept intact.
    const image = await embed(`references/v2/${cartons[i]}`);
    await png(`carton-${i+1}.png`, svg(1920,1080,`<image href="${image}" width="1920" height="1080" preserveAspectRatio="xMidYMid meet"/>`));
  }
  console.log('Artwork ready. Finishing picture and sound.');
  const input = path.join(base,'film/velune-h3.mp4');
  const voice = path.join(base,'film/velune-voiceover.wav');
  // Match observed cuts in this supplied take: 41, 52, 61, 69, 249, 313.
  // Keep 360 frames for the delivered 15-second film; the source has 362.
  ffmpeg(['-i',input,...['carton-1.png','carton-2.png','carton-3.png','report.png'].flatMap(n=>['-loop','1','-framerate','24','-i',file(n)]),'-filter_complex',
    '[0:v]trim=end_frame=360,setpts=PTS-STARTPTS,crop=1344:756:0:6,scale=1920:1080,setsar=1[v0];[v0][1:v]overlay=enable=\'between(n,41,51)\'[v1];[v1][2:v]overlay=enable=\'between(n,52,60)\'[v2];[v2][3:v]overlay=enable=\'between(n,61,68)\'[v3];[v3][4:v]overlay=enable=\'between(n,249,312)\'[picture]',
    '-map','[picture]','-an','-frames:v','360','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',file('picture.mp4')]);
  // Same starting balance as the site's original-sound switch: 50% original,
  // 100% voice. Reduce the original further during speech with a soft sidechain.
  ffmpeg(['-i',input,'-i',voice,'-filter_complex',
    '[0:a]aresample=48000,atrim=0:15,asetpts=PTS-STARTPTS,volume=0.5[bed];[1:a]aresample=48000,atrim=0:15,asetpts=PTS-STARTPTS,asplit=2[voice][key];[bed][key]sidechaincompress=threshold=0.035:ratio=3:attack=30:release=220[ducked];[ducked][voice]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.89:level=0:latency=1,afade=t=out:st=14.85:d=0.15,apad=whole_dur=15,atrim=0:15[mix]',
    '-map','[mix]','-ar','48000','-ac','2','-c:a','pcm_s24le',path.join(out,'velune-final-mix.wav')]);
  ffmpeg(['-i',file('picture.mp4'),'-i',path.join(out,'velune-final-mix.wav'),...['opening.png','closing.png'].flatMap(n=>['-loop','1','-framerate','24','-i',file(n)]),'-filter_complex',
    '[0:v][2:v]overlay=enable=\'between(n,0,40)\'[intro];[intro][3:v]overlay=enable=\'between(n,313,359)\'[film]',
    '-map','[film]','-map','1:a','-t','15','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart',path.join(out,'velune-film-final.mp4')]);
  // A designed vertical social layout. Preserve the complete widescreen frame
  // instead of cropping away the three flavours or either studio worker.
  ffmpeg(['-loop','1','-framerate','24','-i',file('vertical-layout.png'),'-i',file('picture.mp4'),'-i',path.join(out,'velune-final-mix.wav'),'-filter_complex',
    '[1:v]scale=1080:608,setsar=1[wide];[0:v][wide]overlay=0:595[v]',
    '-map','[v]','-map','2:a','-t','15','-r','24','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart',path.join(out,'velune-social-vertical.mp4')]);
  ffmpeg(['-ss','2.375','-i',input,'-frames:v','1','-q:v','2',path.join(out,'carton-before.jpg')]);
  ffmpeg(['-ss','2.375','-i',path.join(out,'velune-film-final.mp4'),'-frames:v','1','-q:v','2',path.join(out,'carton-after.jpg')]);
  ffmpeg(['-ss','13.75','-i',path.join(out,'velune-film-final.mp4'),'-frames:v','1','-q:v','2',path.join(out,'film-poster.jpg')]);
  ffmpeg(['-ss','9.75','-i',path.join(out,'velune-social-vertical.mp4'),'-frames:v','1','-q:v','2',path.join(out,'vertical-poster.jpg')]);
  const outputs = ['velune-film-final.mp4','velune-social-vertical.mp4','velune-campaign-still.png','velune-bilingual-still.png','velune-final-mix.wav'];
  const files = await Promise.all(outputs.map(async name=>{const bytes=await fs.readFile(path.join(out,name));return {name,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}));
  const manifest = {
    project:'VELUNE · Wonder within.',status:'Independent fictional campaign concept',date:'2026-09-12',
    brief:{audience:'Adults drawn to distinctive chocolate and small moments of indulgence.',objective:'Introduce VELUNE and make its three filled centres memorable.',idea:'A small chocolate contains a world to discover.'},
    film:{dimensions:'1920 × 1080',fps:24,frames:360,durationSeconds:15,sourceDimensions:'1344 × 768',sourceFrames:362,note:'Upscaled and locally finished from the supplied H3 take. Six source pixels trimmed at top and bottom for 16:9.'},
    finishing:['Three carton inserts replaced with selected appearance references at frames 41–68.','Report replaced with the separately typeset master at frames 249–312.','Opening question and closing brand/tagline added locally.','H3 sound and ElevenLabs voice combined at 48 kHz stereo. Original starts at 50%, ducks under voice; peak limiter and a short final fade.'],
    vertical:'1080 × 1920, 15 seconds. Designed social layout preserving the complete landscape picture; not a full-screen portrait reframe.',
    bilingual:{format:'1080 × 1350 PNG',english:'Wonder within.',french:'Un monde à découvrir.',note:'French adaptation of the discovery idea with equal visual weight. Concept copy; no commercial or regulatory approval claimed.'},
    assistance:'Creative direction and review by Ajwad Rauf. AI-generated reference imagery and H3 picture/native sound, ElevenLabs voiceover, AI-assisted code and finishing.',
    files
  };
  await fs.writeFile(path.join(out,'delivery-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  await fs.writeFile(path.join(work,'delivery-notes.md'),'# VELUNE local finishing\n\nRebuild with `node scripts/finish-velune-campaign.cjs`. Requires ffmpeg, ffprobe and sharp. Source originals are preserved.\n\nThe deliverables are a fictional portfolio campaign set. This is an editorial finishing pass, not another model generation. The before/after shows the source H3 carton insert and its local replacement, not evidence that a prompt retry alone fixed it.\n\nThe vertical file uses a deliberately composed portrait surround with the complete landscape picture. The English/French still adapts the headline while retaining the same three-centre product image.\n');
  const { zipSync, strToU8 } = require('fflate');
  const bundle = Object.fromEntries(await Promise.all([...outputs,'delivery-manifest.json'].map(async n=>[n,new Uint8Array(await fs.readFile(path.join(out,n)))])));
  bundle['READ-ME.txt']=strToU8('VELUNE / Independent fictional campaign concept\n\nThe final MP4 includes H3 original sound and ElevenLabs voiceover. The vertical MP4 uses a designed 9:16 layout preserving the landscape composition. Still artwork includes one English campaign image and one English/French adaptation. See delivery-manifest.json for sources, dimensions and finishing decisions.\n');
  await fs.writeFile(path.join(out,'velune-campaign-delivery.zip'),zipSync(bundle,{level:0}));
  console.log('Delivery set ready:', files.map(f=>`${f.name} (${(f.bytes/1048576).toFixed(1)} MB)`).join(', '));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
