# rubber-ducky — problem inventory & work plan

A queue of known defects and restructuring work, written so that an agent can pick up a
single task and complete it without reading the rest of the document.

## How to use this document

- Tasks are `T-##`, grouped into workstreams `W1`–`W6`.
- Each task lists **Blocked by**, **Files**, **Problem**, **Root cause**, and **Acceptance criteria**.
- Do not start a task whose **Blocked by** entries are unchecked.
- When a task is done, tick its checkbox and add a one-line note of what actually changed
  (the fix may differ from the sketch here — say so).
- Prefer the smallest change that satisfies the acceptance criteria. Several of these bugs
  are one-line argument-order fixes; resist rewriting the surrounding code while you are there.
- `bun run check` must pass before a task is considered done.

## Status legend

`[ ]` not started · `[~]` in progress · `[x]` done

---

## Architecture snapshot (as of 2026-08-30)

SvelteKit 2 / Svelte 4, Postgres via Drizzle, Bootstrap 5 from CDN, optional Ollama for
embeddings and Q&A. Deployed as a single Node container on port 80.

The entire application is **one route**. [`src/routes/+page.svelte`](../src/routes/+page.svelte)
is ~1360 lines containing chat, notes, and quests side by side.
[`src/routes/Sidebar.svelte`](../src/routes/Sidebar.svelte) selects a duck and writes it into a
`writable` store ([`src/routes/stores.js`](../src/routes/stores.js)); every panel refetches from
that subscription.

Data model:

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
problem and a large part of why notes and tasks feel bolted on.

---

## W1 — Attachments are broken

The reported symptom is "uploading pictures doesn't always work." It is four independent
defects that compound. Do these in order; T-01 defines the data format that T-02 and T-03 depend on.

### [ ] T-01 — Unify attachment encoding across both upload paths

**Priority:** critical · **Blocked by:** none

**Files:** [`src/routes/+page.svelte`](../src/routes/+page.svelte) (`handleFileSelect` ~L455,
paste handler ~L502), [`src/lib/types.ts`](../src/lib/types.ts#L7)

**Problem:** The two ways to attach a file produce two different, both-incorrect objects.

The constructor signature is `Attachment(uuid, type, name, content)`.

- File picker, [`+page.svelte:465`](../src/routes/+page.svelte#L465):
  `new Attachment('', e.target.result, file.name, file.type)` — **arguments are swapped**.
  `type` receives the entire data URL; `content` receives `"image/png"`.
- Paste, [`+page.svelte:523`](../src/routes/+page.svelte#L523): splits the data URL on `;`,
  yielding `type = "data:image/png"` and `content = "base64,iVBOR..."` — the
  `data:image/png;` prefix is stripped from the content.

Neither produces a usable `<img src>`. This is the existing
`// TODO something is wrong. first upload breaks it` at [L668](../src/routes/+page.svelte#L668).

**Root cause:** No single function owns "turn a `File`/`Blob` into an `Attachment`", so the two
call sites drifted.

**Acceptance criteria:**
- One helper (e.g. `attachmentFromFile(file: File): Promise<Attachment>`) used by both the
  `change` handler and the paste handler.
- Canonical field meanings, documented in a comment on the class:
  `type` = bare MIME type (`"image/png"`), `content` = full data URL
  (`"data:image/png;base64,..."`), `name` = filename.
- Attaching the same PNG via the file picker and via paste produces byte-identical
  `type`/`content` values.
- Pasted files with no `name` (clipboard screenshots often have none) get a generated one.

---

### [ ] T-02 — Fix the attachment download endpoint's data-URL assumption

**Priority:** critical · **Blocked by:** T-01

**Files:** [`src/routes/attachments/+server.ts`](../src/routes/attachments/+server.ts)

**Problem:** `GET` assumes `content` is a full data URL: it does
`content.split(',')[1]` ([L34](../src/routes/attachments/+server.ts#L34)) and
`type.replace('data:', '')` ([L27](../src/routes/attachments/+server.ts#L27)). Given the
file-picker-produced row from T-01, `split(',')[1]` is `undefined` and `atob(undefined)`
throws — a **500**. The paste-produced row survives only by coincidence.

**Root cause:** The endpoint decodes a format the client never reliably sends.

**Acceptance criteria:**
- Endpoint validates the stored content and returns a 4xx/5xx with a useful message rather
  than throwing on malformed base64.
- Correct `Content-Type` derived from the `type` column now that T-01 normalises it.
- Rows imported by the legacy path still download (see [`import/+server.ts`](../src/routes/import/+server.ts#L115) —
  check what encoding the Weaviate export actually produced before assuming; a migration may
  be needed, in which case split it into its own task rather than doing it inline here).

---

### [ ] T-03 — Load attachments when fetching messages

**Priority:** critical · **Blocked by:** T-01

**Files:** [`src/routes/messages/+server.ts`](../src/routes/messages/+server.ts#L19-L21)

**Problem:** `GET /messages` builds `Message` objects and never queries the attachments table.
`Message.attachments` defaults to `[]` ([`types.ts:41`](../src/lib/types.ts#L41)) and stays empty.
Consequently the image-hydration loop at [`+page.svelte:577`](../src/routes/+page.svelte#L577)
iterates over an always-empty array, and **attachments are only ever visible in the session
that uploaded them.** After a reload they are gone from the UI, though still in the database.

**Root cause:** Missing join. Never implemented after the Weaviate → Postgres migration.

**Acceptance criteria:**
- One additional query fetching all attachments for the returned message IDs
  (`inArray(attachments.messageId, ids)`), not N+1 per message.
- Image `content` is **not** inlined into the JSON response — return metadata only
  (`uuid`, `name`, `type`) and let the client request bytes by URL (see T-04).
- Reloading a duck that has image attachments shows them.

---

### [ ] T-04 — Serve images inline and delete the manual `img.src` patching

**Priority:** high · **Blocked by:** T-02, T-03

**Files:** [`src/routes/attachments/+server.ts`](../src/routes/attachments/+server.ts#L31),
[`src/routes/+page.svelte`](../src/routes/+page.svelte#L577-L608)

**Problem:** The GET always sets `Content-Disposition: attachment`, so the URL cannot be used
as an `<img src>`. To work around that, the client fetches each image as a blob, calls
`URL.createObjectURL`, then finds the element with `document.getElementById(uuid)` and assigns
`.src` directly ([L589](../src/routes/+page.svelte#L589)) — a manual DOM write racing against
Svelte's own render, with a `revokeObjectURL` in an `onload` that may never fire.

**Acceptance criteria:**
- `Content-Disposition: inline` for `image/*`, `attachment` otherwise (with a properly quoted
  and escaped filename).
- Long-lived `Cache-Control` — content is immutable per UUID.
- Markup becomes `<img src="/attachments?uuid={uuid}">`; the entire blob-fetch /
  `createObjectURL` / `getElementById` block in `onMount` is deleted.
- No `document.getElementById` calls remain in the attachment render path.

---

### [ ] T-05 — Stop storing attachment bytes as base64 text

**Priority:** medium · **Blocked by:** T-04 · **May be deferred**

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L45-L52), attachment routes, a Drizzle migration

**Problem:** `attachments.content` is `text` holding base64: ~33% storage bloat, the whole
payload round-trips through JSON on both upload and download, and there is no size limit
anywhere in the stack (`BODY_SIZE_LIMIT=Infinity` is set in the documented `.env`).

**Acceptance criteria:**
- Bytes stored as `bytea` (or on disk / object storage with a path in the DB — decide and
  record the decision here before implementing).
- Upload switches to `multipart/form-data`, not a JSON-embedded data URL.
- An enforced max upload size with a clear client-side error.
- Migration for existing rows, or a documented decision not to migrate.

---

## W2 — Composer / attachment UX

### [ ] T-06 — Discord-style attachment preview tray

**Priority:** high · **Blocked by:** T-01

**Files:** [`src/routes/+page.svelte`](../src/routes/+page.svelte#L689-L705)

**Problem:** Staged attachments are represented only by a red count badge on the paperclip
button ([L692](../src/routes/+page.svelte#L692)). You cannot see what you attached, or remove one.

**Acceptance criteria:**
- A tray above the composer showing one card per staged attachment: thumbnail for images,
  file-type icon otherwise, plus filename and human-readable size.
- Per-item remove button.
- Drag-and-drop onto the composer (and ideally the whole chat pane) with a visible drop
  target; currently only `paste` and the hidden `<input type=file>` are wired up.
- Upload progress or at least a pending state — currently the send fires N parallel POSTs with
  no feedback ([L277-L312](../src/routes/+page.svelte#L277-L312)).
- Failed uploads surface an error instead of only `console.error`.

---

## W3 — Notes

### [ ] T-07 — Make notes a real entity instead of one blob per duck

**Priority:** high · **Blocked by:** none (but coordinate with T-11, which moves it into its own route)

**Files:** [`src/routes/notes/+server.ts`](../src/routes/notes/+server.ts),
[`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L62-L67),
[`src/lib/types.ts`](../src/lib/types.ts#L64), [`src/routes/+page.svelte`](../src/routes/+page.svelte#L710-L719)

**Problem:** "Notes feels totally tacked on" is structurally accurate. There is exactly one
`notes` row per duck; `POST` overwrites the entire blob
([`notes/+server.ts:26-29`](../src/routes/notes/+server.ts#L26-L29)). No title, no multiple
notes, no timestamps, no history, no search, no autosave — and it permanently occupies 50% of
the window width ([`+page.svelte:710`](../src/routes/+page.svelte#L710)). It has no
relationship to messages or quests.

**Acceptance criteria:**
- Schema: `title`, `createdOn`, `updatedOn`; many notes per duck.
- List + open + create + delete; the note list is scoped to the duck.
- Autosave (debounced) replacing the manual disabled-until-dirty Save button, with a visible
  saved/unsaved indicator. Keep the ⌘S/Ctrl-S handler.
- Migration folds each existing single blob into one titled note per duck without data loss.
- Decide and record: do notes stay per-duck, or gain the same nullable scope as tasks in T-08?
  (Recommendation: same scope model, so a group-level or global note is possible.)

---

## W4 — Tasks / quests

The stated goal: one task system usable for everything — projects, a plain todo list, work —
with a global list, per-group lists, and a root list that aggregates all children. Today none
of that is expressible.

### [ ] T-08 — Give quests a nullable scope so global and group-level tasks exist

**Priority:** critical · **Blocked by:** none · **Do this before any task-UI work**

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L69-L80),
[`src/routes/quests/+server.ts`](../src/routes/quests/+server.ts),
[`src/lib/types.ts`](../src/lib/types.ts#L87-L122), a Drizzle migration

**Problem:** `quests.duckId` is `NOT NULL` ([`schema.ts:79`](../src/lib/db/schema.ts#L79)), so a
quest **cannot** exist outside a single channel. `GET /quests` filters by exactly one duck
([`quests/+server.ts:12`](../src/routes/quests/+server.ts#L12)). A global list, a per-group
list, and a root list aggregating children are all impossible without this change.

**Acceptance criteria:**
- `duckId` nullable, plus a nullable `badlingId` — or a single `scopeType`/`scopeId` pair.
  Pick one and record the choice and reasoning in this file. (Recommendation: nullable
  `duckId` + nullable `badlingId`, with a CHECK constraint that at most one is set; simpler to
  query with Drizzle than a polymorphic pair, and "both null" cleanly means global.)
- `GET /quests` accepts a scope: `?duck=`, `?badling=` (aggregating that group's ducks), or
  none (everything).
- Existing rows keep their current duck. Migration is non-destructive.
- The `parent_id` / `quest_parent_id` naming confusion in `Quest`
  ([`types.ts:89-90`](../src/lib/types.ts#L89-L90)) is resolved — one means "owning duck",
  the other "parent quest", and the names should say so.

---

### [ ] T-09 — Sortable, filterable task fields

**Priority:** high · **Blocked by:** T-08

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L69-L80), quests route, a migration

**Problem:** "I want to sort and separate" is not currently possible.
`due` is a `text` column ([`schema.ts:73`](../src/lib/db/schema.ts#L73)) — it cannot be sorted
or range-filtered. There is no ordering, no priority, and no tags. The only sort is
`createdOn DESC`.

**Acceptance criteria:**
- `dueAt` as `timestamp with time zone`, migrated from the existing text values (log any rows
  that fail to parse rather than dropping them).
- `sortOrder` for manual arrangement, `priority`, and tags (a join table, or `text[]` — decide
  and record).
- Sort and filter available on the API, not only client-side.

---

### [ ] T-10 — Task list interaction overhaul

**Priority:** high · **Blocked by:** T-08, T-09

**Files:** [`src/routes/+page.svelte`](../src/routes/+page.svelte#L721-L771) (moving to its own
route under T-11), [`src/routes/quests/+server.ts`](../src/routes/quests/+server.ts)

**Problem:** The list is cumbersome to operate:
- No edit and no delete — `PATCH` only accepts a status change
  ([`quests/+server.ts:61`](../src/routes/quests/+server.ts#L61)); there is no `DELETE`.
- The only creation path is a modal.
- The status dropdown is `opacity: 0; visibility: hidden` until hover
  ([`+page.svelte:999-1002`](../src/routes/+page.svelte#L999-L1002)) — unusable on touch.
- The due date is also hover-only ([L962](../src/routes/+page.svelte#L962)).
- Sub-quests are reachable only by clicking the count badge, and that badge **replaces** the
  status icon ([L738-L749](../src/routes/+page.svelte#L738-L749)) — a quest with children shows
  no status at all.
- Five statuses (`active`/`inactive`/`completed`/`aborted`/`locked`) plus a separate `done`
  boolean that merely mirrors `status === 'completed'`. Confirm whether all five earn their
  place; the redundant `done` column should probably go.

**Acceptance criteria:**
- Inline quick-add (type a title, press Enter) alongside the full modal.
- Edit and delete, with `PATCH` accepting arbitrary field updates and a `DELETE` handler that
  handles sub-quests (cascade or re-parent — decide and record).
- No control is hover-only; everything is reachable by tap.
- Status and sub-quest count are visible simultaneously.
- Drag-to-reorder writing `sortOrder`.

---

## W5 — Route restructure and mobile

The Discord-style answer to "each section gets its own page" also resolves most of the layout
jank and makes notes and tasks feel native rather than bolted on. T-11 is the large one; read
it fully before starting.

### [ ] T-11 — Split the single route into real routes

**Priority:** high · **Blocked by:** T-08 (task scope should be settled first)

**Files:** all of [`src/routes/`](../src/routes/)

**Problem:** Everything is `/`. Panels are shown or hidden by CSS width, selection lives in a
client-side store, and there is no URL you can link to or refresh into.

**Proposed structure** (adjust if a better shape emerges — record what you chose):

```
/                      global home: aggregated tasks, recent activity
/g/[badling]           group view
/d/[duck]              redirects to /d/[duck]/chat
/d/[duck]/chat
/d/[duck]/notes
/d/[duck]/tasks
/tasks                 global task list with a scope selector
```

- Desktop: sub-routes render as side-by-side panes within the duck layout.
- Mobile: each is a full page, with a bottom tab bar to switch between them.
- The selected duck comes from the URL params, not from the `writable` store.

**Acceptance criteria:**
- Data loads in `+page.server.ts` / `load` functions rather than `onMount` fetch chains.
- `+page.ts`'s `prerender = true` ([`+page.ts:3`](../src/routes/+page.ts#L3)) is removed or
  correctly scoped — today the only page is prerendered while all its data is client-fetched,
  producing a blank flash on every load.
- Deep links work: refreshing `/d/<uuid>/notes` lands on that duck's notes.
- The `lastDuck` cookie behaviour is preserved (redirect `/` → last duck, or keep `/` as the
  global home and drop it — decide and record).
- `+page.svelte` is decomposed; no single component over ~300 lines.

---

### [ ] T-12 — Make it work on a phone

**Priority:** high · **Blocked by:** T-11

**Files:** [`src/routes/+layout.svelte`](../src/routes/+layout.svelte),
[`src/routes/Sidebar.svelte`](../src/routes/Sidebar.svelte), [`src/app.css`](../src/app.css)

**Problem:** There is essentially no responsive handling.
- Hard `w-50` / `w-50` split ([`+page.svelte:647`](../src/routes/+page.svelte#L647),
  [L710](../src/routes/+page.svelte#L710)).
- Fixed `280px` sidebar with no drawer ([`Sidebar.svelte:187`](../src/routes/Sidebar.svelte#L187)).
- `max-height: 100vh` ([`+page.svelte:645`](../src/routes/+page.svelte#L645)) — wrong on mobile
  Safari, needs `dvh`.
- Hover-only affordances everywhere, including the sidebar's entire button bar
  (`div:hover > .bar-hidden`, [`Sidebar.svelte:348-357`](../src/routes/Sidebar.svelte#L348-L357)),
  which makes add-duck, add-badling, hide, dark mode, and import **completely unreachable by touch**.

**Acceptance criteria:**
- Sidebar becomes an off-canvas drawer below a breakpoint, with a visible trigger.
- No functionality gated behind `:hover`.
- `dvh` units; the composer stays visible when the on-screen keyboard opens.
- Tap targets ≥ 44px.
- Verified at 390px wide.

---

## W6 — Correctness, security, and jank

Small independent fixes. Each is self-contained; they can be done in any order and in parallel
with the workstreams above.

### [ ] T-13 — Authenticate every endpoint

**Priority:** critical · **Blocked by:** none

**Files:** [`src/hooks.server.ts`](../src/hooks.server.ts), all of `src/routes/*/+server.ts`

**Problem:** Only `GET /ducks` validates a session
([`ducks/+server.ts:8-15`](../src/routes/ducks/+server.ts#L8-L15)). `/messages`, `/notes`,
`/quests`, `/attachments`, `/import`, `POST /ducks`, and `POST /badlings` are **unauthenticated** —
and this is deployed on port 80. `/import` in particular accepts arbitrary bulk writes.

**Acceptance criteria:**
- Session validation moves into `hooks.server.ts` as a single guard covering every route
  except `/login`, populating `event.locals`.
- Per-route ad-hoc header checks are removed in favour of the guard.
- The session is read consistently — currently the client sends it as a `Session` **header**
  from the sidebar but as a **cookie** elsewhere ([`+page.svelte:237`](../src/routes/+page.svelte#L237)).
  Standardise on an httpOnly cookie.

---

### [ ] T-14 — Session lifetime is 60 seconds

**Priority:** critical · **Blocked by:** none

**Files:** [`src/routes/login/+server.ts`](../src/routes/login/+server.ts#L14)

**Problem:** `new Date(now + 1000 * 60)` — sessions expire after one minute. Almost certainly
meant to be days.

**Acceptance criteria:** A sane configurable lifetime; expiry is actually enforced on every
request (see T-13); the cookie's `max-age` matches the DB expiry.

---

### [ ] T-15 — Paginated message loads duplicate every AI answer

**Priority:** high · **Blocked by:** none

**Files:** [`src/routes/messages/+server.ts`](../src/routes/messages/+server.ts#L23-L33)

**Problem:** After fetching a page of 10 messages, the handler selects **all** rows from
`answers` and appends every one newer than the oldest message on that page. Paginating
therefore re-appends the same answers on every page.

**Root cause:** `answers` has no FK to a duck or a message
([`schema.ts:54-60`](../src/lib/db/schema.ts#L54-L60)), so they are correlated by timestamp
window instead of by relationship.

**Acceptance criteria:**
- `answers` gains a proper relationship (a `duckId`, or a FK to the triggering message).
- Answers are fetched with the same window/offset as the messages page, not globally.
- Scrolling back through history shows each answer exactly once.
- (While here: the schema's `promt` typo at [`schema.ts:56`](../src/lib/db/schema.ts#L56) is
  also baked into [`import/+server.ts:139`](../src/routes/import/+server.ts#L139) — rename both
  together or leave both alone.)

---

### [ ] T-16 — Infinite scroll is dead code with inverted logic

**Priority:** medium · **Blocked by:** none

**Files:** [`src/routes/+page.svelte`](../src/routes/+page.svelte#L472-L499)

**Problem:** Two compounding bugs. The listener is attached to `window`
([L627](../src/routes/+page.svelte#L627)), but the scrolling element is `#chatbox`
(`overflow-auto` inside a `100vh` container) — so `window` never scrolls and the handler never
fires. And the condition
`window.innerHeight + window.scrollY <= document.body.offsetHeight - 10`
([L494](../src/routes/+page.svelte#L494)) is inverted: it is true when you are *not* at the
bottom. If the listener were ever attached to the right element it would loop.

**Acceptance criteria:**
- Listener on `#chatbox`, firing when scrolled near the **top** (older messages).
- Scroll position is preserved when older messages are prepended — currently prepending
  jumps the view.
- The `loading` guard actually prevents overlapping fetches.

---

### [ ] T-17 — Replace the regex markdown renderer

**Priority:** medium · **Blocked by:** none

**Files:** [`src/routes/+page.svelte`](../src/routes/+page.svelte#L352-L416),
[`+page.svelte:664`](../src/routes/+page.svelte#L664)

**Problem:** Message content is emitted with `{@html message.content}` — **unescaped** — and
then an action reads `node.innerHTML`, runs eight sequential regex replacements over it, and
writes it back ([L389-L405](../src/routes/+page.svelte#L389-L405)). This is an XSS hole on your
own stored data, it re-parses the whole subtree once per replacement, and it corrupts any
content containing HTML-significant characters. The `replaceAsync` helper is annotated
`// idk what this does, but it works`.

**Acceptance criteria:**
- A real markdown library (e.g. `marked`) plus a sanitiser, producing HTML from the **source
  string** — never by rewriting rendered `innerHTML`.
- Code highlighting integrates via the markdown renderer, letting the hardcoded 13-case
  language `switch` ([L161-L217](../src/routes/+page.svelte#L161-L217)) be deleted.
- Existing custom syntax is preserved: `||spoilers||` and bare-URL autolinking.
- No `{@html}` on unsanitised input.

---

### [ ] T-18 — Move Bootstrap out of a component and off the CDN

**Priority:** medium · **Blocked by:** none

**Files:** [`src/routes/Header.svelte`](../src/routes/Header.svelte#L8-L9),
[`src/app.html`](../src/app.html)

**Problem:** Bootstrap's CSS and JS bundle are loaded via `<link>`/`<script>` tags inside a
component's `<header>` element. That is render-blocking, breaks offline/LAN use, and is an odd
place for it. The `Header` component renders nothing else — its only content is commented out.

**Acceptance criteria:** Bootstrap installed as a dependency and imported, or moved to
`app.html`. Decide whether `Header.svelte` should exist at all.

---

### [ ] T-19 — Sidebar collapse IDs derive from user-supplied names

**Priority:** medium · **Blocked by:** none

**Files:** [`src/routes/Sidebar.svelte`](../src/routes/Sidebar.svelte#L202-L207)

**Problem:** `data-bs-target="#{badling.name}-collapse"` — a group named `"My Stuff"` yields an
invalid selector, and two groups with the same name collide.

**Acceptance criteria:** IDs derived from `badling.uuid`. Verified with a group whose name has
spaces, punctuation, and a leading digit.

---

### [ ] T-20 — Store subscription leak

**Priority:** low · **Blocked by:** none (subsumed by T-11 if that lands first)

**Files:** [`src/routes/+page.svelte`](../src/routes/+page.svelte#L557-L625)

**Problem:** `duck.subscribe(...)` inside `onMount` is never unsubscribed; the returned cleanup
only removes the scroll listener. Also, `document.onpaste = ...`
([L502](../src/routes/+page.svelte#L502)) assigns to a global handler rather than using
`addEventListener`, clobbering any other paste handler.

**Acceptance criteria:** Subscription disposed in the `onMount` cleanup (or replaced by `$duck`
auto-subscription); paste uses `addEventListener` with a matching `removeEventListener`.

---

### [ ] T-21 — Database host is hardcoded

**Priority:** medium · **Blocked by:** none

**Files:** [`src/lib/db/index.ts`](../src/lib/db/index.ts#L6-L12)

**Problem:** `host: 'localhost'`, `port: 5432`, `database: 'rubber_ducky'`, all literal; only
the password comes from the environment. Works only because Postgres runs in the same
container.

**Acceptance criteria:** Full connection config from the environment with the current values as
defaults; `README.md`'s `.env` block updated.

---

## Suggested order

Dependency-driven; W6 items are independent and can be interleaved.

1. **T-13, T-14** — auth and session lifetime. Small, and the app is currently wide open.
2. **T-01 → T-02 → T-03 → T-04** — attachments end to end. Fixes the reported bug.
3. **T-08 → T-09** — task schema. Unblocks everything task-shaped; do it before building task UI.
4. **T-11** — route split. Unblocks mobile and makes notes/tasks first-class.
5. **T-06, T-07, T-10, T-12** — the UX work, now that the foundations hold.
6. **T-15 … T-21** — remaining correctness and jank, opportunistically.

T-05 (bytea storage) and T-17 (markdown) are deferrable without blocking anything else.

---

## Decisions log

Record choices made while working, so later tasks do not re-litigate them.

| Date | Task | Decision |
|------|------|----------|
| | | |
