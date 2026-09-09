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

### [ ] T-22 — Normalise legacy attachment rows to the canonical encoding

**Priority:** low · **Blocked by:** none · **Optional**

**Files:** a one-off migration or script

**Problem:** The endpoints read all three historical encodings (see *Attachment encodings* in
[NOTES.md](NOTES.md)), which fixed the symptom but keeps three shapes alive in the table
forever. Every future reader has to know about all of them.

**Acceptance criteria:**
- One-off pass rewriting legacy rows into the canonical shape (`type` = bare MIME,
  `content` = full data URL), reusing `decode()` from [`$lib/attachments.ts`](../src/lib/attachments.ts).
- Rows that `decode()` rejects are reported, not silently dropped.
- Once no legacy rows remain, `decode()`'s legacy branches could be deleted — but only after
  confirming no un-imported Weaviate export will be loaded later.
- Fold into T-05 if that lands first, since it rewrites every row anyway.

---

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

### Design brief: what a note actually is

**Owner's framing, 2026-09-06.** Settled enough to build against; the open questions at the end
are the remainder.

A note is **something that is currently true and worth having at hand.** Not a record of what
happened — that is the message log. Not something to do — that is a quest.

The test for whether something is a note: **will I need to ask this again?** The title is the
question, the content is the answer. The owner's example is the exact shape:

```
title:   "start command"
content: "#dont forget to chmod\n./build.sh"
```

Small, titled, atomic, looked up by name. Not a document. The title is a **lookup key**, not a
headline.

**Notes have no completion.** A quest goes open → done. A note goes **true → stale**. You do not
finish a note, you retire it when it stops being true. This is why the current textarea feels
wrong — it has no lifecycle at all — and why a Done checkbox would be equally wrong. Deleting a
note is normal and healthy, not data loss.

**What is *not* a note:** "tried X, didn't work". That is a log entry — post it to the duck's
message log. Notes are not a transcript. Academic notes are mostly transcript, which is why they
are a misleading model here; the transcript already exists and wants search, not curation.

#### The intended flow

1. Add a quest: "check the wiki" (the link lives in the quest)
2. Do it — read, dig
3. Post messages about progress and findings as you go (**this is the log, not notes**)
4. Complete the quest
5. Distil **one note** from it: the part worth keeping around
6. Possibly spawn further quests from what was learned ("impl huffman encoding", algorithm in
   the description)

Notes are the *residue* of work, written deliberately at the end. They are not captured
continuously — that is what the message stream is for.

#### References, not pinning

Message pinning is **rejected**, on the owner's reasoning: a pin list becomes a second, worse
message history, and it is redundant once messages are searchable (T-26).

What is actually wanted is the opposite direction — **backtracing**. A pin marks a message and
hopes you find it later. A reference starts from the durable thing and points back at where it
came from. You do not browse a pin list; you are reading a note and want its origin.

Backtracing, note→quest, quest→note and message→note are all **one primitive**: a reference
between two things, where one end may be a point in the stream. That is one table (T-24), not
four features.

A reference carries an **optional label**, so "trace back to where the build broke" is just a
titled link on a quest or a note. It does not require inventing a note whose only content is a
link.

**Guardrail: a reference always hangs off something.** If a labelled backtrace can exist with no
parent, the app has grown a list of saved links — which is pinning with extra steps, and the
whole objection to pinning was that it becomes a second, worse message history. Attached to a
note or a quest it is context for that thing; floating free it is a pin.

On the name: *backtrace* already means a stack trace in programming, so the schema and code use
**reference** (the edge) and **backlinks** (the reverse query). The UI can say whatever reads
best.

**Scratchpads** fall out of the same primitive: a scratchpad is a note anchored at a position in
the log, and the anchor is just a reference. Deferred until T-24 exists; do not build it as a
separate entity.

#### Why notes and quests stay separate tables

"Notes are like tasks that never complete" pulls toward one table with a `kind` flag. Resist it.
Different lifecycles (done vs. stale), different fields (due/priority/status vs. none), different
UI (a status list vs. lookup by title). Merging them produces something where neither is fast —
which is the existing complaint about the quest list. Share the **scope model** and the
**reference table**; keep the rows apart.

#### Decided by the owner, 2026-09-06

- **Notes are shaped like quests** — name plus content, listed as items — but they never
  complete, and they get a visually distinct style so the two are not confused at a glance.
- **If a note is a text box, something has gone wrong.** The notes pane is a list of small
  titled things, not a document editor. This is the guardrail for T-07.
- **Note changes post to the duck's message log**: added, removed, and modified — the same
  treatment quest status changes already get.
- **No message pinning.** Settled.
- **Backtracing is wanted**, allowed on any durable thing, with an optional link title.

The logging decision constrains the save model: "modified" can only be logged if edits are
committed deliberately, by an explicit save or a very long debounce. A short autosave would
fill the log with a system message per keystroke burst. **T-07 therefore keeps a save action
rather than the quiet autosave originally sketched.**

#### Still open

1. Do notes get the same nullable scope as quests in T-08 (duck / badling / global)?
   *Recommended: yes — "how to get on the VPN" belongs to no single duck.*
2. Is staleness explicit (a retired flag, a last-verified date) or is deleting enough?
   *Recommended: deleting is enough to start. `updatedOn` plus search answers "is this still
   true?" without inventing a review workflow nobody will run.*
3. Plain text or rich? *Recommended: plain, rendered as markdown once T-17 lands, so notes and
   messages render through one path. The motivating example is a shell snippet, so code blocks
   matter more than formatting.*

### Where a "project" fits

Also unsettled, and it decides how much T-08 has to carry. The existing hierarchy already has
the shape, with no new entity needed:

```
badling   category / space     Work, Personal, Side projects
duck      project or topic     has its own chat, notes, tasks
quest     task                 subquests for smaller decomposition
```

**Rule of thumb: if it deserves its own conversation, it is a duck; if it does not, it is a
quest with subquests.** A three-step project does not need a chat log, so it stays a quest and
never crowds the sidebar. A project that has grown a real history gets promoted to a duck.

The alternative considered — one "Projects" duck whose quests are each a project — **does not
work.** A quest cannot hold a chat log or notes, so a project modelled that way hits a wall the
moment it needs either. Worth adding later: a way to promote a quest into its own duck, carrying
its subquests across.

---

### Where a loose task lives

"Make snack box for office coworkers" is not a project, has no conversation, and needs no duck.

**It binds to the badling.** T-08's scope model already expresses this, and no new concept is
needed — the same rule as projects, applied one level down:

| Scope | Means | Example |
|---|---|---|
| duck | belongs to this project or topic | "fix the attachment encoding" |
| badling | belongs to this area of life, nothing narrower | "make snack box for coworkers" (Work) |
| global | belongs to nothing | "buy milk" |

**A "general" duck per badling is the wrong default.** A duck's reason to exist is a
conversation; a general duck is one auto-created for tasks that explicitly do not want one, and
it becomes the junk drawer every `#general` becomes. Nothing stops the owner *choosing* to make
a duck called "general" for loose work chat — that is a normal duck, created because there is
talking to do. The app should not create one on your behalf.

This is the same rule again: **if it deserves its own conversation, it is a duck.** A snack box
does not. If it grows one, it was never a loose task.

**Notes for a loose task** follow the same scoping — "office snack preferences: Sarah is
gluten-free" is reference material for Work, so a badling-scoped note. This is the argument that
settles open question 1 in the brief: notes need the same three-level scope as quests, or
knowledge that belongs to an area of life has nowhere to live. **Confirm before building T-07.**

#### The consequence to decide with it

Quest status changes currently post a system message to the duck's log
([`quests/+server.ts:74-85`](../src/routes/quests/+server.ts#L74-L85)). **A badling-scoped or
global quest has no duck log to post into**, and T-27 raises exactly the same problem for notes.
Decide once, for both:

1. *No system message when there is no duck log.* **Recommended.** The system message exists to
   weave activity into a conversation; with no conversation there is nothing to weave. Ticking
   off a snack box does not need an audit trail.
2. Give badlings their own log — which is a general duck by another name, and reintroduces what
   was just rejected.
3. Send them to a global system log, alongside the existing "Server started" messages
   ([`system.ts`](../src/lib/system.ts)).

Option 1 means the badling view has no activity feed. That is fine for loose tasks and is the
honest consequence of them being loose.

#### What this requires of the UI

The badling view (`/g/[badling]` in T-11) has to be a real destination, not a folder in the
sidebar: its own loose quests and notes, plus a rollup of the quests in its ducks. Without it,
badling-scoped items are unreachable — created and then lost.

---

### [ ] T-07 — Make notes a real entity instead of one blob per duck

> **UI prototyped 2026-09-07, in memory only.** [`Notes.svelte`](../src/lib/components/Notes.svelte)
> is the design spike: a list of titled items, click one to edit it in place, backed by
> [`$lib/notes.ts`](../src/lib/notes.ts) — a `Map` that is wiped on reload and seeds every duck
> with two examples. `Note` in [`types.ts`](../src/lib/types.ts) gained `title`, `created` and
> `modified`. **No database work, no migration, no endpoint.** What remains for T-07 is the
> persistence underneath, and the existing `/notes` endpoint is now stale and unused.
>
> Settled by the spike:
> - **In place, not a modal.** The quest panel beside it already drills down with breadcrumbs;
>   a modal would make two sibling panels answer the same gesture differently.
> - **Closing the note is the save.** No save button, no per-keystroke autosave. Cmd/Ctrl-S
>   commits without closing, Escape closes, and a 15s idle timer catches an abandoned edit.
>   `modified` is only touched when the content actually changed, so open-and-close is free.
>   This is what makes one discrete log event per edit possible (T-27).
> - List shows title and date only. No content preview — the title is the lookup key, and a
>   preview is the first step back toward a document.
> - Delete lives in the open note, not on the row: one action once you are in, and no
>   hover-only control on every list item (T-12).
> - Monospace content area, because the content is usually a snippet.
> - A filter box appears once there is more than one note.
>
> Still to decide: sort order is most-recently-touched first, which suits "the one I just made"
> but not "find the one called *start command*" once there are twenty — alphabetical may be the
> better default. And `modified` is implemented, but whether it earns its place in the UI is
> still open.

**Priority:** high · **Blocked by:** the design brief above (and coordinate with T-11, which
moves notes into their own route)

**Files:** [`src/routes/notes/+server.ts`](../src/routes/notes/+server.ts),
[`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L62-L67),
[`src/lib/types.ts`](../src/lib/types.ts),
[`src/lib/components/Notes.svelte`](../src/lib/components/Notes.svelte),
[`src/lib/api.ts`](../src/lib/api.ts), a Drizzle migration

**Problem:** There is exactly one `notes` row per duck and `POST` overwrites the entire blob
([`notes/+server.ts:26-29`](../src/routes/notes/+server.ts#L26-L29)). No title, no multiple
notes, no timestamps, no history, no search, no autosave — and it permanently occupies half the
window width. It is a scratchpad nailed to the side of a chat, with no relationship to the
messages or quests around it.

**Acceptance criteria:**
- Schema: `title`, `content`, `createdOn`, `updatedOn`, and the scope decided in the design
  brief (recommended: same nullable duck / badling / global model as T-08).
- **A list of small titled items, not a text box.** Structurally the quest list — name plus
  content, browsable by title, because the title is a lookup key: optimise for "find the one
  called *start command*", not for reading top to bottom.
- **Visually distinct from quests.** Same shape, different style; the two must not be confused
  at a glance. No status pill, no due date, no completion affordance anywhere on a note.
- **No completion state.** Notes are true or stale; deleting is the normal end of life and must
  be one action, not buried.
- Content renders code legibly — the motivating example is a shell snippet.
- **Deliberate save**, not quiet autosave: either an explicit save action or a very long
  debounce, because every commit writes a system message (T-27) and a short autosave would spam
  the log. Keep the ⌘S/Ctrl-S handler and show a clear unsaved state.
- Creating a note is one action from wherever you are — no dialog, no required parent.
- Migration folds each existing single blob into one titled note per duck without data loss.

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

### [ ] T-27 — Note activity in the message log

**Priority:** medium · **Blocked by:** T-07

**Files:** [`src/routes/notes/+server.ts`](../src/routes/notes/+server.ts),
[`src/lib/system.ts`](../src/lib/system.ts)

**Problem:** Notes change silently. The duck's log already records quest status changes as
system messages, so the log is a partial history of the duck — notes being absent from it is an
inconsistency, and it means nothing tells you a note you rely on was edited or deleted.

**Acceptance criteria:**
- Creating, deleting, and committing an edit to a note each post a system message to the duck's
  log, styled like the existing quest-status entries.
- One message per deliberate save, never per keystroke — this is why T-07 keeps an explicit save
  or a long debounce.
- The message references the note (T-24 once it exists), so the log entry is followable.
- A deleted note's log entries survive the deletion and still say what was removed. The log is
  the history; do not cascade it away.
- Notes with global or badling scope have no duck log to post into. This is the same question
  quests face — see *The consequence to decide with it* under *Where a loose task lives*.
  **Answer it once for both**, in T-08, and follow that answer here.

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

**Problem:** The list is cumbersome to operate:
- No edit and no delete — `PATCH` only accepts a status change
  ([`quests/+server.ts:61`](../src/routes/quests/+server.ts#L61)); there is no `DELETE`.
- The only creation path is a modal.
- The status dropdown is `opacity: 0; visibility: hidden` until hover
  ([`Quests.svelte:283-284`](../src/lib/components/Quests.svelte#L283-L284)) — unusable on touch.
- The due date is also hover-only ([`Quests.svelte:244-250`](../src/lib/components/Quests.svelte#L244-L250)).
- Sub-quests are reachable only by clicking the count badge, and that badge **replaces** the
  status icon ([`Quests.svelte:111-114`](../src/lib/components/Quests.svelte#L111-L114)) — a
  quest with children shows no status at all.
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

### [ ] T-13 — Authenticate every endpoint

**Priority:** critical · **Blocked by:** none

**Files:** [`src/hooks.server.ts`](../src/hooks.server.ts), all of `src/routes/*/+server.ts`,
[`src/lib/api.ts`](../src/lib/api.ts)

**Problem:** Only `GET /ducks` validates a session
([`ducks/+server.ts:8-15`](../src/routes/ducks/+server.ts#L8-L15)). `/messages`, `/notes`,
`/quests`, `/attachments`, `/import`, `POST /ducks`, and `POST /badlings` are **unauthenticated** —
and this is deployed on port 80. `/import` in particular accepts arbitrary bulk writes.

**Acceptance criteria:**
- Session validation moves into `hooks.server.ts` as a single guard covering every route
  except `/login`, populating `event.locals`.
- Per-route ad-hoc header checks are removed in favour of the guard.
- The session is read consistently. Today it travels three ways: a `Session` header from
  [`Sidebar.svelte`](../src/routes/Sidebar.svelte#L73), a `session` field in the `/qna` body
  ([`api.ts:70`](../src/lib/api.ts#L70)), and a cookie everywhere else. Standardise on an
  httpOnly cookie and delete `getCookie` from `api.ts`.

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

**Files:** [`src/routes/messages/+server.ts`](../src/routes/messages/+server.ts)

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

### [ ] T-16 — Implement infinite scroll

**Priority:** medium · **Blocked by:** none (but see T-15)

**Files:** [`src/lib/components/Chat.svelte`](../src/lib/components/Chat.svelte)

**Problem:** There is no way to see older messages; only the most recent 10 ever load. The
original attempt was deleted during the frontend split rather than transplanted — it listened on
`window` (which never scrolls here, the scroller is the chatbox) and its condition was inverted,
so it was unreachable dead code. This is a fresh implementation.

`GET /messages` already accepts `?offset=`, and `fetchMessages(duck, offset)` in
[`api.ts`](../src/lib/api.ts) already passes it — the server side is ready. Do T-15 first, or
paginating will duplicate every AI answer.

**Acceptance criteria:**
- Listener on the `chatbox` element, firing when scrolled near the **top** (older messages).
- Scroll position is preserved when older messages are prepended — naive prepending jumps the view.
- A `loading` guard that actually prevents overlapping fetches (`Chat.svelte` already has the
  flag and renders the indicator; it is currently only used for the initial load).

---

### [ ] T-17 — Replace the regex markdown renderer

**Priority:** medium · **Blocked by:** none

**Files:** [`src/lib/markdown.ts`](../src/lib/markdown.ts),
[`src/lib/components/Message.svelte`](../src/lib/components/Message.svelte)

**Problem:** Message content is emitted with `{@html message.content}` — **unescaped** — and
then an action reads `node.innerHTML`, runs eight sequential regex replacements over it, and
writes it back ([`markdown.ts:84-137`](../src/lib/markdown.ts#L84-L137)). This is an XSS hole on
your own stored data, it re-parses the whole subtree once per replacement, and it corrupts any
content containing HTML-significant characters. The `replaceAsync` helper is annotated
`// idk what this does, but it works`.

**Acceptance criteria:**
- A real markdown library (e.g. `marked`) plus a sanitiser, producing HTML from the **source
  string** — never by rewriting rendered `innerHTML`.
- Code highlighting integrates via the markdown renderer, letting the hardcoded 13-case
  language `switch` ([`markdown.ts:11`](../src/lib/markdown.ts#L11)) be deleted.
- Existing custom syntax is preserved: `||spoilers||` and bare-URL autolinking.
- Escaping works — there is currently no way to write a literal `**` or backtick.
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
2. **Settle the W3 design brief** — costs nothing to decide, and T-07 cannot start without it.
3. **T-08 → T-09** — task schema. Unblocks everything task-shaped; do it before building task UI.
4. **T-11** — route split. Unblocks mobile and makes notes/tasks first-class.
5. **T-07, T-10, T-12** — the UX work, now that the foundations hold.
6. **T-24, T-25** — the reference table, then distilling notes from the log. These are what
   make notes stop feeling bolted on, but they need T-07 and T-08 underneath first.
7. **T-27** — note activity in the log, once notes exist and can be referenced.
8. **T-26** — message search. Independent of all the above and can be pulled earlier; it is the
   thing that turns the log into something you can look things up in, and the design brief
   leans on it existing.
9. **T-15 → T-16**, then the rest of W6, opportunistically.

T-05, T-22 (attachment storage) and T-17 (markdown) are deferrable without blocking anything.
