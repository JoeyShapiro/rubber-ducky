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

## Suggested order

What's left is three independent tasks — pick any order:

- **T-24** — the reference table (backtracing, note↔quest links, scratchpads).
- **T-26** — message search. The log has been write-only until this exists.
- **T-05** — attachment storage cleanup. Deferrable without blocking anything.
