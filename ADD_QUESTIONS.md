# Adding Questions Safely

The app now reads questions directly from:

- `data-theory.json`
- `data-coding.json`

Do not add question data inside `index.html`; it is only the page shell.

## Add from the App

1. Open the site from a local static server or any static host.
2. Go to the `Add Q&A` tab.
3. Pick a theory section and fill in the question, answer, optional code, note, tip, warning, and tags.
4. Click `Add Question` to preview it immediately in `Java Theory`.
5. Click `Export data-theory.json` when you want a permanent copy of the updated file.

Browser-added questions are saved in localStorage until you export or clear them.

## Theory Questions

1. Pick a category in `data-theory.json`.
2. Copy `templates/theory-question.json`.
3. Paste it into that category's `questions` array.
4. Give it a unique `id`, such as `q80`.
5. Reload the app and check that the new question appears.

To create a new theory category, copy `templates/theory-section.json` into the top-level array.

## Coding Problems

1. Pick a category in `data-coding.json`.
2. Copy `templates/coding-card.json`.
3. Paste it into that category's `cards` array.
4. Give it the next `num` for that category.
5. Reload the app and check that the new problem appears.

To create a new coding category, copy `templates/coding-section.json` into the top-level array.

## Preview

Because the page loads JSON files, preview it through any static file server or static hosting service. Opening `index.html` directly may block JSON loading in some browsers.
