# Kifak: Learn Lebanese

A small website for adult beginners learning spoken Lebanese Arabic.

Live at https://dgheish.github.io/falafel/

## What's inside

10 levels x 20 lessons = 200 lessons: 1,982 phrases (176 with a separate form for talking to a woman), 1,282 conversation lines and 398 listening questions. That's 3,440 recordings in total. All text is a draft for native-speaker review.

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

## Publishing a change

After changing anything in `js/`, `css/` or `content/`, run `tools/bump.sh`. It raises the version number everywhere, and visitors' phones then reload the new version automatically.
