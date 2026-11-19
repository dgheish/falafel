# Ahla! Learn Lebanese

A small website for adult beginners learning spoken Lebanese Arabic.

## Run it locally

    python3 -m http.server 8080

Then open http://localhost:8080. (Opening index.html directly as a file won't work.)

## Where things live

- `content/lessons.json`: every lesson, phrase and dialogue. Edit this to add or fix content.
- `audio/`: recordings, named `<id>.mp3` (or .m4a / .webm). The form used with a woman is `<id>-f`.
- `#/studio` page: record every phrase in the browser, then "Download all" and unzip into `audio/`.

## Lesson flow

Learn (cards) → Listen (dialogue) → Repeat (record yourself) → Quiz.
