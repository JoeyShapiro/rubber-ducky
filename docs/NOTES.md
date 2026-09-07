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
        ├── notes      (exactly one row per duck)
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
  markdown.ts            the regex markdown action (T-17 replaces it)
  attachments.ts         reading the three attachment encodings; shared by both endpoints
  format.ts              formatDate
  quests.ts              status list, labels, css classes, svg icons
  types.ts               Attachment / Message / Note / Quest / Duck / Badling
  components/
    Chat.svelte          left column: message list + composer, owns loading and scroll
    Message.svelte       one message, system or normal, with its attachments
    Composer.svelte      textarea, attachments, paste, submit, the qna toggle
    Notes.svelte         the notes pane
    Quests.svelte        breadcrumbs + quest list
    QuestModal.svelte    create-quest dialog
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
