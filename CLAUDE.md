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
- **Verbs section (Nov 2026):** `#/verbs` lists the verbs, `#/verb/<id>/<tense>` shows one verb with tabs Past, Every day (b- form), Right now (3am + b- form), Future (ra7 + form without b-), Commands; each row has a play button. `#/verbquiz/<id>` asks 10 "How do you say…" questions (the "you" forms say to a man / woman / group). It's the third card on the home page and a menu link. Has 36 verbs.
- **Grammar, Culture, Review, Dictionary (Nov 2026, owner asked for "everything a learner needs"):** `#/grammar` and `#/culture` list topics from `content/grammar.json`; each topic `#/topic/<id>` has explanations, tables, playable examples, common mistakes and 3 practice questions. `#/review` is flashcards (spaced repetition, Leitner boxes in `srs` in store.js) made from the examples of every lesson the learner finished: due cards plus up to 10 new ones, max 25 a session, "English first" or "Lebanese first". `#/dictionary/<query>` searches every lesson example, verb and grammar example (Arabic is matched without vowel marks or hamza). All are home cards and menu links. Menu links move to a second row below 1500px wide.
- **Lesson flow:** Learn (picture cards, Play / Slow) → Repeat (learner records and compares, with "Skip to the quiz") → Quiz. The quiz picks 15 random examples each time. From Level 3 it adds sentence building (tap word tiles in order) for examples of 3–8 words. Examples with 2+ sentences (Levels 7–10) get "Put the sentences in order" plus meaning/say questions instead, and no picture questions. Texts over 60 characters get a smaller font.
- **Look:** name "Kifak" in cedar green with a red question mark ("Kifak?"), and a drawn Lebanese flag as logo and tab icon. Top bar like a landing page: white with a thin shadow, logo left, links in the middle (Lessons, Conversations, Verbs, Reading Latin-script Arabic, Recording studio; red underline on the current section), Abc/عربي/EN buttons right, shown only on lesson, conversation and verb pages (hidden elsewhere with `body.no-toggles`). On phones the links sit on a second row that scrolls sideways. Home page opens with a big centred green headline (Poppins font) and big choice cards (the owner removed the "Start Level 1" button): Lessons, Conversations and Verbs. Colours: cedar green (`#0b6b3a`) for headlines, buttons and links, red (`#d8121c`) only for small touches. Green = correct, red = wrong. Dark mode is supported.
- **Wide layout (Nov 2026):** pages use up to 1240px; lists (levels, lessons, examples, verb tables, studio clips, home cards) are grids that fill the width. One-thing-at-a-time pages (lesson steps, quiz, conversation, flashcards) stay 820px wide and centred. On phones everything is one column.
- **Pictures:** emoji for now. Real illustrations may come later.
- **Audio:** real recordings by the owner, never text-to-speech.

## Status

- All 200 lessons are written. **Everything is a DRAFT** written by Claude and needs native review. Expect spelling and phrasing fixes, especially in Levels 9–10 and in sensitive lessons (condolences, news, "Words to avoid").
- **Expanding to 30 examples per lesson, level by level.** Done: Level 1 (all 20 lessons at 30). To do: Levels 2–10. **Levels 7–8 were rewritten (Nov 2026) as two or three linked sentences per example (10 per lesson, still to grow to 30). Levels 9–10 are now 6 paragraphs of 4–6 sentences per lesson (a paragraph holds about five sentences, so 6 is roughly 30 sentences).** Levels 3–6 still have the old short phrases and need reshaping next. Levels 3–10 also need their examples reshaped to fit the ladder (phrases, then sentences, then paragraphs); Levels 3–6 titles and goals still describe the old plan; 7–10 are updated.
- **No audio recorded yet.** Run `python3 tools/check_content.py` for the current clip count. Suggested order: Levels 1–3 first.

## Files

- `content/lessons.json`: all content. `levels[] → lessons[] → items[]` (`id, arabizi, arabic, english, pic, note?, f?`), `dialogue[]` (`id, speaker, arabizi, arabic, english`), `questions[]` (`q, options, answer` index). `speakers` maps each name to `m`/`f` (sets the chat-bubble side). Lesson ids: `l1`–`l7` for the first seven, otherwise `lv<level>-<nn>`. Clip ids are `<lessonId>-<nn>` for phrases and `<lessonId>-d<n>` for dialogue.
- `audio/`: published recordings named `<clipId>.mp3|m4a|webm|ogg`. A female form uses `<clipId>-f`. The app looks for a file here first, then for a recording saved in the browser (IndexedDB).
- `js/app.js` (router and all views), `js/audio.js` (playback, mic, audio lookup), `js/store.js` (settings, progress, IndexedDB). The storage keys keep the old `ahla` prefix on purpose, so existing progress and recordings survive.
- `css/style.css`: colour tokens at the top. The top bar and home headline styles are at the end.
- `tools/bump.sh`: **run after any change to js/, css/ or content/.** It raises the version in `version.json`, every `?v=` tag and `VERSION` in app.js. Phones reload automatically when the version goes up. Without it, phones show stale cached files (this happened once: stuck on "Loading…").
- `tools/replace_items.py <file.txt>`: same format, but **replaces** all of a lesson's examples (ids restart at -01). Only for lessons with no recordings; it refuses if `audio/` has one. Source files of rewritten levels are in `tools/new/`.
- `tools/add_items.py <file.txt>`: appends examples to lessons from a plain text file (`@ lessonId`, then `arabizi | arabic | english | pic | note | f arabizi | f arabic`). New ids continue after the last one, so existing clip ids never change. Duplicates are skipped.
- `content/verbs.json`: verb tables, **built** from `tools/verbs_src.txt` by `python3 tools/build_verbs.py` (edit the source, never the JSON). Each verb gives 8 past, 8 present and 3 command forms; "right now" and "future" are generated. Clip ids: `verb-<id>-<tense>-<person>` (e.g. `verb-katab-past-ana`, `verb-katab-command-ente`). A verb can override one generated future form with a `future-<person>: latin = arabic` line.
- `content/grammar.json`: Grammar and Culture pages, **built** from `tools/grammar_src.txt` by `python3 tools/build_grammar.py` (edit the source; format at its top). Groups: start, basics, sentences, verbs (Grammar page) and culture (Culture page). Example clip ids `gr-<topic>-<nn>`, numbered in order inside a topic, so add new examples at the end of a topic. The studio lists them as a "Grammar and culture" group after the reading clips.
- `tools/check_content.py`: run before publishing content edits. It also checks verbs.json and grammar.json. It catches non-Latin characters in Arabizi (Cyrillic look-alikes, ç, ü, %), duplicate ids and unknown speakers.

## Recording workflow

The owner records in **Recording studio** (`#/studio`, link in the footer): one lesson at a time, with a lesson picker and next/previous buttons. The first entry in the picker is **Reading Latin-script Arabic**: 12 clips, the sound on its own (`abc-<key>`, e.g. `abc-3`) and an example word (`abc-<key>-ex`). Those rows live in `ABC` in app.js, not in lessons.json. The last group in the picker is **Verbs**: one entry per verb, 35 clips each. Recordings are saved in that browser and the lessons use them right away. **Download all** gives `kifak-audio.zip`. When the owner sends the zip, unzip it into `audio/`, commit and push, and the voice goes live for everyone. Remind them to download after each session, because browser storage can be lost.

## Working on it

- Run locally: `python3 -m http.server 8080`, then open http://localhost:8080. It must be served, not opened as a file.
- Test in a browser with Playwright (Chromium is preinstalled). Play through lessons to the end of the quiz and check for page errors. Screenshot at phone size.
- After changes: `tools/bump.sh`, `python3 tools/check_content.py`, commit, `git push`. GitHub Pages redeploys in about a minute.
- **Go live directly (owner's standing instruction, Nov 2026):** when the owner asks for a change, make it, test it, then push it to `main` straight away so it's live. Don't ask "should I put it live?" first. Push to the session's working branch too. Big work the owner didn't ask for in that message (for example writing a whole new level) still gets shown to them before it goes live.
- Cloud sessions here can push to the repo but **can't change GitHub settings** (Pages, renaming). The owner does those by hand.
- Corrections from the owner arrive in plain words ("Level 4, At the pharmacy: we say X"). Find the phrase in `lessons.json`, fix the arabizi, arabic and english consistently (and the matching dialogue lines), then bump and push.

## Writing style for replies

The owner's account has style preferences: plain words, contractions, mixed sentence lengths, no em dashes, no filler openings or closing summaries.
