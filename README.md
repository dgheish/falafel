# Ahla! Learn Lebanese

A small website for adult beginners learning spoken Lebanese Arabic.

## Run it locally

    python3 -m http.server 8080

Then open http://localhost:8080. (Opening index.html directly as a file won't work.)

## Where things live

- `content/lessons.json`: 10 levels, each with lessons (phrases, a dialogue, and optional listening `questions`). Edit this to add or fix content.
- Levels unlock in order. Teacher mode in the studio opens them all on one device.
- `audio/`: recordings, named `<id>.mp3` (or .m4a / .webm). The form used with a woman is `<id>-f`.
- `#/studio` page: record every phrase in the browser, then "Download all" and unzip into `audio/`.

## Lesson flow

Learn (cards) → Listen (dialogue) → Repeat (record yourself) → Quiz.
From Level 3 the quiz adds sentence building; lessons with `questions` add listening questions.

## Publishing a code change

When you change anything in `js/` or `css/`, raise the `?v=` number everywhere it appears (index.html, js/app.js, js/audio.js). Otherwise phones may mix old and new files.
