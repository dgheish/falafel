# Kifak: project notes for Claude

The site was called "Falafel" until November 2026. The repo and web address still say `falafel`; the owner may rename them on GitHub later.

A free website that teaches spoken **Lebanese Arabic** to **adult foreigners**, using the owner's own voice and simple pictures. Live at https://dgheish.github.io/falafel/ (GitHub Pages, `main` branch, root folder). A mobile app may come later; charging money may come later too.

The owner is a native Lebanese speaker. They review the wording and record every clip themselves. They are not a programmer: explain things in plain words, give clear steps, and do the technical work for them.

## Decisions already made (don't re-ask)

- **Name for Arabic in English letters:** on the site it's called **Latin-script Arabic** (the owner's choice, Nov 2026), never "Arabizi". The data field is still `arabizi` and the toggle button still says Abc.
- **Dialect:** Beirut Lebanese. Show **Latin-script Arabic first** (`kifak`, `7abibi`, `3am`), Arabic script under it, English under that. The learner can hide any of the three with the buttons in the top bar.
- **Man/woman forms:** phrases that change by who you talk to have an `f` form, shown with a "Talking to: a man / a woman" switch.
- **Structure:** 10 levels × 20 lessons = 200 lessons, **30 examples per lesson** (6,000 in total). **All levels are open to everyone**, with no locking.
- **Ladder (decided Nov 2026):** Levels 1–2 single words, 3–4 short phrases (2–4 words), 5–6 full sentences, 7–8 two or three linked sentences, 9–10 paragraphs of 4–6 sentences about one scene.
- **Two sections:** the home page offers **Lessons** (`#/lessons`, the levels) and **Conversations** (`#/talks`, every lesson's dialogue on its own page `#/talk/<lessonId>` with its listening questions underneath). Dialogues stay in each lesson's `dialogue[]` in the JSON, so clip ids don't change.
- **Lesson flow:** Learn (picture cards, Play / Slow) → Repeat (learner records and compares, with "Skip to the quiz") → Quiz. The quiz picks 15 random examples each time. From Level 3 it adds sentence building (tap word tiles in order) for examples of 3–8 words. Texts over 60 characters get a smaller font.
- **Look:** name "Kifak" in cedar green with a red question mark ("Kifak?"), and a drawn Lebanese flag as logo and tab icon. Top bar like a landing page: white with a thin shadow, logo left, links in the middle (Lessons, Conversations, Reading Latin-script Arabic, Recording studio; red underline on the current section), Abc/عربي/EN buttons right. On phones the links sit on a second row that scrolls sideways. Home page opens with a big centred green headline (Poppins font), a "Start Level 1" button, and two big choice cards: Lessons and Conversations. Colours: cedar green (`#0b6b3a`) for headlines, buttons and links, red (`#d8121c`) only for small touches. Green = correct, red = wrong. Dark mode is supported.
- **Pictures:** emoji for now. Real illustrations may come later.
- **Audio:** real recordings by the owner, never text-to-speech.

## Status

- All 200 lessons are written. **Everything is a DRAFT** written by Claude and needs native review. Expect spelling and phrasing fixes, especially in Levels 9–10 and in sensitive lessons (condolences, news, "Words to avoid").
- **Expanding to 30 examples per lesson, level by level.** Done: Level 1 (all 20 lessons at 30). To do: Levels 2–10. Levels 3–10 also need their examples reshaped to fit the ladder (phrases, then sentences, then paragraphs); their level titles and goals still describe the old plan.
- **No audio recorded yet.** Run `python3 tools/check_content.py` for the current clip count. Suggested order: Levels 1–3 first.

## Files

- `content/lessons.json`: all content. `levels[] → lessons[] → items[]` (`id, arabizi, arabic, english, pic, note?, f?`), `dialogue[]` (`id, speaker, arabizi, arabic, english`), `questions[]` (`q, options, answer` index). `speakers` maps each name to `m`/`f` (sets the chat-bubble side). Lesson ids: `l1`–`l7` for the first seven, otherwise `lv<level>-<nn>`. Clip ids are `<lessonId>-<nn>` for phrases and `<lessonId>-d<n>` for dialogue.
- `audio/`: published recordings named `<clipId>.mp3|m4a|webm|ogg`. A female form uses `<clipId>-f`. The app looks for a file here first, then for a recording saved in the browser (IndexedDB).
- `js/app.js` (router and all views), `js/audio.js` (playback, mic, audio lookup), `js/store.js` (settings, progress, IndexedDB). The storage keys keep the old `ahla` prefix on purpose, so existing progress and recordings survive.
- `css/style.css`: colour tokens at the top. The top bar and home headline styles are at the end.
- `tools/bump.sh`: **run after any change to js/, css/ or content/.** It raises the version in `version.json`, every `?v=` tag and `VERSION` in app.js. Phones reload automatically when the version goes up. Without it, phones show stale cached files (this happened once: stuck on "Loading…").
- `tools/add_items.py <file.txt>`: appends examples to lessons from a plain text file (`@ lessonId`, then `arabizi | arabic | english | pic | note | f arabizi | f arabic`). New ids continue after the last one, so existing clip ids never change. Duplicates are skipped.
- `tools/check_content.py`: run before publishing content edits. It catches non-Latin characters in Arabizi (Cyrillic look-alikes, ç, ü, %), duplicate ids and unknown speakers.

## Recording workflow

The owner records in **Recording studio** (`#/studio`, link in the footer): one lesson at a time, with a lesson picker and next/previous buttons. The first entry in the picker is **Reading Latin-script Arabic**: 12 clips, the sound on its own (`abc-<key>`, e.g. `abc-3`) and an example word (`abc-<key>-ex`). Those rows live in `ABC` in app.js, not in lessons.json. Recordings are saved in that browser and the lessons use them right away. **Download all** gives `kifak-audio.zip`. When the owner sends the zip, unzip it into `audio/`, commit and push, and the voice goes live for everyone. Remind them to download after each session, because browser storage can be lost.

## Working on it

- Run locally: `python3 -m http.server 8080`, then open http://localhost:8080. It must be served, not opened as a file.
- Test in a browser with Playwright (Chromium is preinstalled). Play through lessons to the end of the quiz and check for page errors. Screenshot at phone size.
- After changes: `tools/bump.sh`, `python3 tools/check_content.py`, commit, `git push`. GitHub Pages redeploys in about a minute.
- Cloud sessions here can push to the repo but **can't change GitHub settings** (Pages, renaming). The owner does those by hand.
- Corrections from the owner arrive in plain words ("Level 4, At the pharmacy: we say X"). Find the phrase in `lessons.json`, fix the arabizi, arabic and english consistently (and the matching dialogue lines), then bump and push.

## Writing style for replies

The owner's account has style preferences: plain words, contractions, mixed sentence lengths, no em dashes, no filler openings or closing summaries.
