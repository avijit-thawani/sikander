"""Generate the battle-view art: troop walk cycles and battlefield backdrops (ai-video toolkit, project 1066-mod).

usage: gen_assets.py keys | walks | strips | backdrops | all
Raw outputs live in ai-video/projects/1066-mod/cleanroom/; processed assets go to assets/sprites and assets/img.
Troop sprites are black silhouettes whose red parts are recoloured to the army colour at runtime.
"""
import os
import subprocess
import sys
from pathlib import Path

LAB = Path.home() / 'Downloads/learn/scratch/ai-video'
sys.path.insert(0, str(LAB))
os.environ.setdefault('AI_VIDEO_BUDGET_USD', '10')
from lib import openrouter  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW = LAB / 'projects/1066-mod/cleanroom'
SPRITES = ROOT / 'assets/sprites'
IMG = ROOT / 'assets/img'
STYLE_REF = LAB / 'projects/1066-mod/cutscene/02_porus.png'
FRAMES, FH = 48, 110

SPRITE = ('Flat 2D game sprite, strict side profile, everyone facing and marching to the right. {body} '
          'Every figure is a solid flat black silhouette like a shadow puppet, no faces, no inner detail, except '
          '{red}, which are flat pure red (#e01010). Full figures visible with space around them, feet on one invisible '
          'ground line. Pure flat white background, no ground, no shadow, no texture, no text.')
TROOPS = {
    'indian_hero': ('An ancient Indian king riding a horse, wearing a tall turban crown, holding a sword up, with an '
                    'attendant on foot beside him holding a tall royal parasol.', 'the parasol, the saddle cloth and the turban sash'),
    'indian_sword': ('A tight group of six ancient Indian swordsmen in turbans and dhotis, each with a broad curved '
                     'sword raised and a small round shield.', 'the shields and the waist sashes'),
    'indian_spear': ('A tight group of six ancient Indian foot soldiers in turbans with tall spears held upright and '
                     'tall rectangular wicker shields, one carries a tall banner.', 'the shields and the banner'),
    'indian_archer': ('A group of five ancient Indian archers in turbans and dhotis, each carrying a very tall bamboo '
                      'longbow taller than himself and a quiver on the back.', 'the quivers and the waist sashes'),
    'greek_hero': ('Alexander the Great riding a rearing warhorse, crested helmet with a tall plume, short cloak '
                   'flowing behind, sword raised.', 'the helmet plume and the cloak'),
    'greek_sword': ('A tight group of six ancient Greek hoplites in crested helmets, each with a large round shield '
                    'held in front and a short spear raised.', 'the round shields and the helmet crests'),
    'greek_phalanx': ('A dense block of eight Macedonian phalangites in a tight formation, very long pikes all angled '
                      'forward, small round shields, crested helmets.', 'the round shields'),
    'greek_archer': ('A group of five ancient Greek archers in short tunics and conical caps, each carrying a short '
                     'recurve bow and a quiver.', 'the tunics'),
}
WALK = ('Static locked-off camera, no camera movement, no zoom. Side view of the black silhouette figures from the '
        'image marching in place as if on a treadmill, a steady slow walk cycle, legs stepping, weapons and banners '
        'bobbing slightly. They stay centred and keep facing right. The flat pure white background stays empty.')

BACKDROP = ('A wide panoramic painted landscape at sunset for a strategy game battlefield, in the exact painterly style '
            'of the reference: glowing orange and gold sky with soft speckled texture, a big pale sun low on the '
            'horizon, several layers of hazy hills fading into the distance, {scene} Large dark silhouette trees only '
            'at the far left and far right edges. The bottom third is flat dark earth, empty. The middle ground is an '
            'open, empty plain with no figures. No people, no animals, no text, no borders.')
MAPS = {
    1: 'a wide river glinting in the middle distance with muddy banks and reeds,',
    2: 'a broad shallow river crossing with sandbars and scattered rocks,',
    3: 'the walls and towers of an ancient fortified city faint on a far hill, palm trees,',
}


def keys():
    for name, (body, red) in TROOPS.items():
        out = RAW / f'{name}_key.png'
        if not out.exists():
            openrouter.image('1066-mod', prompt=SPRITE.format(body=body, red=red), out=out, aspect_ratio='16:9',
                             quality='medium', label=f'cleanroom key {name}')
            print('key', out)


def walks():
    jobs, outs = [], []
    for name in TROOPS:
        out = RAW / f'{name}_walk.mp4'
        if not out.exists() and (RAW / f'{name}_key.png').exists():
            jobs.append(openrouter.video_submit('1066-mod', model='google/veo-3.1-lite', prompt=WALK, duration=4,
                                                resolution='720p', aspect_ratio='16:9', first_frame=RAW / f'{name}_key.png',
                                                label=f'cleanroom walk {name}'))
            outs.append(out)
    if jobs:
        openrouter.video_wait('1066-mod', jobs, outs)


def white_to_alpha(im):
    """Silhouettes on white: alpha from darkness, keep colour so red parts can be recoloured later."""
    im = im.convert('RGB')
    px = im.load()
    out = Image.new('RGBA', im.size)
    po = out.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b = px[x, y]
            a = 255 - min(r, g, b)
            a = 0 if a < 40 else min(255, int((a - 40) * 1.6))
            po[x, y] = (r, g, b, a)
    return out


def strip(name):
    video = RAW / f'{name}_walk.mp4'
    tmp = RAW / f'{name}_frames'
    tmp.mkdir(exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-vf', f'fps={FRAMES / 4},scale=640:-1',
                    '-frames:v', str(FRAMES), tmp / '%03d.png'], check=True)
    frames = [white_to_alpha(Image.open(p)) for p in sorted(tmp.glob('*.png'))]
    box = None
    for f in frames:
        bb = f.getchannel('A').point(lambda a: 255 if a > 60 else 0).getbbox()
        if bb:
            box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    frames = [f.crop(box) for f in frames]
    w = round(frames[0].width * FH / frames[0].height)
    sheet = Image.new('RGBA', (w * len(frames), FH))
    for i, f in enumerate(frames):
        sheet.paste(f.resize((w, FH), Image.LANCZOS), (i * w, 0))
    SPRITES.mkdir(parents=True, exist_ok=True)
    sheet.save(SPRITES / f'{name}.png', optimize=True)
    print('strip', name, w, 'x', FH, len(frames), 'frames')
    return w


def strips():
    sizes = {n: strip(n) for n in TROOPS if (RAW / f'{n}_walk.mp4').exists()}
    print(sizes)


def backdrops():
    for i, scene in MAPS.items():
        raw = RAW / f'backdrop_{i}.png'
        if not raw.exists():
            openrouter.image('1066-mod', prompt=BACKDROP.format(scene=scene), out=raw, aspect_ratio='16:9',
                             quality='medium', refs=[STYLE_REF], label=f'cleanroom backdrop {i}')
        im = Image.open(raw).convert('RGB')
        im.thumbnail((1600, 1600))
        IMG.mkdir(parents=True, exist_ok=True)
        im.save(IMG / f'backdrop_{i}.jpg', quality=85)
        print('backdrop', i, im.size)


if __name__ == '__main__':
    RAW.mkdir(parents=True, exist_ok=True)
    step = sys.argv[1] if len(sys.argv) > 1 else 'all'
    for fn in ([keys, walks, strips, backdrops] if step == 'all' else [globals()[step]]):
        fn()
