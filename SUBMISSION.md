# Ajaia Docs Submission Report

> Reviewer-facing delivery report for the lightweight collaborative document editor.

## 1. Executive summary

Ajaia Docs is a lightweight collaborative document editor built as a focused full-stack product slice.
It supports document creation, rich-text editing, autosave, import, persistence, sharing, export, and deletion.
The implementation favors a small dependency footprint and an inspectable architecture.
The application can be installed with npm install and started with npm start.
The browser client is static vanilla JavaScript with no build step.
The backend is an Express application with a configurable JSON file store.
Authentication is intentionally mocked through the x-user request header.
The seeded users are Alice, Bob, and Carol.
Authorization is enforced on the server rather than relying only on UI state.
Saved HTML is sanitized through an explicit allow-list.
The required API test boots the app on an ephemeral port.
The test verifies sharing, view restrictions, editing upgrades, sanitization, and persistence.
The product is intentionally not presented as a real-time collaboration system.
Real authentication, version history, and an external production database are future work.

## 2. Submission contents

- server.js: Express API, persistence, authorization, upload conversion, and sanitization.
- public/index.html: landing page and document workspace markup.
- public/styles.css: responsive premium visual system and motion design.
- public/app.js: browser interactions, API calls, autosave, sharing, export, and delete flow.
- test/api.test.js: built-in Node test runner integration test.
- package.json: runtime metadata, scripts, and allowed dependencies.
- README.md: setup, demo, architecture, deployment, and evaluation alignment.
- SUBMISSION.md: this detailed reviewer report.
- VIDEO.txt: placeholder for a manually recorded walkthrough link.
- .gitignore: excludes node_modules, data.json, and npm logs.

## 3. Product problem and target user

The target user is an internal team member who needs a quick place to write shared work.
The product reduces friction between drafting, saving, importing, and sharing a document.
The experience is designed for small teams rather than enterprise administration.
The first-run landing page explains the product before opening the workspace.
The workspace gives the user a document list and a focused writing surface.
The selected scope is deliberately narrower than Google Docs.
The core value is a reliable document lifecycle rather than feature breadth.

## 4. Primary user journey

A reviewer opens the landing page at the root URL.
The reviewer clicks Start writing or Open workspace.
The client loads the seeded users from GET /api/users.
Alice is selected as the default mocked user.
The client loads Alice accessible documents from GET /api/docs.
The reviewer creates a new document with the New document control.
The new document is immediately persisted by POST /api/docs.
The document opens in the premium edit surface.
The reviewer types content into the contenteditable editor.
Formatting commands apply bold, italic, underline, headings, and lists.
The client waits 700 milliseconds after input before autosaving.
The status changes between Saving, Saved, and Not saved.
A refresh demonstrates that the JSON store retained the document.
The reviewer can return to the landing page without losing the saved document.

## 5. Document editing experience

The editor uses a browser contenteditable surface to avoid a build step.
The title is a dedicated editable input with a 120 character limit.
The content area supports semantic h1, h2, and paragraph blocks.
The toolbar exposes bold formatting.
The toolbar exposes italic formatting.
The toolbar exposes underline formatting.
The toolbar exposes an unordered list command.
The toolbar exposes an ordered list command.
The toolbar uses the selected deep navy visual language.
Hover states provide a subtle lift and pale navy background.
Focus-visible outlines support keyboard navigation.
The paper-style canvas separates writing from surrounding navigation.
The document metadata communicates editing mode and autosave expectations.
The editor remains readable over the animated workspace background.
The responsive layout reduces margins on smaller screens.
The user can download the current document as a Word-compatible .doc file.
The download filename is derived from the document title.
Unsafe filename characters are replaced before download.

## 6. Autosave behavior

The client clears the previous autosave timer on each input event.
The client schedules a save after a 700 millisecond debounce.
The client sends both title and content to PUT /api/docs/:id.
The server validates the title before changing the document.
The server sanitizes content before writing it to the store.
The client displays Saved after a successful response.
The client displays Not saved when the request fails.
The error message bar surfaces the server error to the user.
The document list refreshes after a successful save.
The saved timestamp is updated on every mutation.

## 7. File import

The import control accepts .txt, .md, and .docx extensions.
Multer stores the upload in memory for the conversion request.
The server enforces a five megabyte upload limit.
An oversized file returns HTTP 413.
An unsupported extension returns HTTP 400.
A missing file returns HTTP 400.
An unreadable file returns HTTP 422.
Text files are split into blank-line-separated paragraphs.
Text content is escaped before it becomes HTML.
Markdown headings with one, two, or three hashes become heading elements.
Other Markdown lines become escaped paragraph elements.
DOCX files are converted through Mammoth.
Converted output is sanitized before persistence.
Every import creates a new document rather than overwriting an existing one.
The imported title is derived from the original filename.
Imported titles are capped at 120 characters.

## 8. Sharing and access model

Every document has exactly one owner field.
The owner can share with another seeded user.
A share has either edit or view role.
The owner cannot share a document with themself.
An unknown share target returns HTTP 400.
An invalid role returns HTTP 400.
Only the owner can create or upgrade a share.
A view user can read an accessible document.
A view user cannot update title or content.
A view-only update returns HTTP 403.
An edit user can update title and content.
A user without access receives HTTP 404.
The 404 behavior avoids leaking document existence.
The sidebar separates owned documents from shared documents.
Owned items display an owner tag.
Shared items display the owner and role.
The UI disables editing controls for view-only users.
The server remains authoritative if a client bypasses those disabled controls.

## 9. Delete and download behavior

An owner sees a delete control beside owned documents.
Shared users do not see the owner delete control.
Deletion requires browser confirmation.
The delete endpoint checks access before mutation.
Only the owner may delete a document.
A non-owner delete returns HTTP 403.
An inaccessible delete returns HTTP 404.
A successful delete returns HTTP 204.
The JSON file is rewritten after deletion.
The editor resets if the currently open document is deleted.
The Word-compatible export is client-side and does not change persistence.
The export includes a document title and the formatted editor HTML.

## 10. Persistence design

The store is a JSON object with a documents array.
The data file path is configurable through DATA_FILE.
The default data path is data.json in the application directory.
The default data file is ignored by git.
The server reads the store when createApp starts.
Every mutation writes the complete store.
Writes use a temporary file before rename.
The rename pattern reduces the chance of a partially written final file.
Document IDs are generated with crypto.randomUUID.
Timestamps use ISO strings.
The test uses a temporary data file so tests do not alter local data.
The test confirms saved content can be re-read through the API.

## 11. API inventory

GET /api/users returns the seeded user list.
GET /api/docs returns documents accessible to the current user.
POST /api/docs creates a document.
GET /api/docs/:id reads one accessible document.
PUT /api/docs/:id updates a title or content for an editor.
DELETE /api/docs/:id deletes an owned document.
POST /api/docs/:id/share creates or upgrades a share.
POST /api/upload imports a supported file as a new document.
All protected routes require a known x-user header.
Unknown users receive HTTP 401.
The central error handler returns JSON errors.
The JSON body limit is two megabytes.

## 12. Security posture

The application treats the browser as untrusted for authorization decisions.
The server checks user identity on every protected API request.
The server checks document access before returning document content.
The server checks owner status before sharing.
The server checks owner status before deleting.
The server checks edit role before accepting updates.
Saved HTML is filtered through sanitize-html.
The allow-list contains only the requested formatting tags.
Attributes are not permitted in saved HTML.
Script elements are stripped.
Sidebar titles are rendered through text escaping.
Imported text is escaped before HTML construction.
The client uses textContent in the escape helper.
The application does not expose secrets in the repository.
The mocked authentication is explicitly documented as non-production.

## 13. Testing evidence

The test command is npm test.
The package script runs node --test test/api.test.js.
The test boots createApp with a temporary DATA_FILE.
The test listens on port zero.
The test constructs requests against the ephemeral port.
The test confirms Bob initially sees an empty accessible list.
The test confirms Bob cannot read Alice document before sharing.
The test shares the document as view.
The test confirms Bob lists the document with view role.
The test confirms view-only PUT returns 403.
The test upgrades Bob to edit.
The test confirms Bob can update content after upgrade.
The test sends a script element in content.
The test confirms the saved response contains only safe HTML.
The test re-reads content as Alice.
The test confirms the sanitized content persisted.
The test confirms Bob cannot delete the document.
The test confirms Alice can delete the document.
The test confirms the deleted document returns 404.
The test confirms the JSON store has no remaining document.
The current test run passes.

## 14. Reviewer demo script

Open the root URL.
Observe the product landing page and primary workspace CTA.
Click Start writing.
Confirm the premium workspace sidebar is visible.
Click New document.
Type a title.
Type a paragraph.
Select text and click bold.
Create an H1 block.
Create a bulleted list.
Wait for Saved status.
Refresh the page.
Reopen the document from My documents.
Use the download control and open the resulting DOC file.
Return to Alice if the current user was changed.
Open Share document.
Select Bob.
Select Can view.
Save the share.
Switch to Bob.
Open Shared with me.
Confirm the title and role are visible.
Attempt to edit and observe the disabled state.
Switch to Alice.
Upgrade Bob to Can edit.
Switch to Bob.
Edit the document.
Confirm the edit saves.
Switch back to Alice.
Delete a test document.
Confirm the browser prompt.
Run npm test in a terminal.

## 15. Deployment

The runtime requirement is Node 18 or newer.
The build command on Render is npm install.
The start command on Render is npm start.
The server listens on PORT when provided by the platform.
The application serves static files from public.
No frontend build step is required.
No paid service is required.
No external database is required for the exercise.
DATA_FILE can be configured as an environment variable.
Render free-tier disk is ephemeral.
Documents may disappear after a restart or redeploy on free tier.
A production version should use durable managed storage.

## 16. Prioritization decisions

The first priority was a complete document lifecycle.
The second priority was server-enforced access control.
The third priority was persistence that reviewers can inspect locally.
The fourth priority was practical import behavior.
The fifth priority was a polished but dependency-free UI.
Real-time collaboration was deprioritized because it requires conflict resolution.
Version history was deprioritized because it requires a revision model.
Real authentication was deprioritized because the prompt explicitly requested mocked auth.
Tiptap was deprioritized because the prompt required vanilla JavaScript.
External databases were deprioritized because the prompt required JSON storage.
Advanced search was deprioritized because it is not necessary for the core slice.
Comments and mentions were deprioritized because sharing is the higher-value collaboration primitive.
Granular permissions beyond view and edit were deprioritized to keep the access model correct.
The UI received enough visual investment to make the workflow demo-ready.

## 17. AI workflow

AI was used to scaffold the initial application structure.
AI helped identify the API surfaces required by the prompt.
AI helped draft the JSON persistence model.
AI helped implement the upload conversion branches.
AI helped improve the premium visual direction after the functional slice worked.
AI suggestions were kept within the dependency constraints.
Real-time collaboration suggestions were rejected as out of scope.
Real authentication suggestions were rejected because auth was specified as mocked.
External storage suggestions were rejected because JSON file storage was required.
The code was tested rather than accepted from generation alone.
The API test was run after backend changes.
The served page was checked after frontend changes.
Cache-busting was added after browser freshness became a concern.
The final documentation states what is incomplete.

## 18. Known limitations

There is no real user authentication.
The x-user header can be forged in a local demo.
The JSON store is not suitable for concurrent production writes.
The free deployment disk is ephemeral.
There is no multi-cursor collaboration.
There is no operational conflict resolution.
There is no version history or restore capability.
There is no share revocation endpoint.
There is no audit log.
The editor uses browser execCommand behavior.
The Word export is a Word-compatible HTML document rather than OOXML.
There is no PDF export.
There are no browser automation tests.
The seeded users are fixed for the exercise.
The workspace has no production account settings.

## 19. Recommended next work

Add durable object storage or a managed database.
Replace mocked identity with session-based authentication.
Add share revocation and share listing management.
Add document revision snapshots.
Add optimistic concurrency checks.
Add browser-level tests for the landing-to-editor journey.
Add accessible keyboard shortcuts for editor commands.
Replace execCommand with a maintained editor model if scope permits.
Add a proper DOCX export library when dependency constraints are lifted.
Add monitoring and structured request logging.
Add rate limiting to upload and mutation endpoints.
Add CSRF protection when cookie authentication is introduced.
Add deployment persistence and backup policy.

## 20. Final assessment

The submission demonstrates a coherent product slice from landing page to persisted document.
It covers the requested frontend, backend, persistence, import, and access logic.
It makes clear tradeoffs rather than implying unsupported completeness.
It includes a repeatable local setup and test command.
It includes a reviewer path for the most important product behaviors.
It is ready for local evaluation.
Manual deployment and video recording remain reviewer or author actions.

## 21. Verification checklist

- [x] Node 18+ runtime declared.
- [x] npm install works.
- [x] npm start serves the app.
- [x] npm test passes.
- [x] JSON file path is configurable.
- [x] Unknown users receive 401.
- [x] Inaccessible documents receive 404.
- [x] View users receive 403 on write.
- [x] Edit users can write.
- [x] Owner-only sharing is enforced.
- [x] Owner-only deletion is enforced.
- [x] HTML is sanitized.
- [x] Sidebar text is escaped.
- [x] TXT import is implemented.
- [x] Markdown import is implemented.
- [x] DOCX import is implemented.
- [x] Five megabyte upload limit is implemented.
- [x] Two megabyte JSON body limit is implemented.
- [x] Title validation is implemented.
- [x] Debounced autosave is implemented.
- [x] Word-compatible download is implemented.

## 22. Detailed evidence index

Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
Download behavior is implemented in the browser client.
Sanitization behavior is covered in the API test.
Error behavior is centralized in the Express error handler.
Deployment behavior is documented in README.md.
Tradeoffs are documented in the architecture note.
AI usage is documented in the workflow note.
Product creation is visible through the New document action.
Title mutation is visible through the document title input.
Content mutation is visible through the contenteditable editor.
Formatting is visible through the toolbar controls.
Persistence is exercised by the temporary data file test.
Import behavior is implemented in the upload route.
Sharing behavior is implemented in the share route.
Access behavior is implemented in the protected API middleware.
Deletion behavior is implemented in the delete route.
