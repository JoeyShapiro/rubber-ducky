# rubber-ducky — work plan

Open work only. Background, decisions already made, and a log of what has been finished live in
[NOTES.md](NOTES.md) — read that before starting anything, so you do not re-litigate a settled
choice.

## How to use this document

- Tasks are `T-##`, grouped into workstreams. IDs are **stable** — completed tasks are removed
  from this file, not renumbered, so `T-05` stays `T-05` forever and the notes stay valid.
- Each task lists **Blocked by**, **Files**, **Problem**, and **Acceptance criteria**.
- Do not start a task whose **Blocked by** entries are unchecked.
- When a task is finished, delete it from here and add an entry to the *Completed* section of
  [NOTES.md](NOTES.md) saying what actually changed — the fix often differs from the sketch.
- Record any judgement call in the decisions log in [NOTES.md](NOTES.md).
- Prefer the smallest change that satisfies the acceptance criteria.
- `bun run check` must pass before a task is considered done.

## Status legend

`[ ]` not started · `[~]` in progress

---

## W1 — Attachments: remaining cleanup

The reported "uploading pictures doesn't always work" bug is fixed (T-01 → T-04, T-06). What is
left is storage-level tidying, neither of which blocks anything.

### [ ] T-05 — Stop storing attachment bytes as base64 text

**Priority:** medium · **Blocked by:** none · **May be deferred**

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L45-L52),
[`src/routes/attachments/+server.ts`](../src/routes/attachments/+server.ts),
[`src/lib/components/Composer.svelte`](../src/lib/components/Composer.svelte), a Drizzle migration

**Problem:** `attachments.content` is `text` holding base64: ~33% storage bloat, the whole
payload round-trips through JSON on both upload and download, and there is no size limit
anywhere in the stack (`BODY_SIZE_LIMIT=Infinity` is set in the documented `.env`).

**Acceptance criteria:**
- Bytes stored as `bytea` (or on disk / object storage with a path in the DB — decide and
  record the decision).
- **Store each image's intrinsic width and height.** Without them an `<img>` measures zero until
  it decodes, then shoves the layout down. That is why loading older messages needs the
  element-anchoring and on-load re-pin in `Chat.svelte`; with real dimensions the browser
  reserves the space and none of that is necessary.
- Upload switches to `multipart/form-data`, not a JSON-embedded data URL.
- An enforced max upload size with a clear client-side error.
- Migration for existing rows, or a documented decision not to migrate.

---

## W2 — Composer / attachment UX

### [ ] T-23 — Upload feedback and failure handling

**Priority:** medium · **Blocked by:** none

**Files:** [`src/lib/components/Composer.svelte`](../src/lib/components/Composer.svelte)

**Problem:** T-06 gave attachments a visible tray, but the upload itself is still silent. The
send button disables while sending and that is all: there is no per-file progress, and a failed
upload only reaches `console.error` — the message posts, the attachment quietly does not, and
nothing on screen says so. Large files make this obvious, since the whole base64 payload goes
up in one JSON POST.

**Acceptance criteria:**
- Per-attachment pending / done / failed state shown on its card.
- A failed upload is visible and offers a retry, or at minimum names the file that failed.
- Sensible behaviour when some attachments in a batch succeed and others fail.
- Fold in a client-side size limit when T-05 sets one.

---

## W3 — Notes

The design brief — what a note is, why references rather than pinning, where a project fits, and
where a loose task lives — is settled and lives in [NOTES.md](NOTES.md). Read it before starting
anything here.

### [ ] T-28 — Give notes the same scope as quests

**Priority:** medium · **Blocked by:** T-08

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts),
[`src/routes/notes/+server.ts`](../src/routes/notes/+server.ts),
[`src/lib/components/Notes.svelte`](../src/lib/components/Notes.svelte), a migration

**Problem:** T-07 shipped notes as duck-only, because T-08's scope model does not exist yet.
"Office snack preferences: Sarah is gluten-free" is reference material for an area of life, not
for one project, and today it has nowhere to live — the same gap loose tasks have. See *Where a
loose task lives*.

**Acceptance criteria:**
- `notes.duckId` becomes nullable alongside a nullable `badlingId`, matching whatever shape T-08
  settles on. Do not invent a second scope model.
- `GET /notes` accepts `?duck=`, `?badling=`, or neither (global), like `GET /quests`.
- Existing notes keep their duck; the migration is non-destructive.
- The badling and global views can list and create notes, not just ducks.

---

### [ ] T-24 — One reference table for links between things

**Priority:** medium · **Blocked by:** T-07, T-08

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts), the notes and quests routes,
[`src/lib/components/`](../src/lib/components/), a migration

**Problem:** Four wanted features are the same feature: a note used by several quests, a quest
citing a note, a note that records which messages it came from (backtracing), and an anchored
scratchpad. Building them separately produces four half-mechanisms. See the design brief.

**Acceptance criteria:**
- One `references` table: a source, a target, each identified by kind + id, plus an **optional
  label**, with the pair unique. Supported ends at minimum: note, quest, message.
- The label is what makes a bare backtrace useful — "where the build broke" — so no note has to
  be invented just to hold a link.
- **A reference always has a source.** No free-floating saved links; see the guardrail in the
  design brief. Floating links are pinning with extra steps.
- Both directions are queryable — "what does this note link to" and "what links to this note" —
  without a second table.
- Following a reference to a message lands on it **in context**, with the surrounding
  conversation, not on the message alone.
- Linking is always optional and never a step in creating a note or a quest.
- Deleting either end removes the reference, never the counterpart.
- Keep the UI narrow. This is a secondary action everywhere it appears; if it starts feeling
  like graph software, it has gone wrong.

---

### [ ] T-25 — Distil a note from the log

**Priority:** medium · **Blocked by:** T-07, T-24

**Files:** [`src/lib/components/Message.svelte`](../src/lib/components/Message.svelte),
[`src/routes/notes/+server.ts`](../src/routes/notes/+server.ts),
[`src/lib/api.ts`](../src/lib/api.ts)

**Problem:** Step 5 of the intended flow — after finishing a quest, distil the part worth
keeping — has no support. Anything worth keeping must be retyped, so it mostly is not.

**This is not pinning.** It creates a *new* note, authored deliberately, which happens to cite
the message it came from. It does not flag the message or add it to a pinned list; see the
design brief for why that was rejected.

**Acceptance criteria:**
- A per-message action that opens a new note seeded with that message's content, editable before
  saving — the note is written, not copied.
- The note records a reference back to the source message (T-24), so the original context and
  its surrounding conversation stay findable.
- Works on a message with attachments — decide and record whether attachments come along or are
  only referenced.
- Confirmation is a small inline acknowledgement, not a dialog.

---

### [ ] T-26 — Search messages

**Priority:** high · **Blocked by:** none

**Files:** [`src/routes/messages/+server.ts`](../src/routes/messages/+server.ts),
[`src/lib/components/Chat.svelte`](../src/lib/components/Chat.svelte),
[`src/lib/api.ts`](../src/lib/api.ts), possibly a migration for an index

**Problem:** **Search does not exist.** Not partially — there is no endpoint, no UI, and no
query anywhere in `src/`. The only occurrence of the word is a startup warning saying semantic
search is disabled. The log is therefore write-only: you can put things in and never find them
again.

This is load-bearing for the design brief. Search is the stated reason message pinning was
rejected, so rejecting pinning is only honest once this exists.

**The embeddings are already there and nothing reads them.** `messages.embedding` is a populated
768-dim vector ([`schema.ts:40`](../src/lib/db/schema.ts#L40)) written on every POST that has
text, the database image is pgvector, and **no query in the codebase ever selects it**. Ollama is
being called on every message for a column with no reader.

Also dead: `attachments.embedding` ([`schema.ts:50`](../src/lib/db/schema.ts#L50)) and
`notes.embedding` ([`schema.ts:65`](../src/lib/db/schema.ts#L65)) are declared but never written
*or* read. Decide whether to populate them or drop the columns.

**Acceptance criteria:**
- Text search across a duck's messages, and across all ducks.
- Postgres full-text search (or trigram) with an index — not `LIKE` over every row.
- A result jumps to that message **in context**, sharing the mechanism T-24 needs for following
  a reference. Build it once.
- Exact match must be first-class — hunting a command or an error string is the common case and
  is exactly what semantic search is bad at.
- Decide and record whether semantic search over the existing embeddings is offered alongside
  exact search, and how the two are presented without confusing them.
- Resolve the three `embedding` columns: query them, or drop the unused ones and stop paying
  Ollama for writes nobody reads.
- Attachment filenames are searchable too, or explicitly noted as out of scope.

---

## W4 — Tasks / quests

The stated goal: one task system usable for everything — projects, a plain todo list, work —
with a global list, per-group lists, and a root list that aggregates all children. Today none
of that is expressible.

See *Where a "project" fits* and *Where a loose task lives* in W3 before starting T-08. The
conclusions there — a project is a duck, and a loose task binds to its badling — are what make
T-08's three-level scope both necessary and sufficient. The second section also flags a
consequence T-08 must settle: what happens to the system message a status change posts, when the
quest has no duck log.

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
  Pick one and record the choice and reasoning. (Recommendation: nullable `duckId` + nullable
  `badlingId`, with a CHECK constraint that at most one is set; simpler to query with Drizzle
  than a polymorphic pair, and "both null" cleanly means global.)
- `GET /quests` accepts a scope: `?duck=`, `?badling=` (aggregating that group's ducks), or
  none (everything). Add the matching functions to [`api.ts`](../src/lib/api.ts).
- Existing rows keep their current duck. Migration is non-destructive.
- The `parent_id` / `quest_parent_id` naming confusion in `Quest`
  ([`types.ts:89-90`](../src/lib/types.ts#L89-L90)) is resolved — one means "owning duck",
  the other "parent quest", and the names should say so.

---

### [ ] T-09 — Sortable, filterable task fields

**Priority:** high · **Blocked by:** T-08

**Files:** [`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L69-L80),
[`src/routes/quests/+server.ts`](../src/routes/quests/+server.ts), a migration

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

**Files:** [`src/lib/components/Quests.svelte`](../src/lib/components/Quests.svelte),
[`src/lib/components/QuestModal.svelte`](../src/lib/components/QuestModal.svelte),
[`src/routes/quests/+server.ts`](../src/routes/quests/+server.ts)

**Problem:** Partly addressed. Rows now expand on click to show the description, the status icon
and the subquest count are visible at the same time, the due date is no longer hover-only, and the
breadcrumbs are real buttons. What remains:
- No edit and no delete — `PATCH` only accepts a status change
  ([`quests/+server.ts`](../src/routes/quests/+server.ts)); there is no `DELETE`.
- The only creation path is a modal.
- The status dropdown is still `opacity: 0` until hover
  ([`Quests.svelte:439`](../src/lib/components/Quests.svelte#L439)) — unusable on touch, and the
  last hover-only control in this panel.
- Five statuses (`active`/`inactive`/`completed`/`aborted`/`locked`) plus a `done` boolean that
  only mirrors `status === 'completed'`. Confirm all five earn their place; the redundant column
  should probably go.

**Acceptance criteria:**
- Inline quick-add (type a title, press Enter) alongside the full modal.
- Edit and delete, with `PATCH` accepting arbitrary field updates and a `DELETE` handler that
  handles sub-quests (cascade or re-parent — decide and record). Deleting confirms via
  [`ConfirmDialog.svelte`](../src/lib/components/ConfirmDialog.svelte); deleting a quest with
  subquests especially needs to say what else goes with it.
- No control is hover-only; everything is reachable by tap.
- Drag-to-reorder writing `sortOrder`.

---

## W5 — Route restructure and mobile

The Discord-style answer to "each section gets its own page" also resolves most of the layout
jank and makes notes and tasks feel native rather than bolted on. T-11 is the large one; read
it fully before starting.

### [ ] T-11 — Split the single route into real routes

**Priority:** high · **Blocked by:** T-08 (task scope should be settled first)

**Files:** all of [`src/routes/`](../src/routes/), moving components from
[`src/lib/components/`](../src/lib/components/)

**Problem:** Everything is `/`. Panels are shown or hidden by CSS width, selection lives in a
client-side store, and there is no URL you can link to or refresh into.

The frontend split already did the hard part: each component loads its own data from a `duck`
prop, so this is mostly moving files and changing where `duck` comes from.

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
- Data loads in `+page.server.ts` / `load` functions rather than component-level fetches.
- `+page.ts`'s `prerender = true` ([`+page.ts:3`](../src/routes/+page.ts#L3)) is removed or
  correctly scoped — today the only page is prerendered while all its data is client-fetched,
  producing a blank flash on every load.
- Deep links work: refreshing `/d/<uuid>/notes` lands on that duck's notes.
- The `lastDuck` cookie behaviour is preserved (redirect `/` → last duck, or keep `/` as the
  global home and drop it — decide and record).

---

### [ ] T-12 — Make it work on a phone

**Priority:** high · **Blocked by:** T-11

**Files:** [`src/routes/+layout.svelte`](../src/routes/+layout.svelte),
[`src/routes/Sidebar.svelte`](../src/routes/Sidebar.svelte), [`src/app.css`](../src/app.css),
[`src/routes/+page.svelte`](../src/routes/+page.svelte)

**Problem:** There is essentially no responsive handling.
- Hard `w-50` / `w-50` split ([`+page.svelte:16`](../src/routes/+page.svelte#L16),
  [`Chat.svelte:50`](../src/lib/components/Chat.svelte#L50)).
- Fixed `280px` sidebar with no drawer ([`Sidebar.svelte:187`](../src/routes/Sidebar.svelte#L187)).
- `max-height: 100vh` in [`+page.svelte`](../src/routes/+page.svelte) — wrong on mobile Safari,
  needs `dvh`.
- Hover-only affordances, including the sidebar's entire button bar
  (`div:hover > .bar-hidden`, [`Sidebar.svelte:348-357`](../src/routes/Sidebar.svelte#L348-L357)),
  which makes add-duck, add-badling, hide, dark mode, and import **completely unreachable by
  touch**. The quest list has more of them — see T-10.

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

### [ ] T-15 — Paginated message loads duplicate every AI answer

**Priority:** high · **Blocked by:** none

**Files:** [`src/routes/messages/+server.ts`](../src/routes/messages/+server.ts)

**Problem:** After fetching a page of 10 messages, the handler selects **all** rows from
`answers` and appends every one newer than the oldest message on that page. Paginating
therefore re-appends the same answers on every page.

**Root cause:** `answers` has no FK to a duck or a message
([`schema.ts:54-60`](../src/lib/db/schema.ts#L54-L60)), so they are correlated by timestamp
window instead of by relationship.

**Partly masked, not fixed:** `Chat.svelte` drops messages whose uuid it has already seen, so
duplicates do not render. The endpoint still returns them, and the root cause — `answers` having no
relationship to a duck — is untouched.

**Acceptance criteria:**
- `answers` gains a proper relationship (a `duckId`, or a FK to the triggering message).
- Answers are fetched with the same window/offset as the messages page, not globally.
- Scrolling back through history shows each answer exactly once.
- (While here: the schema's `promt` typo at [`schema.ts:56`](../src/lib/db/schema.ts#L56) is
  also baked into [`import/+server.ts:139`](../src/routes/import/+server.ts#L139) — rename both
  together or leave both alone.)

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

1. **T-08 → T-09** — task schema. Unblocks everything task-shaped; do it before building task UI.
   It also decides whether notes gain badling/global scope (T-28).
2. **T-11** — route split. Unblocks mobile and makes notes/tasks first-class.
3. **T-10, T-12** — the UX work, now that the foundations hold.
4. **T-24, T-25** — the reference table, then distilling notes from the log. These are what make
   notes stop feeling bolted on, but they need T-08 and T-28 underneath.
5. **T-26** — message search. Independent of all the above and can be pulled earlier; it is the
   thing that turns the log into something you can look things up in.
6. **T-15**, then the rest of W6, opportunistically.

T-05 (attachment storage) is deferrable without blocking anything.
