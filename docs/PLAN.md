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

## W3 — Notes

The design brief — what a note is, why references rather than pinning, where a project fits, and
where a loose task lives — is settled and lives in [NOTES.md](NOTES.md). Read it before starting
anything here.

### [ ] T-24 — One reference table for links between things

**Priority:** medium · **Blocked by:** T-07

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

The stated goal: one task system usable for everything — projects, a plain todo list, work — with
a per-duck list and a per-badling list. Today both exist: a quest carries `parent_id`, a duck's or
a badling's uuid, `NOT NULL` (2026-09-14; see decisions log). **No global, scopeless list** — a
task belongs to a duck or a badling, always. If an all-up view is wanted later it reads *across*
existing scopes rather than needing a scope of its own; see *decisions log*.

See *Where a "project" fits* and *Where a loose task lives* in W3 before starting here.

### [ ] T-09 — Sortable, filterable task fields

**Priority:** high · **Blocked by:** none

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

## W5 — Mobile

### [~] T-12 — Make it work on a phone

**Priority:** high · **Blocked by:** none

**Files:** [`src/lib/stores.ts`](../src/lib/stores.ts),
[`src/lib/components/MobileTopBar.svelte`](../src/lib/components/MobileTopBar.svelte),
[`src/app.css`](../src/app.css), [`src/routes/+layout.svelte`](../src/routes/+layout.svelte),
[`src/routes/Sidebar.svelte`](../src/routes/Sidebar.svelte),
[`src/lib/components/Chat.svelte`](../src/lib/components/Chat.svelte),
[`src/lib/components/Notes.svelte`](../src/lib/components/Notes.svelte),
[`src/lib/components/Quests.svelte`](../src/lib/components/Quests.svelte)

**First pass landed 2026-09-14** (see decisions log) — a Discord-style drawer system, four
full-screen "screens" below the 768px breakpoint instead of the desktop two/three-column layout:
sidebar → chat → {notes, quests}. `mobileView` (`$lib/stores.ts`) tracks which one is showing;
each screen's own root carries `data-screen="sidebar|chat|notes|quests"`, `.app` carries
`data-mobile-view`, and `app.css`'s media query does the hide/show — no route, no new component
state duplicated per screen. `MobileTopBar.svelte` is the back-arrow + title bar shown on chat
(back → sidebar, plus notes/quests icons) and notes/quests (back → chat); the sidebar itself has
no top bar. Desktop renders exactly as before — verified untouched by the same pass.

Also done as part of this pass: hover-only controls (sidebar's bottom icon row, the per-badling
add-duck button, the quest status dropdown) are always visible below the breakpoint instead of
tap-to-reveal; `dvh` in place of `vh` through the app shell.

**What's still open:**
- Composer-stays-visible-when-the-keyboard-opens is unverified — `dvh` alone may not be enough on
  iOS Safari; wants testing on a real device, not just a resized desktop browser.
- Tap-target audit beyond the new top bar (existing rows, buttons elsewhere) — 44px was the target
  for what this pass touched, not a sweep of the whole app.
- The transition between screens is an instant swap, no animation. Fine for now; revisit once the
  navigation itself has been used for a while and any rough edges are known.
- Sidebar row density, spacing, and general phone-specific polish — deliberately deferred per
  "get something out there, hash out design more after it works-ish."

---

## Suggested order

Dependency-driven; W6 items are independent and can be interleaved.

1. **T-09** — task schema (due date, sort order, priority, tags). Unblocks everything task-shaped;
   do it before building task UI.
2. **T-12** — the mobile pass. No longer waits on anything.
3. **T-24, T-25** — the reference table, then distilling notes from the log. These are what make
   notes stop feeling bolted on.
4. **T-26** — message search. Independent of all the above and can be pulled earlier; it is the
   thing that turns the log into something you can look things up in.
T-05 (attachment storage) is deferrable without blocking anything.
