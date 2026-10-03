from pathlib import Path
import sys, asyncio, json, subprocess, hashlib

import edge_tts
import shutil

ROOT = Path(sys.argv[1] if len(sys.argv)>1 else 'work/demo').resolve()
WORK = ROOT / 'voices'
WORK.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'burrow-demo.mp4'
OUTPUT = ROOT / 'burrow-demo-voice.mp4'
FFMPEG = shutil.which('ffmpeg')
FFPROBE = shutil.which('ffprobe')
if not FFMPEG or not FFPROBE:
    raise SystemExit('Install ffmpeg and ffprobe on PATH')
SCENES = [
    ('play', .35, 5.55, 'Барроу. Minecraft — соло или с друзьями.'),
    ('library', 6.15, 10.9, 'Сборки — в библиотеке. Открываем детали.'),
    ('details', 11.05, 17.55, 'Здесь — версия игры, настройки, ресурсы, миры и скриншоты.'),
    ('friends', 18.2, 25.3, 'Во вкладке «Вместе» — способы подключения и инструкция для первого захода.'),
    ('settings', 25.95, 32.1, 'Темы, акценты и свои цвета собраны в настройках.'),
    ('light', 32.45, 38.1, 'Светлая и тёмная темы сохраняют знакомое расположение кнопок.'),
    ('end', 39.0, 44.3, 'Барроу. Демонстрационные сборки, без запуска игры.'),
]

def probe(p):
    return json.loads(subprocess.check_output([FFPROBE, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(p)], text=True))

def run(args):
    subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)

async def main():
    if not SOURCE.exists():
        record=json.loads((ROOT/'demo-recording.json').read_text(encoding='utf8'))
        raw=Path(record['videoPath'])
        seconds=record['demoSeconds']
        start=max(0,float(probe(raw)['format']['duration'])-seconds-.15)
        run(['-ss',str(start),'-i',str(raw),'-t',str(seconds),'-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(SOURCE)])
    inputs = ['-i', str(SOURCE)]
    filters, labels, timeline = [], [], []
    for index, (name, start, end, text) in enumerate(SCENES, 1):
        voice = WORK / f'{name}-{hashlib.sha256(text.encode()).hexdigest()[:8]}.mp3'
        if not voice.exists():
            await edge_tts.Communicate(text, 'ru-RU-SvetlanaNeural', rate='+5%').save(str(voice))
        seconds = float(probe(voice)['format']['duration'])
        speed = max(1, seconds / (end-start-.15))
        if speed > 1.15:
            raise ValueError(f'Shorten narration for {name}: {seconds}s')
        inputs += ['-i', str(voice)]
        label = f'v{index}'
        filters.append(f'[{index}:a]atempo={speed:.6f},adelay={round(start*1000)}:all=1[{label}]')
        labels.append(f'[{label}]')
        voice_end = start + seconds/speed
        assert voice_end < end
        timeline.append(dict(scene=name, start=start, end=end, voice_end=voice_end, speed=speed, text=text))
        print(name, round(seconds, 2), round(speed, 3), flush=True)
    filters.append(''.join(labels)+f'amix=inputs={len(labels)}:normalize=0,loudnorm=I=-16:TP=-2:LRA=8,aresample=48000,apad[a]')
    duration = float(probe(SOURCE)['format']['duration'])
    run([*inputs, '-filter_complex', ';'.join(filters), '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', str(duration), '-movflags', '+faststart', str(OUTPUT)])
    result = probe(OUTPUT)
    assert any(s['codec_type']=='audio' for s in result['streams'])
    assert abs(float(result['format']['duration'])-duration)<.1
    run(['-i', str(OUTPUT), '-f', 'null', '-'])
    # Demuxed video must be bit-identical: voiceover cannot change or freeze frames.
    hashes = []
    for p in [SOURCE, OUTPUT]:
        hashes.append(subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(p), '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-'], text=True).strip())
    assert hashes[0] == hashes[1]
    (WORK/'timeline.json').write_text(json.dumps(dict(voice='ru-RU-SvetlanaNeural', rate='+5%', duration=duration, videoUnchanged=True, decode='passed', scenes=timeline), ensure_ascii=False, indent=2), encoding='utf-8')
    print('PASS: audio, timing, full decode, unchanged video', flush=True)

asyncio.run(main())
