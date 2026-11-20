# Kifak: project notes for Claude

The site was called "Falafel" until November 2026. The repo and web address still say `falafel`; the owner may rename them on GitHub later.

A free website that teaches spoken **Lebanese Arabic** to **adult foreigners**, using the owner's own voice and simple pictures. Live at https://dgheish.github.io/falafel/ (GitHub Pages, `main` branch, root folder). A mobile app may come later; charging money may come later too.

The owner is a native Lebanese speaker. They review the wording and record every clip themselves. They are not a programmer: explain things in plain words, give clear steps, and do the technical work for them.

## Decisions already made (don't re-ask)

- **Dialect:** Beirut Lebanese. Show **Arabizi first** (`kifak`, `7abibi`, `3am`), Arabic script under it, English under that. The learner can hide any of the three with the buttons in the top bar.
- **Man/woman forms:** phrases that change by who you talk to have an `f` form, shown with a "Talking to: a man / a woman" switch.
- **Structure:** 10 levels × 20 lessons = 200 lessons. Level 1 is single words, and the levels get harder up to Level 10 (full native-speed conversations, slang, code-switching, proverbs). **All levels are open to everyone**, with no locking.
- **Lesson flow:** Learn (picture cards, Play / Slow) → Listen (dialogue) → Repeat (learner records and compares) → Quiz. From Level 3 the quiz adds sentence building (tap word tiles in order). Lessons with `questions` add listening questions at the end.
- **Look:** name "Kifak" in cedar green with a red question mark ("Kifak?"), and a drawn Lebanese flag as logo and tab icon. Top bar like a landing page: white with a thin shadow, logo left, links in the middle (Levels, How to read Arabizi, Recording studio; red underline on the current one), Abc/عربي/EN buttons right. On phones the links drop to a second row. Home page opens with a big centred green headline (Poppins font) and a "Start Level 1" button. Colours: cedar green (`#0b6b3a`) for headlines, buttons and links, red (`#d8121c`) only for small touches. Green = correct, red = wrong. Dark mode is supported.
- **Pictures:** emoji for now. Real illustrations may come later.
- **Audio:** real recordings by the owner, never text-to-speech.

## Status

- All 200 lessons are written: 1,982 phrases, 176 female forms, 1,282 dialogue lines, 398 listening questions. **Everything is a DRAFT** written by Claude and needs native review. Expect spelling and phrasing fixes, especially in Levels 9–10 and in sensitive lessons (condolences, news, "Words to avoid").
- **No audio recorded yet.** 3,440 clips are needed. Suggested order: Levels 1–3 first.

## Files

- `content/lessons.json`: all content. `levels[] → lessons[] → items[]` (`id, arabizi, arabic, english, pic, note?, f?`), `dialogue[]` (`id, speaker, arabizi, arabic, english`), `questions[]` (`q, options, answer` index). `speakers` maps each name to `m`/`f` (sets the chat-bubble side). Lesson ids: `l1`–`l7` for the first seven, otherwise `lv<level>-<nn>`. Clip ids are `<lessonId>-<nn>` for phrases and `<lessonId>-d<n>` for dialogue.
- `audio/`: published recordings named `<clipId>.mp3|m4a|webm|ogg`. A female form uses `<clipId>-f`. The app looks for a file here first, then for a recording saved in the browser (IndexedDB).
- `js/app.js` (router and all views), `js/audio.js` (playback, mic, audio lookup), `js/store.js` (settings, progress, IndexedDB). The storage keys keep the old `ahla` prefix on purpose, so existing progress and recordings survive.
- `css/style.css`: colour tokens at the top. The top bar and home headline styles are at the end.
- `tools/bump.sh`: **run after any change to js/, css/ or content/.** It raises the version in `version.json`, every `?v=` tag and `VERSION` in app.js. Phones reload automatically when the version goes up. Without it, phones show stale cached files (this happened once: stuck on "Loading…").
- `tools/check_content.py`: run before publishing content edits. It catches non-Latin characters in Arabizi (Cyrillic look-alikes, ç, ü, %), duplicate ids and unknown speakers.

## Recording workflow

The owner records in **Recording studio** (`#/studio`, link in the footer): one lesson at a time, with a lesson picker and next/previous buttons. Recordings are saved in that browser and the lessons use them right away. **Download all** gives `kifak-audio.zip`. When the owner sends the zip, unzip it into `audio/`, commit and push, and the voice goes live for everyone. Remind them to download after each session, because browser storage can be lost.

## Working on it

- Run locally: `python3 -m http.server 8080`, then open http://localhost:8080. It must be served, not opened as a file.
- Test in a browser with Playwright (Chromium is preinstalled). Play through lessons to the end of the quiz and check for page errors. Screenshot at phone size.
- After changes: `tools/bump.sh`, `python3 tools/check_content.py`, commit, `git push`. GitHub Pages redeploys in about a minute.
- Cloud sessions here can push to the repo but **can't change GitHub settings** (Pages, renaming). The owner does those by hand.
- Corrections from the owner arrive in plain words ("Level 4, At the pharmacy: we say X"). Find the phrase in `lessons.json`, fix the arabizi, arabic and english consistently (and the matching dialogue lines), then bump and push.

## Writing style for replies

The owner's account has style preferences: plain words, contractions, mixed sentence lengths, no em dashes, no filler openings or closing summaries.
