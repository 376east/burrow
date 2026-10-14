"""Assemble real Electron footage and chapter metadata; no synthetic UI frames."""
from pathlib import Path
import argparse
import asyncio
import hashlib
import json
import math
import os
import shutil
import subprocess
import textwrap

VOICE = 'ru-RU-SvetlanaNeural'
RATE = '+5%'
BAND = 110


def load_record(root):
    record = json.loads((root / 'demo-recording.json').read_text(encoding='utf8'))
    if record.get('schemaVersion') != 2:
        raise ValueError('Record again with the current record.mjs (chapter metadata schema 2 required)')
    if record.get('errors'):
        raise ValueError('Recording contains renderer errors')
    duration = float(record['demoSeconds'])
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError('Invalid recording duration')
    chapters = record['chapters']
    if not chapters:
        raise ValueError('Recording has no chapters')
    previous = 0.0
    ids = set()
    for scene in chapters:
        start, end = float(scene['seconds']), float(scene['end'])
        if not all(math.isfinite(x) for x in (start, end)) or abs(start - previous) > .1 or end <= start or end > duration + .1:
            raise ValueError(f'Invalid chapter boundary: {scene["id"]}')
        if not scene['title'] or not scene['narration'] or scene['id'] in ids:
            raise ValueError('Chapters need unique IDs, titles and narration')
        ids.add(scene['id'])
        previous = end
    if abs(previous - duration) > .1:
        raise ValueError('Chapters must cover the complete recording')
    return record


def stamp(seconds):
    centiseconds = round(seconds * 100)
    hours, remainder = divmod(centiseconds, 360000)
    minutes, remainder = divmod(remainder, 6000)
    whole, fraction = divmod(remainder, 100)
    return f'{hours}:{minutes:02}:{whole:02}.{fraction:02}'


def ass_text(value):
    return value.replace('\\', '＼').replace('{', '｛').replace('}', '｝').replace('\n', r'\N')


def make_captions(record, font):
    width, height = record['viewport']['width'], record['viewport']['height']
    if (width, height) != (1280, 900):
        raise ValueError('This caption layout requires the native 1280x900 capture')
    header = f'''[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height + BAND}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,{font},28,&H00BDE4C6,&H00BDE4C6,&H00302D28,&H00302D28,-1,0,0,0,100,100,0,0,1,0,0,7,32,32,0,1
Style: Caption,{font},26,&H00EAF2F7,&H00EAF2F7,&H00302D28,&H00302D28,0,0,0,0,100,100,0,0,1,0,0,7,32,32,0,1
Style: Block,{font},20,&H00BDE4C6,&H00BDE4C6,&H00302D28,&H00302D28,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
    lines = [header]
    for index, scene in enumerate(record['chapters']):
        start, end = stamp(scene['seconds']), stamp(scene['end'])
        lines.append(f'Dialogue: 1,{start},{end},Title,,0,0,0,,{{\\pos(32,907)}}{ass_text(scene["title"])}')
        # Full narration stays legible on two lines, independent of voice availability.
        caption = '\n'.join(textwrap.wrap(scene['narration'], width=86))
        if len(caption.splitlines()) > 2:
            raise ValueError(f'Shorten captions for {scene["id"]}')
        lines.append(f'Dialogue: 1,{start},{end},Caption,,0,0,0,,{{\\pos(32,946)}}{ass_text(caption)}')
        # Square chapter pips echo Minecraft blocks without a second UI or fake readouts.
        for block in range(len(record['chapters'])):
            colour = '&HBDE4C6&' if block <= index else '&H62584B&'
            x = 1138 + block * 22
            lines.append(f'Dialogue: 0,{start},{end},Block,,0,0,0,,{{\\pos({x},916)\\1c{colour}\\p1}}m 0 0 l 12 0 12 12 0 12')
    return '\n'.join(lines) + '\n'


async def assemble(args):
    root = args.directory.resolve()
    record = load_record(root)
    ffmpeg, ffprobe = shutil.which('ffmpeg'), shutil.which('ffprobe')
    if not ffmpeg or not ffprobe:
        raise RuntimeError('ffmpeg and ffprobe must be on PATH')
    filters = subprocess.check_output([ffmpeg, '-hide_banner', '-filters'], text=True, stderr=subprocess.STDOUT)
    if ' subtitles ' not in filters:
        raise RuntimeError('ffmpeg needs the libass subtitles filter')
    captions = make_captions(record, args.font)
    if args.check:
        print(f'PASS: {len(record["chapters"])} chapters, caption layout, timing, ffmpeg/libass; capture and rendering not checked')
        return
    raw = Path(record['videoPath'])
    if not raw.is_file():
        raise FileNotFoundError(raw)
    work = root / 'voices'
    work.mkdir(exist_ok=True)
    (root / 'chapters.ass').write_text(captions, encoding='utf8')

    def probe(file):
        return json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(file)], text=True))

    def run(parameters):
        subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *parameters], cwd=root, check=True)

    raw_duration = float(probe(raw)['format']['duration'])
    duration = record['demoSeconds']
    if raw_duration < duration - .1:
        raise ValueError('Raw capture is shorter than its metadata')
    trim_start = max(0, raw_duration - duration - .15)
    source, output = root / 'burrow-demo.mp4', root / 'burrow-demo-voice.mp4'
    # Always rebuild: stale clips from previous captures must not silently survive.
    run(['-ss', str(trim_start), '-i', str(raw), '-t', str(duration), '-an', '-vf',
         "pad=iw:ih+110:0:0:color=0x302d28,subtitles=filename='chapters.ass'",
         '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(source)])
    duration = float(probe(source)['format']['duration'])
    timeline = []
    if not args.silent:
        import edge_tts
        inputs, audio_filters, labels = ['-i', str(source)], [], []
        for index, scene in enumerate(record['chapters'], 1):
            start, end, text = scene['seconds'] + .25, scene['end'] - .2, scene['narration']
            digest = hashlib.sha256(f'{VOICE}|{RATE}|{text}'.encode()).hexdigest()[:16]
            voice = work / f'{digest}.mp3'
            if not voice.exists():
                temporary = voice.with_suffix('.partial.mp3')
                try:
                    await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(temporary))
                    probe(temporary)
                    temporary.replace(voice)
                finally:
                    temporary.unlink(missing_ok=True)
            seconds = float(probe(voice)['format']['duration'])
            available = end - start - .15
            if available <= 0:
                raise ValueError(f'Chapter too short: {scene["id"]}')
            speed = max(1, seconds / available)
            if speed > 1.15:
                raise ValueError(f'Shorten narration or extend recording chapter {scene["id"]}: voice {seconds:.2f}s, available {available:.2f}s')
            inputs += ['-i', str(voice)]
            label = f'voice{index}'
            audio_filters.append(f'[{index}:a]atempo={speed:.6f},adelay={round(start*1000)}:all=1[{label}]')
            labels.append(f'[{label}]')
            timeline.append(dict(scene=scene['id'], start=start, end=end, voice_end=start+seconds/speed, speed=speed, text=text))
        audio_filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-2:LRA=8,aresample=48000,apad[a]')
        run([*inputs, '-filter_complex', ';'.join(audio_filters), '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', str(duration), '-movflags', '+faststart', str(output)])
        result = probe(output)
        if not any(s['codec_type'] == 'audio' for s in result['streams']) or abs(float(result['format']['duration']) - duration) > .1:
            raise ValueError('Audio stream or output duration failed verification')
    else:
        output = source
    run(['-i', str(output), '-f', 'null', '-'])
    (work / 'timeline.json').write_text(json.dumps(dict(
        recordingCommit=record['commit'], recordingDirty=record['dirty'],
        voice=None if args.silent else VOICE, rate=None if args.silent else RATE,
        duration=duration, trimStart=trim_start, captionBand=BAND, decode='passed',
        humanListening=False, visualReview=False, scenes=timeline,
        output=str(output), sha256=hashlib.sha256(output.read_bytes()).hexdigest(),
    ), ensure_ascii=False, indent=2), encoding='utf8')
    print(f'PASS: full decode and technical timing; human review required: {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path, nargs='?', default=Path('work/demo'))
    parser.add_argument('--silent', action='store_true', help='Keep chapter captions without sending narration to Edge TTS')
    parser.add_argument('--check', action='store_true', help='Validate metadata and local tools without rendering or voice generation')
    parser.add_argument('--font', default='Segoe UI' if os.name == 'nt' else 'DejaVu Sans', help='Installed font with Cyrillic support')
    asyncio.run(assemble(parser.parse_args()))
