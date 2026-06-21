# Collaborative AI Artwork Prompt

Creator: Dimitrios Kanatas

Static presentation tool for the TECH-EDU 2026 / DSAI 2026 collaborative AI artwork activity.

## Run

Open `index.html` directly in a browser.

For projection, use browser fullscreen mode with `F11`, then use the in-page projection button when you want to hide the operator panel.

## Files

- `index.html` - static page entry point
- `assets/data/activity-config.js` - available prompt slots
- `assets/data/translations.en.js` - English interface and slot text
- `assets/data/translations.el.js` - Greek interface and slot text
- `assets/data/prompt-templates.js` - English and Greek prompt templates with `{{slot_id}}` placeholders
- `assets/css/styles.css` - layout and visual styling
- `assets/js/app.js` - prompt flow, typewriter effect and localStorage
- `assets/images/logo-env.png` - association logo
- `assets/images/stage-accent.bmp` - visual background accent

## Storage

Team words and drafts are saved locally in the browser with `localStorage`.

## Changing Team Count

The number of teams comes from the placeholders used in `assets/data/prompt-templates.js`.

For example, to run the activity with 8 teams, remove two `{{slot_id}}` placeholders from both the English and Greek prompt templates. Extra slot definitions and translations can remain in the data files; only placeholders used by the active prompt become live teams.

When adding a new slot:

1. Add its id to `assets/data/activity-config.js`.
2. Add its English and Greek title/mission to the translation files.
3. Use the same `{{slot_id}}` in both prompt templates.

## Security and deployment

For Apache deployments, the included `.htaccess` adds security headers,
disables directory listings and blocks hidden paths. Production deployments
should use HTTPS and should publish only the files tracked by this repository.

Team answers are stored only in the browser's `localStorage`. Do not use the
activity fields for secrets or sensitive personal information.

## License

The software source code is licensed under the MIT License. Names, logos,
conference materials and visual assets are excluded unless their respective
owner explicitly states otherwise. See `LICENSE` and `NOTICE.md`.
