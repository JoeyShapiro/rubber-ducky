# rubber-ducky — reference notes

Background for anyone (human or agent) working on this codebase. Read this before picking up a
task from [PLAN.md](PLAN.md), so you do not re-litigate a settled choice or rediscover a trap.

Nothing here is a task. Open work lives in [PLAN.md](PLAN.md).

---

## Architecture

SvelteKit 2 / Svelte 4, Postgres via Drizzle, Bootstrap 5 from CDN, optional Ollama for
embeddings and Q&A. Deployed as a single Node container on port 80.

The application is still **one route**. [`Sidebar.svelte`](../src/routes/Sidebar.svelte) selects
a duck and writes it into a `writable` store ([`$lib/stores.ts`](../src/lib/stores.ts)); each
panel component loads its own data when that duck changes. T-11 turns this into real routes.

### Data model

```
badlings (groups)
  └── ducks (channels)
        ├── messages ──── attachments
        ├── notes      (many per duck; title + content, no completion state)
        └── quests     (self-referencing parent, duckId NOT NULL)
answers (AI responses — no FK to anything, merged into message lists by timestamp)
```

**The single most consequential constraint:** every child table has `duckId` as `NOT NULL`
([`schema.ts:66`](../src/lib/db/schema.ts#L66), [`schema.ts:79`](../src/lib/db/schema.ts#L79)).
Nothing can exist outside a channel. This is the root cause of the "no global todo list"
problem and a large part of why notes and tasks feel bolted on. T-08 is the fix.

### Frontend layout

```
src/lib/
  stores.ts              duck, hidden, darkMode, messages
  api.ts                 every fetch to our own endpoints, plus one shared 401 handler
  markdown.ts            renderMarkdown + enhanceMarkdown - the one markdown path
  attachments.ts         reading the three attachment encodings; shared by both endpoints
  format.ts              formatDate
  quests.ts              status list, labels, css classes, svg icons
  types.ts               Attachment / Message / Note / Quest / Duck / Badling
  components/
    Chat.svelte          left column: message list + composer, owns loading and scroll
    Message.svelte       one message, system or normal, with its attachments
    Composer.svelte      textarea, attachments, paste, submit, the qna toggle
    Notes.svelte         the notes pane: titled items, opened in place
    Quests.svelte        breadcrumbs + quest list
    QuestModal.svelte    create-quest dialog
    ConfirmDialog.svelte reusable destructive-action confirm
src/routes/
  +page.svelte           layout only - two columns, passes $duck down
```

Rules of thumb for anyone adding to this:

- **Components own their own data loading**, keyed on the `duck` prop. That is deliberate — it
  is what makes T-11 (route split) cheap, since each component already stands alone.
- **No component calls `fetch` directly.** Add a function to `api.ts` instead, so 401 handling
  and error shape stay in one place.
- **Cross-panel state goes in `stores.ts`.** Today that is only `messages`, which both the
  composer and the quest list append to.

---

## Attachment encodings

Three shapes exist in the `attachments` table. New rows are always canonical — `POST
/attachments` rejects anything else — so the legacy branches only ever see pre-existing data.

| Origin | `type` | `content` | Readable? |
|---|---|---|---|
| Canonical (current) | `image/png` | `data:image/png;base64,...` | yes |
| Old paste path | `data:image/png` | `base64,...` | yes |
| Old file picker | `data:image/png;base64,...` | `image/png` | yes — **the columns are swapped** |

The old file-picker rows are *not* lost. Swapped constructor arguments put the full data URL
into `type` and the bare MIME type into `content`, so the payload was written, just to the wrong
column. [`$lib/attachments.ts`](../src/lib/attachments.ts) detects and reads all three; T-22
would normalise them away.

Two traps worth knowing if you touch that file:

- **Never select `type` or `content` whole just to learn a MIME type.** The base64 payload lives
  in `content` normally and in `type` for swapped rows, so either can be megabytes.
  `GET /messages` reads `left(col, 64)` for exactly this reason.
- A bare MIME string can be **valid base64**. `text/css` is 8 characters, a multiple of 4, all
  valid base64 characters — it would decode to 6 bytes of garbage and be served as a file. The
  `BARE_MIME` guard runs first to catch that whole class.

---

## Decisions log

Choices already made, so later work does not re-open them.

| Date | Area | Decision |
|------|------|----------|
| 2026-08-31 | attachments | Canonical shape: `type` = bare MIME (`image/png`), `content` = full data URL, `name` never empty. Files with no MIME become `application/octet-stream`; nameless clipboard files get `pasted-<ts>.<ext>`. |
| 2026-08-31 | attachments | `Attachment.fromFile` is the only sanctioned way to build an attachment from a file. New entry points must use it rather than reading a `File` themselves. |
| 2026-08-31 | attachments | Read all three legacy encodings rather than migrating the data. Reading is reversible; a migration (T-22) can follow once the endpoints are known good. |
| 2026-08-31 | attachments | `POST /attachments` validates the canonical shape and 400s otherwise. The invariant is enforced at the write boundary. |
| 2026-08-31 | frontend | Components own their data loading (keyed on the `duck` prop) rather than a parent orchestrating fetches. Makes each one liftable into its own route in T-11 with no rewiring. |
| 2026-08-31 | frontend | `messages` is a store; notes and quests are component-local. Only messages is written by more than one panel (composer + quest status changes), so only it needs to be shared. |
| 2026-08-31 | frontend | All endpoint calls go through `api.ts`. Ad-hoc `fetch` in a component is the thing that let six copies of broken 401 handling drift apart. |
| 2026-08-31 | frontend | Did **not** split routes during the component extraction. That is T-11, blocked by T-08, since the task-scope schema decides what routes need to exist. |
| 2026-09-05 | attachments | `GET /messages` returns attachment metadata only, never bytes. Keeps a page of messages small and lets the browser cache bytes per uuid. |
| 2026-09-05 | attachments | Encoding knowledge lives in `$lib/attachments.ts`, not in a route. Two endpoints need it; T-22's migration will too. |
| 2026-09-05 | ui | The remove button on a staged attachment is always visible, not revealed on hover. Hover-only controls are exactly what makes the current UI unusable on touch (T-12). |
| 2026-09-05 | messages | A message may have empty text if it carries attachments. `POST /messages` skips embedding when there is no text, rather than embedding an empty string. |
| 2026-09-06 | notes | A note is something currently *true*, not something done. Lifecycle is true → stale, with no completion state; deleting is the normal end of life. |
| 2026-09-09 | notes | Deleting a note is confirmed, despite being the normal end of life. Notes are near-permanent by design with no undo and no history, so "one action, not buried" means reachable — not unguarded. |
| 2026-09-09 | notes | Notes render as a read-only markdown document by default; Edit switches to the raw editor. Read-first suits read-many/write-few, keeps the rendered view clean, and makes each edit a discrete event. Chosen over live preview. |
| 2026-09-10 | logging | `postSystemMessage` is the only thing that writes a system entry, and it returns the message so the client can append it without refetching. A failed log never fails the action that caused it. |
| 2026-09-10 | logging | Creating an empty note logs nothing; its first save logs `added`. Otherwise the log announces an Untitled note before anything is typed. |
| 2026-09-11 | markdown | One renderer for everything. System log entries are the exception: generated, so rendered as plain text with no `{@html}`. |
| 2026-09-11 | markdown | hljs token colours live in `app.css`, not an imported hljs theme — those are built for a single background and this app has two. |
| 2026-09-10 | markdown | `renderMarkdown()` = marked + DOMPurify, parsing the **source string**. Never regex over rendered html. DOMPurify is not optional: marked passes `<script>` through untouched by design. |
| 2026-09-09 | ui | Destructive confirms use `ConfirmDialog.svelte`: Cancel holds focus, Escape and backdrop cancel, and Cancel sits where the triggering button was so a double click lands on the safe option. Reuse it for quest delete in T-10. |
| 2026-09-06 | notes | Notes are shaped like quests — name plus content, listed as items — with a visually distinct style. **If a note is a text box, something has gone wrong.** |
| 2026-09-06 | notes | The title is a lookup key, not a headline. Optimise for "find the one called *start command*", not for reading top to bottom. |
| 2026-09-06 | notes | Notes are the residue of work, distilled at the end. Continuous capture is what the message log is for; "tried X, didn't work" is a message, not a note. |
| 2026-09-06 | notes | Note create / delete / save each post a system message to the duck log. This is why notes keep a deliberate save rather than quiet autosave — short autosave would spam the log. |
| 2026-09-06 | links | **No message pinning**, ever. A pin list becomes a second, worse message history and is redundant once search exists. |
| 2026-09-06 | links | Backtracing, note↔quest, and message citation are one primitive: a `references` row with kind+id on each end and an optional label. Not four features. |
| 2026-09-06 | links | A reference always has a source — no free-floating saved links, which would be pinning with extra steps. |
| 2026-09-06 | links | Code and schema say `reference` / `backlinks`; `backtrace` already means a stack trace elsewhere. UI wording is free. |
| 2026-09-06 | model | Notes and quests stay separate tables despite the similar shape. Different lifecycles, fields, and UI; merging produces something where neither is fast. They share the scope model and the reference table. |

---

## Completed

What has been finished and what actually changed. Kept because the *why* is often not obvious
from the diff.

### 2026-09-11 — T-17: one markdown renderer

Messages and quest descriptions moved onto `renderMarkdown()`; the legacy regex-over-innerHTML
action and `replaceAsync` are deleted. Nothing imports them any more.

**highlight.js was never working in messages.** The old renderer passed the ``` fences *into*
`hljs.highlight()`, so output contained the backticks verbatim and had zero highlight spans, and
`sh` was not in the hand-written language list anyway so it threw first.

The hand-written 19-case language `switch` is gone, replaced by `highlight.js/lib/common` — 36
languages, aliases resolved (`sh`, `js`, `py`, `zsh` all work), and unknown languages are left
plain rather than guessed at. The comment that started it (*"i cant get dynamic imports to
work"*) is moot: the common bundle is a static import.

Its stylesheet import is gone too. hljs ships themes built for one background and this app has
two, so the token colours live in `app.css` with light and dark variants.

Shared display styles are now a single `.markdown` class in `app.css`, used by messages, notes
and quest descriptions — previously that CSS existed only inside `Notes.svelte`.

**System entries no longer render as markdown.** They are generated, not written, so they render
as plain text with no `{@html}` at all. `logLine` emits real `“ ” →` characters instead of HTML
entities, and the rows already in the database were migrated to match.

Preserved from the old renderer, verified: `||spoilers||` (a marked extension), bare-URL
autolinking (gfm), and escaping — `\*\*stars\*\*` stays literal, which the old one could not do.

### 2026-09-10 — T-27: quest and note activity reaches the log

Every change to a quest or a note now writes a system entry into its duck's log. Quest *status*
changes were the only thing ever logged before, and since the working duck had no quests, none
had ever appeared — creation, and everything about notes, was never wired at all.

`postSystemMessage(content, duckId?)` in [`system.ts`](../src/lib/system.ts) is the one writer;
it returns the message so endpoints hand it straight back and the client appends it without a
refetch. `logLine(kind, title, verb)` gives every entry one shape, which matters because
`Message.svelte` colours entries off the trailing verb.

| Action | Logged as |
|---|---|
| quest created / status changed | `created`, or the new status |
| note first save | `added` |
| note later save | `modified` |
| note deleted | `removed` |

**`POST /notes` logs nothing.** It creates an empty shell that the UI fills in place, so logging
there would announce an Untitled note before anything was typed. `PATCH` checks whether the row
was blank beforehand and calls that first save `added` instead of `modified`.

A note's log entries **outlive the note** — `DELETE` reads the row for its title before removing
it, and the entries are never cascaded away. The log is the history.

### 2026-09-09 — notes render markdown

Notes open in a **read** mode showing rendered markdown; an Edit button swaps to the raw title +
textarea, and Done (or Escape, or leaving) commits and returns to reading. A brand new note opens
straight into edit mode, since there is nothing to read yet.

`renderMarkdown()` in [`markdown.ts`](../src/lib/markdown.ts) is marked + DOMPurify over the
source string — added rather than reusing the legacy action, which mangles `<stdio.h>` and is an
XSS hole. `enhanceMarkdown` is a companion action that highlights fenced code and gives every
block an always-visible copy button. The language switch gained bash/sh/shell, sql, json and
yaml, since note content is mostly shell.

**Messages still use the legacy renderer** — that is the remainder of T-17, and two renderers is
drift that should not sit for long.

### 2026-09-09 — T-07: notes are real

Notes went from one blob per duck to many titled items, in the database. `notes` gained `title`,
`created_on` and `updated_on` (migration `0001_lonely_the_hand.sql`); the endpoint gained
GET list / POST create / PATCH / DELETE, and [`Notes.svelte`](../src/lib/components/Notes.svelte)
is a list of titled rows that opens one in place, with breadcrumbs matching the quest panel.

**Closing a note is the save.** No save button and no per-keystroke autosave: Cmd/Ctrl-S commits
without closing, Escape closes, a 15s idle timer catches an abandoned edit, and the component
commits on unmount and on duck change. `commit()` captures the note, duck and drafts
synchronously so an in-flight save stays correct if you switch ducks. `updated_on` therefore
only moves on a real edit, which is what makes one honest log entry per edit possible (T-27).

Deleting asks first, via the reusable `ConfirmDialog` — notes are near-permanent and nothing
behind them keeps history.

Deliberately not built: no content preview on rows (the title is a lookup key, and a preview is
the first step back toward a document), no per-row delete (delete lives in the open note, so
there is no hover-only control on a list item), and no filter box — a command palette is wanted
instead. Rows are sorted most-recently-touched first, which may want to be alphabetical once
there are enough notes to make lookup the dominant use.

Scope is duck-only for now; T-28 widens it once T-08 lands. **No data was migrated** — the notes
table was empty.

### 2026-09-05 — T-04, T-06: attachments render like a chat app

Images serve `Content-Disposition: inline` (everything else still downloads) plus
`Cache-Control: immutable`, since the bytes behind a uuid never change. `contentDisposition()`
emits both the ascii `filename=` and the rfc 5987 `filename*=` when a name needs it. Markup
points straight at `/attachments?uuid=`; the `hydrateImages()` blob hack and the `id={uuid}`
hook it depended on are gone.

The composer gained a preview tray: image thumbnails, a generic card for other files, name and
size, and an always-visible remove button. Drag-and-drop with a drop overlay; the file picker
gained `multiple`. A message can now be sent with attachments and no text.

Still missing: per-file upload progress and failure surfacing (T-23).

### 2026-09-05 — T-03: attachments survive a reload

`GET /messages` never queried the attachments table, so `Message.attachments` was always `[]`
and images vanished on reload though the rows were fine. Now one `inArray` query per page, via
`attachTo()`, selecting only the head of `type` and `content` (see *Attachment encodings*).
A duck with two images returns 824 bytes of JSON.

### 2026-08-31 — frontend split

`+page.svelte` went from ~1360 lines to 26 (layout only), decomposed into the components and
`$lib` modules listed above. `src/routes/stores.js` moved to `$lib/stores.ts`.

Behaviour-preserving except for three deliberate removals: the dead infinite-scroll code
(unreachable *and* inverted — became T-16), a duplicate `id="date"` on every message timestamp,
and the `duck.subscribe()` leak plus `document.onpaste` clobbering (this was T-20).

Centralising fetches in `api.ts` fixed 401 handling that had never worked: a rejected `fetch`
gives an `Error`, not a `Response`, so the copy-pasted `err.status === 401` checks were reading
`undefined` at most call sites. An expired session now actually redirects to login.

### 2026-08-31 — T-01, T-02: the "pictures don't always work" bug

The two upload paths built `Attachment` differently and both were wrong — the file picker had
its constructor arguments swapped, and paste stripped the `data:image/png;` prefix from the
content. Neither produced a usable `<img src>`, and the file-picker rows made the download
endpoint throw `atob(undefined)` → 500.

`Attachment.fromFile()` is now the single factory, rebuilding the data URL from the reader's
base64 so `type` and `content` cannot disagree. The download endpoint decodes all three
encodings and returns a described 4xx (400 / 404 / 422) instead of throwing. Removed
`Attachment.toJSON`, which dropped `type` and — being `static` — never participated in
`JSON.stringify` anyway.

---

## Unsorted ideas

Rescued from the comment block at the top of the old `+page.svelte`. Not tasks — no acceptance
criteria, no priority. Promote one to a `T-##` in [PLAN.md](PLAN.md) when it matters.

- **videos** — attachments only ever render images inline; video gets the generic file card.
- **reply** — quoting or threading a previous message.
- **link** — linking messages to quests, or messages to each other? Original intent unclear.
- **qna get** — `GET /qna` exists but nothing calls it; AI answers are only ever read via the
  timestamp-window merge in `GET /messages`. Related to T-15.
- **model** — pick the Ollama model from the UI rather than the `OLLAMA_MODEL` env var.
- **window size** / **small font** — display density. Overlaps T-12.
- **add colors to login** — the login page never got the theme treatment.
- **still feels odd** — the whole point of this work.

(*escape markdown* folded into T-17. *functionize*, *attachments dont work*, and *import
export* are done.)
