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

### [ ] T-07 — Make notes a real entity instead of one blob per duck

**Priority:** high · **Blocked by:** none (but coordinate with T-11, which moves it into its own route)

**Files:** [`src/routes/notes/+server.ts`](../src/routes/notes/+server.ts),
[`src/lib/db/schema.ts`](../src/lib/db/schema.ts#L62-L67),
[`src/lib/types.ts`](../src/lib/types.ts),
[`src/lib/components/Notes.svelte`](../src/lib/components/Notes.svelte)

**Problem:** "Notes feels totally tacked on" is structurally accurate. There is exactly one
`notes` row per duck; `POST` overwrites the entire blob
([`notes/+server.ts:26-29`](../src/routes/notes/+server.ts#L26-L29)). No title, no multiple
notes, no timestamps, no history, no search, no autosave — and it permanently occupies half the
window width. It has no relationship to messages or quests.

**Acceptance criteria:**
- Schema: `title`, `createdOn`, `updatedOn`; many notes per duck.
- List + open + create + delete; the note list is scoped to the duck.
- Autosave (debounced) replacing the manual disabled-until-dirty Save button
  ([`Notes.svelte:55`](../src/lib/components/Notes.svelte#L55)), with a visible saved/unsaved
  indicator. Keep the ⌘S/Ctrl-S handler.
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
2. **T-08 → T-09** — task schema. Unblocks everything task-shaped; do it before building task UI.
3. **T-11** — route split. Unblocks mobile and makes notes/tasks first-class.
4. **T-07, T-10, T-12** — the UX work, now that the foundations hold.
5. **T-15 → T-16**, then the rest of W6, opportunistically.

T-05, T-22 (attachment storage) and T-17 (markdown) are deferrable without blocking anything.
