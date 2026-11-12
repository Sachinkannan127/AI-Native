# Ajaia Docs

## Local setup

Requires Node 18+. Run `npm install`, then `npm start`, and open `http://localhost:3000`. Set `DATA_FILE` to change the JSON store path (for example `DATA_FILE=./data.json npm start`; on PowerShell use `$env:DATA_FILE="./data.json"; npm start`). Run the test with `npm test`.

Accounts: Users can dynamically create accounts directly from the UI or via `POST /api/users`.

## Features and demo

Create/rename documents, use the contenteditable rich-text toolbar, and rely on 700ms autosave. Dynamic onboarding prompts any user entering the application to create an account (name and email) or switch between existing accounts. Import `.txt`, `.md`, or `.docx` files up to 5 MB. To demo sharing: create an account, create a document, choose Share, share it with another registered user as `view`, switch user and observe the disabled editor, then switch back and upgrade to `edit`; the shared user can now save edits. Documents, users, and permissions survive refresh and restart.

The app uses Express, a JSON file store, mocked header authentication, server-side HTML sanitization, Multer uploads, and Mammoth DOCX conversion. Errors are returned as `{ "error": "..." }`.

## Reviewer walkthrough

1. Run `npm install`, `npm start`, and open `http://localhost:3000`.
2. Click **Start writing**, create an account with your Name and Email, create a document, try headings/lists, rename it, and reload the page to verify autosave and persistence.
3. Import a `.txt`, `.md`, or `.docx` file and confirm it becomes a new editable document.
4. Create a second account, share a document with it as `view`, switch user and verify the editor is disabled. Upgrade the user to `edit` and verify they can save.
5. Download the document as Word, delete an owned document, and run `npm test`.

## Evaluation alignment

| Evaluation area | Evidence in this submission |
|---|---|
| Product slice and prioritization | Focused document lifecycle: create, format, save, import, share, download, delete |
| Full-stack execution | Express API, static frontend, JSON persistence, centralized errors, server-side authorization |
| Editing quality | Contenteditable editor, headings, lists, inline formatting, autosave status, polished workspace |
| File and sharing behavior | TXT/Markdown/DOCX conversion, 5 MB limit, owner/view/edit roles, no existence leak |
| Infrastructure judgment | Node 18+, `npm install`, `npm start`, configurable `DATA_FILE`, Render instructions |
| Quality and maintainability | Small dependency set, reusable API helper, sanitization allow-list, built-in test runner |
| Communication and AI workflow | Architecture, tradeoffs, verification, and AI workflow are documented below |

The intentional tradeoff is breadth versus correctness: real-time collaboration, version history, real authentication, and a production database are not presented as complete features.

## Architecture note

The priority was a complete, inspectable end-to-end slice: one API module, durable JSON mutations, a small static UI, and permission checks enforced on the server. Real-time collaboration, version history, real authentication, and a Tiptap editor were deliberately deprioritized to fit the time and dependency constraints. With 2–4 more hours, the next work would be better keyboard/editor semantics, share management/revocation, import/export polish, and integration/browser tests.

## Render deployment

Create a free Web Service from this repository. Build command: `npm install`; start command: `npm start`; runtime: Node. The free-tier filesystem is ephemeral, so JSON data can disappear on redeploy/restart; this demo intentionally has no external database.

## AI workflow and verification

AI was used to scaffold the compact API/UI, identify the permission and sanitization boundaries, and draft the documentation. The implementation was kept dependency-minimal and rejected real-time/auth/database additions as out of scope. Correctness was verified with the Node built-in test runner: it boots on an ephemeral port with a temporary `DATA_FILE` and checks stranger 404, view sharing, 403 editing, edit upgrade, script stripping, and persisted re-read.
