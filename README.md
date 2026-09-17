# epa-dunk-maskinen

The EPA-dunk-maskinen turns any song into a dunk edit in the browser. Loads mp3, wav, m4a or flac, detects tempo and key, speeds the track up, and locks a synthesized kick and sub bass to the beat. Exports as mp3 or wav. One HTML file, no build step, no upload.

Everything runs client-side. The audio never leaves the machine it's played on.

## What it does

- Speeds the track up, pitch rising with it, the way sped-up edits do
- Detects the tempo and the root note of the original automatically
- Lays a synthesized kick and sub bass on the beat grid, retuned to match the new speed
- Low-shelf bass boost on the song, plus sidechain ducking so the kick punches through
- Five patterns: four on the floor, double kick, rolling sub, kick only, off
- Waveform with the beat grid drawn on it, tap tempo, halve/double, and downbeat nudging for tracks the detector reads wrong
- Optional pitch-preserving speed, via a WSOLA time-stretch, when you want it faster without the chipmunk
- Four kick characters, from a clean sine to a saturated 808
- Auto level on the source, plus a manual song level trim against the kick and sub
- Exports the finished mix as mp3 (192 kbps) or wav
- Installs as an app and runs offline after the first visit

## Run it

Open `index.html` in a browser. That's the whole installation.

Served over HTTP(S) it also registers a service worker, so it installs to a home screen and keeps working with no connection. The typeface and the mp3 encoder are cached on first use.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app: markup, styles, audio engine |
| `sw.js` | Service worker, caches the shell and the two external assets |
| `manifest.webmanifest` | App name, colors and icons for installation |
| `icon-*.png`, `apple-touch-icon.png` | Launcher icons |

Changing `index.html` means bumping `VERSION` in `sw.js`, otherwise returning visitors keep the cached build.

## How it works

**Decode.** The file is read as an `ArrayBuffer` and handed to `decodeAudioData`, which returns raw float samples.

**Tempo detection.** The signal is low-passed to roughly 160 Hz to emphasize the kick, chopped into 256-sample frames, and each frame's energy rise over the previous one becomes an onset value. Every tempo from 70 to 190 BPM is then tested at every phase, scored by how much onset energy lands on the beats, and weighted with a Gaussian prior centered at 125 BPM so a comb at half the true tempo doesn't win the tie.

**Root detection.** A Goertzel filter measures energy at all twelve pitch classes across three bass octaves. The loudest wins. Because speeding up shifts pitch by a non-integer number of semitones, the sub is tuned to `root × speed` rather than to a fixed note.

**Synthesis.** The kick is a sine sweeping 165 Hz to 44 Hz over 75 ms with an exponential decay, plus a high-passed noise burst for the attack. The sub is a sine at the root with a quiet triangle an octave above, so small speakers that can't reproduce 50 Hz still render something audible. Each kick writes an automation point on a ducking gain node in the song's path.

**Timing.** Notes are booked on the Web Audio clock, which is sample-accurate. A 40 ms interval looks 250 ms ahead and schedules whatever falls inside that window. All beat math happens in the original track's timeline and is divided by the speed only at the moment of scheduling, so changing the speed doesn't scramble the grid.

**Pitch preservation.** With it switched on, the buffer is time-stretched once per speed change using WSOLA: 2048-sample Hann frames at a 1024-sample synthesis hop, with each frame's read position chosen by cross-correlating ±192 samples against the previous frame's natural continuation. Playback then runs at rate 1.0, and the sub drops its speed multiplier since the pitch no longer moves.

**Loudness.** At load, block RMS is measured over 400 ms windows for the first three minutes and the 90th percentile is taken as the working level — a percentile rather than a mean, so intros and silence don't drag it down. The gain that brings it to target is applied ahead of everything else, and a manual trim sits after it.

**Export.** The same graph is rebuilt inside an `OfflineAudioContext` and rendered as fast as the CPU allows, then interleaved to 16-bit wav or encoded to mp3 in 1152-sample blocks.

## Dependencies

None at build time. Two things load at runtime:

- [lamejs](https://github.com/zhuker/lamejs) from jsDelivr, fetched only when you export an mp3. It is LGPL-licensed and is not bundled with this repository.
- Archivo from Google Fonts. Remove the `<link>` tags in the head and the page falls back to Helvetica and Arial, with no other loss.

Delete both and the app still works offline from the first load; you just lose mp3 export and the typeface. With them kept, the service worker caches both after the first use, so offline runs lose nothing.

## Browser support

Chrome, Edge, Firefox and Safari, desktop and mobile. Which audio formats decode depends on the browser, not on this code — mp3 and wav work everywhere, while Opus in a `.webm` container and some `.m4a` variants may be refused. The status line reports the decoder's own reason when a file is rejected.

MP3 export takes roughly 10 to 40 seconds for a three-minute track. It runs in chunks so the page stays responsive.

## A note on the name

An EPA-traktor is a car converted to be legally drivable at fifteen in Sweden, capped at 30 km/h. Dunk is what comes out of the speakers: sped-up, bass-heavy edits of whatever was on the radio. Maskinen just means "the machine." This makes those.

## License

MIT for this code. lamejs, loaded separately at runtime, is LGPL.
