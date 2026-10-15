# Kanban Lite — Interactive Task Board

A responsive, client-side Kanban board built with semantic HTML5, CSS3, and vanilla JavaScript (ES6+).

## Features

- Create and edit tasks with title, description, category, priority, and status
- Move tasks with a status selector or native HTML drag and drop
- Delete tasks with a confirmation prompt
- Persist tasks and theme preference in `localStorage`
- Search task titles and descriptions and filter by category
- Priority colour indicators, task counters, and completion progress
- Light/dark theme, keyboard-friendly controls, responsive layout
- Safe text rendering with `textContent` rather than interpolating task data into HTML

## Run locally

Open `index.html` in a modern browser. No build step or dependencies are required. Google Fonts are optional; the page has sans-serif fallbacks.

## Deploy to GitHub Pages

1. Create or fork a repository and add `index.html`, `styles.css`, and `script.js` to its root.
2. Push the files to GitHub.
3. In the repository, open **Settings → Pages**.
4. Choose **Deploy from a branch**, select your default branch and the `/ (root)` folder, then save.
5. Wait for GitHub Pages to publish and open the displayed URL.

## Notes

Tasks are stored only in the current browser's local storage; they do not sync between devices. Clearing browser site data removes saved tasks.
