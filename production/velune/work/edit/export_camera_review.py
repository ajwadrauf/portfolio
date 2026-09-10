"""Export and validate the silent camera study. This never calls a provider."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json
import shutil
import subprocess

WORK = Path(__file__).resolve().parent.parent
PROJECT = WORK.parent
FRAMES = WORK / 'blender/renders/guide'

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

def main():
    frames = [FRAMES / f'frame_{n:04}.png' for n in range(1, 361)]
    for path in frames:
        with Image.open(path) as im:
            assert im.size == (1920, 1080), (path, im.size)
    assert len(list(FRAMES.glob('frame_*.png'))) == 360
    video = WORK / 'blender/renders/guide_15s.mp4'
    run(['ffmpeg', '-y', '-v', 'error', '-framerate', '24', '-start_number', '1',
         '-i', str(FRAMES / 'frame_%04d.png'), '-frames:v', '360', '-an',
         '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
         '-g', '24', '-movflags', '+faststart', str(video)])
    info = json.loads(run(['ffprobe', '-v', 'error', '-count_frames', '-show_streams',
                          '-show_format', '-of', 'json', str(video)]))
    stream = info['streams'][0]
    assert len(info['streams']) == 1 and stream['codec_type'] == 'video'
    assert stream['nb_read_frames'] == '360'
    assert stream['r_frame_rate'] == stream['avg_frame_rate'] == '24/1'
    assert (stream['width'], stream['height']) == (1920, 1080)
    assert float(info['format']['duration']) == 15.0
    ticks = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                           '-show_frames', '-show_entries', 'frame=best_effort_timestamp_time',
                           '-of', 'json', str(video)]))['frames']
    assert len(ticks) == 360
    assert all(abs(float(f['best_effort_timestamp_time']) - n / 24) < .000002
               for n, f in enumerate(ticks))
    exports = PROJECT / 'exports'; exports.mkdir(exist_ok=True)
    target = exports / 'VELUNE_camera_animatic_15s.mp4'; shutil.copy2(video, target)
    Image.open(frames[91]).convert('RGB').save(exports / 'VELUNE_poster.jpg', quality=90, optimize=True)
    # Thirty review poses, refreshed from the final full-resolution sequence.
    refs = json.loads((WORK / 'reference_manifest.json').read_text())['references']
    poses = [r['frame'] for r in refs if r['id'].startswith('P')]
    sheet = Image.new('RGB', (1280, 1632), '#eee9df'); draw = ImageDraw.Draw(sheet)
    for i, n in enumerate(poses):
        with Image.open(frames[n]) as im:
            im.save(WORK / 'blender/renders/keyframes' / f'pose_{n:03}.png')
            x, y = (i % 4) * 320, (i // 4) * 204
            sheet.paste(im.convert('RGB').resize((320, 180)), (x, y + 24))
            draw.text((x + 8, y + 6), f'n{n:03} / Blender {n+1}', fill='#2b1821')
    sheet.save(PROJECT / 'reports/camera-contact.jpg', quality=93)
    shutil.copy2(PROJECT / 'reports/camera-contact.jpg', exports / 'VELUNE_contact_sheet.jpg')
    # Every picture, grouped into six readable strips for sequence inspection.
    for page in range(6):
        board = Image.new('RGB', (1920, 780), '#eee9df'); label = ImageDraw.Draw(board)
        for index in range(60):
            n = page * 60 + index; x, y = (index % 10) * 192, (index // 10) * 130
            with Image.open(frames[n]) as im:
                board.paste(im.convert('RGB').resize((192, 108)), (x, y + 22))
            label.text((x+5, y+4), f'n{n:03}', fill='#2b1821')
        board.save(PROJECT / 'reports' / f'sequence-{page+1}.jpg', quality=94)
    report = {
        'status': 'Camera study rendered; user camera approval pending',
        'video': str(target), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'bytes': target.stat().st_size, 'codec': stream['codec_name'], 'pixel_format': stream['pix_fmt'],
        'width': 1920, 'height': 1080, 'fps': '24/1', 'decoded_pictures': 360,
        'first_picture_seconds': 0, 'last_picture_seconds': 359/24,
        'container_duration_seconds': 15.0, 'all_picture_timestamps_match_24fps': True,
        'audio_streams': 0, 'audio_status': 'Silent animatic; audio production pending',
        'final_commercial': False, 'paid_requests': 0,
    }
    (PROJECT / 'reports/camera-export-validation.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
