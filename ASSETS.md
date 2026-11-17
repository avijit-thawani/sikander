# Assets

Every asset in `assets/` belongs to this project. None come from the original game.

| File | What | Origin | Processing |
|---|---|---|---|
| `assets/img/title.png` | "SIKANDER" title lettering | AI-generated for this project (`ai-video/projects/1066-mod/art/sikander_raw_0.png`) | Downscaled to 1200 px, ink converted to alpha (transparent PNG), cropped |
| `assets/img/concept_leaders.jpg` | Leader silhouettes, title backdrop | AI-generated for this project (`ai-video/projects/1066-mod/art/concept_leaders.png`) | Downscaled to 1200 px, JPEG |
| `assets/img/concept_elephants.jpg` | War-elephant concept still (not yet shown in the UI) | AI-generated for this project (`ai-video/projects/1066-mod/art/concept_elephants.png`) | Downscaled to 1200 px, JPEG |
| `assets/sprites/elephant_walk_strip.png` | War-elephant walk cycle, 48 frames of 188 × 150, horizontal, transparent | AI-generated for this project (`1066/preview/elephant_walk_strip.png`) | Copied unchanged |
| `assets/cutscene/intro.mp4` | Intro motion comic, played before campaign battle 1 | AI-generated for this project (`1066/mod/cutscene/intro.mp4`) | Copied unchanged |
| `assets/audio/taunts/pauravas/0-5.mp3` | Spoken taunts: MOORKH YAVANA, GADHA SENAPATI, ULLU KA PATTHA, DARPOK CHOOHA, BHAAG JA KAAYAR, KHATTA DAHI | AI-generated for this project (`ai-video/projects/1066-mod/audio/pauravas/00-05.wav`) | WAV to MP3 (96 kbps, ffmpeg) |
| `assets/audio/taunts/greeks/0-5.mp3` | Spoken taunts: MUD-FOOTED RAJA, GOAT-BRAINED RAJA, PEACOCK-BRAINED FOOL, ELEPHANT DUNG, SOFT-SANDAL FOOL, MONSOON-SOAKED RAT | AI-generated for this project (`ai-video/projects/1066-mod/audio/yavanas/00-05.wav`) | WAV to MP3 (96 kbps, ffmpeg) |
| `assets/audio/taunts/mauryas/0-5.mp3` | Spoken taunts: NAKLI RAJA, BUDDHU YAVANA, PAGAL HAATHI, KAAYAR SIPAHI, NAALAYAK, BHEEGI BILLI | AI-generated for this project (`ai-video/projects/1066-mod/audio/mauryas/00-05.wav`) | WAV to MP3 (96 kbps, ffmpeg) |

Unit icons (crown, sword, spear, bow, elephant) and battle-view silhouettes are hand-written SVG in `src/ui/icons.js`, drawn for this project.

## Battle-view art (`tools/gen_assets.py`)

| File | What | Origin | Processing |
|---|---|---|---|
| `assets/sprites/{indian,greek}_{hero,sword,spear,phalanx,archer}.png` | Troop walk cycles, 48 frames × 110 px tall, transparent | AI-generated for this project: GPT Image key frame (black silhouettes, red army-colour parts) then a Veo 3.1 Lite 4 s walk video (`ai-video/projects/1066-mod/cleanroom/`) | Frames sampled at 12 fps, white keyed to alpha, cropped, tiled. Red parts are recoloured to the army colour at runtime (`src/ui/sprites.js`) |
| `assets/img/backdrop_{1,2,3}.jpg` | Sunset battlefield backdrops, one per map | AI-generated for this project (GPT Image, styled on the cutscene stills) | Downscaled to 1600 px, JPEG |
