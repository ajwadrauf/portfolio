"""Conform an already assembled and approved video + approved audio mix.
Writes a 15s / 360-frame / 24fps ProRes MOV with 48kHz PCM audio.
This utility does NOT fix shot content, camera motion, label drift or wrong cuts.
Needs ffmpeg and ffprobe. Output is rejected if final media counts fail.
"""
from __future__ import annotations
import argparse,json,subprocess,tempfile
from fractions import Fraction
from pathlib import Path

def run(cmd):
 r=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 if r.returncode:raise RuntimeError(r.stderr[-8000:])
 return r.stdout

def probe(p):return json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(p)]))

def decoded_audio_samples(p):
 # Decode and resample to the intended stereo master format, including codec
 # delay/skip metadata. Container duration alone cannot establish sample count.
 r=subprocess.run(['ffmpeg','-v','error','-i',str(p),'-map','0:a:0','-vn','-af','aresample=48000','-ac','2','-f','s16le','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError(r.stderr.decode(errors='replace')[-8000:])
 if len(r.stdout)%4:raise ValueError('Incomplete stereo PCM sample encountered.')
 return len(r.stdout)//4

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--video',type=Path,required=True);ap.add_argument('--audio',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);a=ap.parse_args()
 if a.out.suffix.lower()!='.mov':raise ValueError('Use a .mov destination for the PCM master.')
 for p in (a.video,a.audio):
  if not p.is_file():raise FileNotFoundError(p)
 if a.out.exists():raise FileExistsError('Choose a new output path; existing masters are not overwritten.')
 vd=probe(a.video);v=next((x for x in vd['streams'] if x['codec_type']=='video'),None)
 if not v:raise ValueError('Video input has no picture stream.')
 if float(v.get('duration',vd['format'].get('duration',0)))<15-.001:raise ValueError('Video is shorter than 15s. Resolve the edit; do not auto-freeze it.')
 if not any(x['codec_type']=='audio' for x in probe(a.audio)['streams']):raise ValueError('Audio mix has no audio stream.')
 input_samples=decoded_audio_samples(a.audio)
 if input_samples<720000:raise ValueError(f'Approved mix has only {input_samples} samples at48kHz; supply a complete15-second mix. Silence will not be appended automatically.')
 a.out.parent.mkdir(parents=True,exist_ok=True)
 with tempfile.TemporaryDirectory(prefix='velune_conform_') as td:
  td=Path(td);vp=td/'video.mov';wav=td/'mix.wav'
  vf='fps=24,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1'
  run(['ffmpeg','-y','-v','error','-i',str(a.video),'-map','0:v:0','-an','-vf',vf,'-frames:v','360','-c:v','prores_ks','-profile:v','3','-pix_fmt','yuv422p10le',str(vp)])
  run(['ffmpeg','-y','-v','error','-i',str(a.audio),'-map','0:a:0','-vn','-af','aresample=48000,atrim=end_sample=720000,asetpts=PTS-STARTPTS','-ac','2','-c:a','pcm_s24le',str(wav)])
  run(['ffmpeg','-v','error','-i',str(vp),'-i',str(wav),'-map','0:v:0','-map','1:a:0','-c','copy','-t','15',str(a.out)])
 result=probe(a.out);vs=next(s for s in result['streams'] if s['codec_type']=='video');au=next(s for s in result['streams'] if s['codec_type']=='audio')
 samples=decoded_audio_samples(a.out)
 decoded=json.loads(run(['ffprobe','-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','json',str(a.out)]))
 pictures=int(decoded['streams'][0]['nb_read_frames'])
 ok=pictures==360 and Fraction(vs['avg_frame_rate'])==24 and int(au['sample_rate'])==48000 and samples==720000
 result['validation']={'passed':ok,'decoded_audio_samples':samples,'decoded_video_frames':pictures,'required_video_frames':360,'required_fps':24,'warning':'Counts alone do not validate cut timing, shot choreography or perceived mix quality.'}
 a.out.with_suffix('.validation.json').write_text(json.dumps(result,indent=2))
 if not ok:raise RuntimeError('Master counts failed. See the validation JSON; do not deliver this file.')
 print('Technical conform passed:',a.out)
if __name__=='__main__':main()
