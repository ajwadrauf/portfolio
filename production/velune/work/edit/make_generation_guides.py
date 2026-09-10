"""Make 4-second single-setup guides from approved Blender PNGs.
Twelve leading hold frames + original action + trailing hold. No final edit is
changed. S11 is skipped. ffmpeg must be installed. No paid calls are made.
"""
from __future__ import annotations
import argparse,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def frame_sequence(start,end):
 if not (0<=start<end<=360) or end-start>84:raise ValueError('Repair take must fit inside96frames with12leading hold frames.')
 seq=[start]*12+list(range(start,end))
 return seq+[end-1]*(96-len(seq))

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--frames',type=Path,default=ROOT/'blender/renders/guide');p.add_argument('--out',type=Path,default=ROOT/'blender/renders/generation_guides');args=p.parse_args()
 if not args.out.resolve().is_relative_to(ROOT):raise ValueError('Put generation guides inside the working project so repair jobs have portable paths.')
 shots=json.loads((ROOT/'shot_timeline.json').read_text())['shots'];args.out.mkdir(parents=True,exist_ok=True)
 def image(n):
  f=args.frames/f'frame_{n+1:04}.png'
  if not f.is_file():raise FileNotFoundError(f'Render the approved guide first. Missing {f}')
  return f
 for n in range(360):image(n)
 trims=[]
 for s in shots:
  if s['id']=='S11':continue
  a,b=s['start_frame'],s['end_frame_exclusive'];seq=frame_sequence(a,b)
  target=args.out/f'{s["id"]}_generation_only_4s.mp4';log=args.out/f'{s["id"]}.log'
  with log.open('wb') as err:
   proc=subprocess.Popen(['ffmpeg','-y','-v','error','-f','image2pipe','-framerate','24','-vcodec','png','-i','pipe:0','-an','-frames:v','96','-c:v','libx264','-crf','16','-pix_fmt','yuv420p','-movflags','+faststart',str(target)],stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=err)
   try:
    for n in seq:proc.stdin.write(image(n).read_bytes())
    proc.stdin.close();code=proc.wait()
   except BaseException:
    proc.kill();proc.wait();raise
  if code:raise RuntimeError(f'ffmpeg failed: {log.read_text()}')
  check=subprocess.run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames,avg_frame_rate','-of','json',str(target)],capture_output=True,text=True,check=True)
  stream=json.loads(check.stdout)['streams'][0]
  if stream['nb_read_frames']!='96' or stream['avg_frame_rate']!='24/1':raise RuntimeError(f'Guide verification failed: {target}')
  # Separate paid jobs must never inherit the15-second master prompt. Their
  # copies remain unapproved until the guide and appearance bindings are reviewed.
  jobdir=ROOT/'studio/shot_jobs';jobdir.mkdir(parents=True,exist_ok=True)
  prompt=jobdir/f'{s["id"]}_prompt.txt'
  if not prompt.exists():prompt.write_text(f'Create one continuous4-second appearance plate for VELUNE: {s["title"]}. @Video1 is the approved motion guide. It has12leading held pictures at24fps, then the original {b-a}-picture action, then a held finishing pose. Preserve the action in that short middle interval; do not stretch it across4seconds. No internal cuts.\nAction: {s["action"]}\nComposition: {s["composition"]}\nMotion: {s["motion"]}\nUse only explicitly bound approved chocolate/character references. Keep shell geometry, count, camera motion, contact and framing stable. No source actor identities or former branding. No audio. Typography and labels will be composited deterministically. This is a repair take with disposable handles, not a new final edit.\n')
  job=jobdir/f'{s["id"]}.json'
  if not job.exists():job.write_text(json.dumps({'endpoint':'bytedance/seedance-2.5/reference-to-video','shot':s['id'],'guide':str(target.resolve().relative_to(ROOT)),'guide_frames':96,'approved':False,'image_paths':[],'prompt_file':str(prompt.relative_to(ROOT)),'input':{'duration':'4','resolution':'720p','aspect_ratio':'16:9','generate_audio':False,'seed':70419,'bitrate_mode':'high'},'note':'Unapproved repair template. Add explicit @ImageN bindings after reference approval. Never submit the source index.'},indent=2))
  trims.append({'shot':s['id'],'guide':target.name,'duration_seconds':4,'nominal_take_start_frame':12,'nominal_take_end_frame_exclusive':12+b-a,'final_start_frame':a,'final_end_frame_exclusive':b,'warning':'Trim is valid only if generated action timings match the reference. Review key poses; do not blindly splice.'})
 (args.out/'nominal_trims.json').write_text(json.dumps(trims,indent=2));print('Wrote generation-only guides:',args.out)
if __name__=='__main__':main()
