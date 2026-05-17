# Repository Guidelines

## Project Structure & Module Organization
This repository is a small static web app with no build step. Keep changes localized and simple:

- `index.html` contains the page structure and loads fonts, styles, and the script.
- `styles.css` holds all visual styling, including theme variables and responsive layout rules.
- `app.js` contains application logic, DOM event handlers, CSV import, JSON export, and `localStorage` persistence.

There is no `src/`, `tests/`, or asset pipeline yet. If you add files, prefer a flat structure unless a new feature clearly justifies subdirectories such as `assets/` or `tests/`.

## Build, Test, and Development Commands
There is no package manager or build system configured. Use lightweight local workflows:

- `python3 -m http.server 8000` runs the app locally at `http://localhost:8000`.
- `open index.html` opens the app directly in a browser for quick UI checks on macOS.
- `git status` reviews working tree changes before committing.

## Coding Style & Naming Conventions
Match the current codebase style:

- Use 2-space indentation in HTML, CSS, and JavaScript.
- Keep JavaScript in plain ES modules-free browser syntax with `const`/`let`, semicolons, and small helper functions.
- Use descriptive camelCase for variables and functions such as `todayKey`, `formatDate`, and `parseCSV`.
- Keep CSS class names short and semantic, e.g. `.entry`, `.day-group`, `.seg-btn`.
- Preserve the existing section-comment style in `app.js` for larger logic blocks.

## Testing Guidelines
Automated tests are not set up yet. Validate changes manually in the browser:

- Add, edit, and delete entries.
- Confirm `localStorage` data survives reloads.
- Verify JSON export and CSV import flows.
- Check both light and dark color schemes and a narrow mobile viewport.

If you introduce nontrivial logic, add a `tests/` directory and document how to run it in this file.

## Commit & Pull Request Guidelines
Git history is currently minimal (`Init`), so use concise imperative commit subjects going forward, for example `Add CSV import validation` or `Refine mobile spacing`.

Pull requests should include a short summary, manual test notes, and screenshots for visible UI changes. Link the relevant issue when one exists, and keep each PR focused on a single change set.
