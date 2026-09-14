# rubber-ducky — reference notes

Background for anyone (human or agent) working on this codebase. Read this before picking up a
task from [PLAN.md](PLAN.md), so you do not re-litigate a settled choice or rediscover a trap.

Nothing here is a task. Open work lives in [PLAN.md](PLAN.md).

---

## Architecture

SvelteKit 2 / Svelte 4, Postgres via Drizzle, Bootstrap 5 from CDN, optional Ollama for
embeddings and Q&A. Deployed as a single Node container on port 80.

The application is **one route, deliberately** (2026-09-14, see decisions log — a route split
was considered and dropped; no deep-linking need, and mobile doesn't require it either).
[`Sidebar.svelte`](../src/routes/Sidebar.svelte) selects a duck or a badling and writes it into a
`writable` store ([`$lib/stores.ts`](../src/lib/stores.ts)); each panel component loads its own
data when that scope changes.

### Data model

```
badlings (groups - and a scope in their own right, not just a folder)
  └── ducks (channels)
messages, notes, quests: parent_id -> a duck's or a badling's uuid, never both, never neither
  ├── messages ──── attachments
  ├── notes      (title + content, no completion state)
  └── quests     (self-referencing parent via quest_parent_id)
answers (AI responses — no FK to anything, merged into message lists by timestamp)
```

**The single most consequential constraint:** every child table has `parent_id` `NOT NULL`
([`schema.ts`](../src/lib/db/schema.ts)). Nothing can exist outside a duck or a badling — a
global, scopeless list was considered and decided against (2026-09-14).

### Frontend layout

```
src/lib/
  stores.ts              scope (a Duck or a Badling), mobileView, hidden, darkMode, messages
  api.ts                 every fetch to our own endpoints, plus one shared 401 handler
  markdown.ts            renderMarkdown + enhanceMarkdown - the one markdown path
  attachments.ts         reading the three attachment encodings; shared by both endpoints
  format.ts              formatDate
  quests.ts              status list, labels, css classes, svg icons
  types.ts               Attachment / Message / Note / Quest / Duck / Badling / Scope
  components/
    Chat.svelte          left column: message list + composer, owns loading and scroll
    Message.svelte       one message, system or normal, with its attachments
    Composer.svelte      textarea, attachments, paste, submit, the qna toggle
    Notes.svelte         the notes pane: titled items, opened in place
    Quests.svelte        breadcrumbs + quest list
    QuestModal.svelte    create/edit quest dialog
    ConfirmDialog.svelte reusable destructive-action confirm
    MobileTopBar.svelte  mobile-only back-arrow bar - see "Mobile: four drawers" below
src/routes/
  +page.svelte           layout only - two columns, passes $scope down
```

Rules of thumb for anyone adding to this:

- **Components own their own data loading**, keyed on the `scope` prop (a `Duck` or a `Badling` -
  see `$lib/types.ts`). That is deliberate — each panel stands alone regardless of what is
  selected, which is also why a route split was easy to decide against: there was nothing to
  restructure to get there.
- **No component calls `fetch` directly.** Add a function to `api.ts` instead, so 401 handling
  and error shape stay in one place.
- **Cross-panel state goes in `stores.ts`.** Today that is only `messages`, which both the
  composer and the quest list append to.

### Mobile: four drawers

Below 768px the desktop's two/three columns become four full-screen "drawers" — sidebar, chat,
notes, quests — Discord-style, but client state rather than a route (2026-09-14; a route split
was considered and dropped, see decisions log). `mobileView` (`$lib/stores.ts`) holds which one is
showing. Navigation is a small stack, not a flat set of tabs: sidebar → chat is the only way in,
chat → {notes, quests} branches off it, and back always retraces one step (notes/quests → chat →
sidebar), never straight to sidebar from notes/quests.

The mechanism is two attributes, not per-component conditionals:
- Each screen's own root element carries `data-screen="sidebar" | "chat" | "notes" | "quests"`
  (`Sidebar.svelte`, `Chat.svelte`, `Notes.svelte`, `Quests.svelte`).
- `.app` (`+layout.svelte`) carries `data-mobile-view` set to the current `$mobileView`.
- `app.css`'s media query hides every `[data-screen]` by default and re-shows only the one
  matching `[data-mobile-view]`, full width and `100dvh`.

`MobileTopBar.svelte` is the back-arrow bar shown on chat (back → sidebar, plus notes/quests
icons on the right) and on notes/quests (back → chat); the sidebar has no top bar of its own —
its existing bottom icon row is what you use instead, made always-visible rather than
hover-reveal for the same reason (see below). A component always renders its `MobileTopBar`; it
just has no width on desktop, since `.mobile-topbar` is `display: none` above the breakpoint.

This first pass is deliberately not polished — see PLAN.md T-12 for what's still open.

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

## Notes, quests and links: the model

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

#### Still open

1. Is staleness explicit (a retired flag, a last-verified date) or is deleting enough?
   *Recommended: deleting is enough. `updatedOn` plus search answers "is this still true?" without
   inventing a review workflow nobody will run.*

*(Settled since: notes are shaped like quests and never a text box; create/delete/save post to the
duck log; no message pinning; backtracing wanted with optional labels; scope is duck-or-badling,
no global (2026-09-14); plain text rendered as markdown. All in the decisions log below.)*

### Where a "project" fits

The existing hierarchy already has the shape, with no new entity needed:

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

**It binds to the badling.** The duck-or-badling scope model already expresses this, and no new concept is
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

The badling view has to be a real destination, not a folder in the sidebar: its own loose quests
and notes, plus a rollup of the quests in its ducks. **Landed 2026-09-14** — clicking a badling in
the sidebar loads it as a scope with its own chat/notes/quests, same as a duck (see decisions
log). Still open: a rollup of the quests/notes in its ducks — today a badling's items are its
own, separate from its ducks' items.

---

---

## Item styling: stream vs list

Messages, notes and quests share one material and differ by **elevation only**. Before this they
differed on five unplanned axes at once — four radius/shadow combinations, three timestamp
positions, two stripe conventions — which read as inconsistency rather than hierarchy.

| | treatment |
|---|---|
| message | **raised**: own card on a graded surface, roomy padding, timestamp in the bottom-right corner |
| system log | in the stream but subordinate: same geometry, no elevation, monospace + `◈` + status stripe |
| note | **flat row** cut into the panel: title, right-aligned date |
| quest | **flat row**: status icon, title, right-aligned due date |

The shared values are tokens in `app.css` — `--item-raised`, `--item-hairline`, `--item-radius`,
`--row-radius`, `--row-hover`, `--meta-color` — plus the `.panel-row` / `.panel-title` / `.meta`
classes that notes and quests both use. Change the material in one place, not three.

**Depth comes from the background, not from shadows.** The cards cast none; `.app-surface` is a
vertical gradient (`--surface-top` → `--surface-bottom`) and the raised cards read against that
darkening. Bootstrap's `.bg-gradient` was a near-invisible white wash over a flat colour, which
left the whole pane looking flat and made the cards need a shadow to separate at all.

**The message card is no longer Bootstrap's `.toast`.** That component pinned it to 350px and
brought its own colours, which is why messages could never match anything else. The silhouette is
unchanged; the CSS is ours. The corner timestamp is the deliberate signature — it is what made the
original feel like a journal rather than a chat bubble, so it stayed and the rest was built around
it.

**Direction of the merge matters:** notes and quests were pulled toward messages, not the reverse.

---

## Decisions log

Choices already made, so later work does not re-open them.

| Date | Area | Decision |
|------|------|----------|
| 2026-08-31 | attachments | Canonical shape: `type` = bare MIME (`image/png`), `content` = full data URL, `name` never empty. Files with no MIME become `application/octet-stream`; nameless clipboard files get `pasted-<ts>.<ext>`. |
| 2026-08-31 | attachments | `Attachment.fromFile` is the only sanctioned way to build an attachment from a file. New entry points must use it rather than reading a `File` themselves. |
| 2026-08-31 | attachments | Read all three legacy encodings rather than migrating the data. Reading is reversible; a migration (T-22) can follow once the endpoints are known good. |
| 2026-08-31 | attachments | `POST /attachments` validates the canonical shape and 400s otherwise. The invariant is enforced at the write boundary. |
| 2026-08-31 | frontend | Components own their data loading (keyed on the `duck` prop, now `scope`) rather than a parent orchestrating fetches. Kept each panel standalone regardless of what's selected. |
| 2026-08-31 | frontend | `messages` is a store; notes and quests are component-local. Only messages is written by more than one panel (composer + quest status changes), so only it needs to be shared. |
| 2026-08-31 | frontend | All endpoint calls go through `api.ts`. Ad-hoc `fetch` in a component is the thing that let six copies of broken 401 handling drift apart. |
| 2026-08-31 | frontend | Did **not** split routes during the component extraction, deliberately leaving that decision for later. **Settled 2026-09-14: it stays one route** — see decisions log. |
| 2026-09-05 | attachments | `GET /messages` returns attachment metadata only, never bytes. Keeps a page of messages small and lets the browser cache bytes per uuid. |
| 2026-09-05 | attachments | Encoding knowledge lives in `$lib/attachments.ts`, not in a route. Two endpoints need it; T-22's migration will too. |
| 2026-09-05 | ui | The remove button on a staged attachment is always visible, not revealed on hover. Hover-only controls are exactly what makes the current UI unusable on touch (T-12). |
| 2026-09-05 | messages | A message may have empty text if it carries attachments. `POST /messages` skips embedding when there is no text, rather than embedding an empty string. |
| 2026-09-06 | notes | A note is something currently *true*, not something done. Lifecycle is true → stale, with no completion state; deleting is the normal end of life. |
| 2026-09-09 | notes | Deleting a note is confirmed, despite being the normal end of life. Notes are near-permanent by design with no undo and no history, so "one action, not buried" means reachable — not unguarded. |
| 2026-09-09 | notes | Notes render as a read-only markdown document by default; Edit switches to the raw editor. Read-first suits read-many/write-few, keeps the rendered view clean, and makes each edit a discrete event. Chosen over live preview. |
| 2026-09-13 | data | Data fix-ups go in a drizzle migration, not a hand-run script. `entrypoint.sh` migrates on every container start, so production is corrected by deploying; a script only helps if someone remembers it. |
| 2026-09-13 | config | The database host stays hardcoded. Production is a single container talking to its own postgres on localhost, and the dev setup matches it — parameterising it would add configuration nobody sets. |
| 2026-09-13 | ui | Interactive widgets are Svelte state, not Bootstrap JS. The collapse was the last holdout and its data-attribute targeting was the bug; Bootstrap is a stylesheet here now, nothing more. |
| 2026-09-13 | composer | Shift+Enter switches the message into **multiline mode** rather than just inserting a newline: Enter then makes newlines and only a second Enter **at the end** sends. Double-Enter mid-message stays a blank line — stealing that would be worse than the problem this solves. Mode resets after sending. |
| 2026-09-13 | auth | Sessions expire hard — no sliding renewal. Re-authenticating silently defeats the point of an expiry, so the app returns you to the login screen; the cost of that (a lost draft) is paid off by `$lib/drafts.ts` instead. |
| 2026-09-13 | theming | Any translucent **white** surface has to be themed. `rgba(248,248,255,0.4)` reads as a soft wash over a light page and as a **mid-grey** over a dark one — that is what made the notes panel unreadable (note date measured 1.99:1). Panels use `--panel-surface`, which is near-white in light and `rgba(255,255,255,0.055)` in dark. |
| 2026-09-13 | theming | Muted greys picked by eye fail on one side or the other: the dark ones were tuned against the accidental mid-grey, and the light ones sat at 3.8:1 on white. `--meta-color` and the code-label greys are now measured values, ≥4.5:1 in both themes. |
| 2026-09-13 | logging | Entries read as sentences: `Quest <path> was created`, `Quest <path> is completed`, `Note <title> was removed`. No quotes, no arrow. The **trailing word stays load-bearing** — `Message.svelte` colours entries by it — so any new phrase must end on created/added/modified/removed or a status. |
| 2026-09-13 | logging | A quest logs its **full path** (`top / middle / this one`), walked server-side from `questParentId` rather than taken from the client's title. |
| 2026-09-13 | quests | New quests start **inactive**. A quest exists before you decide to work on it; `active` is something you opt into. |
| 2026-09-13 | messages | A message's bottom-left corner is reserved for status/errors (`Message.error`), mirroring the timestamp's bottom-right — same size, same placement, red instead of muted. Any future per-message status belongs in that one slot, not a new corner. |
| 2026-09-13 | attachments | A failed (never-uploaded) attachment shows only its name and mime type, never its content. `Attachment.failed` is set in the same step as clearing `.content` — a data URL is arbitrarily large and there is no reason to keep one that is not going anywhere. |
| 2026-09-13 | attachments | No per-attachment upload-progress indicator and no retry (T-23's original acceptance criteria, dropped). This app has one user on one connection who does not expect to send large files — anything that big goes on a thumb drive instead. Retry is retype-and-resend by hand. |
| 2026-09-10 | logging | `postSystemMessage` is the only thing that writes a system entry, and it returns the message so the client can append it without refetching. A failed log never fails the action that caused it. |
| 2026-09-10 | logging | Creating an empty note logs nothing; its first save logs `added`. Otherwise the log announces an Untitled note before anything is typed. |
| 2026-09-12 | chat | Loading older messages is driven by an **IntersectionObserver on a sentinel** above the first message, not a scroll handler. A scroll handler fires continuously and re-triggers mid-fetch, which is how one flick pulled the whole log. The observer reports *transitions*, so `loadOlder` re-observes the sentinel afterwards — otherwise a page that does not fill the viewport never gets a second callback. |
| 2026-09-12 | chat | `#chatbox` sets `overflow-anchor: none` and restores the scroll offset itself, measuring **immediately before the splice** (never before the fetch — the reader keeps scrolling while it is in flight). Do not rely on native scroll anchoring: Chrome does it, **Safari does not do it at all**, and building on it meant the feature only worked in one browser. |
| 2026-09-11 | markdown | One renderer for everything. System log entries are the exception: generated, so rendered as plain text with no `{@html}`. |
| 2026-09-11 | markdown | hljs token colours live in `app.css`, not an imported hljs theme — those are built for a single background and this app has two. |
| 2026-09-10 | markdown | `renderMarkdown()` = marked + DOMPurify, parsing the **source string**. Never regex over rendered html. DOMPurify is not optional: marked passes `<script>` through untouched by design. |
| 2026-09-09 | ui | Destructive confirms use `ConfirmDialog.svelte`: Cancel holds focus, Escape and backdrop cancel, and Cancel sits where the triggering button was so a double click lands on the safe option. (Quest delete never happened — see 2026-09-14: `aborted` is the delete equivalent — but this remains the pattern for any future destructive confirm.) |
| 2026-09-06 | notes | Notes are shaped like quests — name plus content, listed as items — with a visually distinct style. **If a note is a text box, something has gone wrong.** |
| 2026-09-06 | notes | The title is a lookup key, not a headline. Optimise for "find the one called *start command*", not for reading top to bottom. |
| 2026-09-06 | notes | Notes are the residue of work, distilled at the end. Continuous capture is what the message log is for; "tried X, didn't work" is a message, not a note. |
| 2026-09-06 | notes | Note create / delete / save each post a system message to the duck log. This is why notes keep a deliberate save rather than quiet autosave — short autosave would spam the log. |
| 2026-09-06 | links | **No message pinning**, ever. A pin list becomes a second, worse message history and is redundant once search exists. |
| 2026-09-06 | links | Backtracing, note↔quest, and message citation are one primitive: a `references` row with kind+id on each end and an optional label. Not four features. |
| 2026-09-06 | links | A reference always has a source — no free-floating saved links, which would be pinning with extra steps. |
| 2026-09-06 | links | Code and schema say `reference` / `backlinks`; `backtrace` already means a stack trace elsewhere. UI wording is free. |
| 2026-09-06 | model | Notes and quests stay separate tables despite the similar shape. Different lifecycles, fields, and UI; merging produces something where neither is fast. They share the scope model and the reference table. |
| 2026-09-14 | model | `messages`, `notes`, and `quests` take a single `parent_id` — a duck's or a badling's uuid, never both — instead of a duck-only FK. No `scopeType` discriminator column and no foreign key: a column can't reference two tables, both ends are `defaultRandom()` uuids from disjoint tables so collision isn't a real risk, and every caller already knows which kind of id it is holding (it just fetched the duck or badling it is now asking about). Deleting a duck or badling has to clean up its own rows by hand — there is no cascade to lean on. |
| 2026-09-14 | model | Badlings are a first-class scope now, not just a folder of ducks: clicking one in the sidebar loads it the same way a duck does, with its own chat log, notes, and quests. This is a deliberate, narrow exception to "if it deserves its own conversation, it is a duck" (see *Where a loose task lives*) — a badling is still not a general-purpose duck substitute, but it gets a light log of its own rather than forcing every loose thing into a manufactured "general" duck. It also resolves *the consequence to decide with it*, below: every scope now has a log to post a status-change system message into, so the "no duck log" case that option 1 was written for no longer exists. |
| 2026-09-14 | model | **No global scope, decided against** (T-28 dropped). `messages`, `notes`, and `quests` stay `parent_id NOT NULL` — a duck or a badling, always, never neither. "Buy milk" still needs a badling. If an all-up view is wanted later (e.g. clicking "Ducks" opens a home page), it reads *across* the existing per-duck / per-badling scopes rather than adding a third, scopeless one. |
| 2026-09-14 | quests | **No quest delete, decided against** (dropped from T-10). `aborted` is the delete equivalent — a quest that didn't happen is marked aborted, not removed. `PATCH /quests` gained a second mode instead: sending `title` (no `status`) edits the quest's own content and logs `was modified`, the same phrase notes use for the same thing. |
| 2026-09-14 | quests | Editing opens the same `QuestModal` used to create one, pre-filled via an optional `quest` prop, header and button text swapping to "Edit …" / "Save". One form for both, rather than a second edit-only component. |
| 2026-09-14 | frontend | **No route split, decided against** (T-11 dropped). Ids in the URL buy deep-linking, refresh-safety, and real browser back/forward — genuine, but nobody asked for them on a single-user local app, and dropping them removes a real cost: two ids (duck, badling) sharing one url space would need a lookup per page load just to know which table an id belongs to. Stays one route, scope kept in the `writable` store, restored via the `lastScope` cookie. Reversible later if a real need shows up — nothing here forecloses it. |
| 2026-09-14 | frontend | Mobile does **not** need the route split either. What T-11 would have solved for mobile (only one of chat/notes/tasks visible at a time on a narrow screen) is client-side state, same mechanism as the sidebar's badling/duck selection — no URL segment required. (Landed as a back-arrow drawer stack, not a bottom tab bar — see the next entries.) |
| 2026-09-14 | frontend | Mobile navigation is a **stack, not four flat tabs**: sidebar → chat → {notes, quests}, back always retraces one step. A tab bar would suggest notes and quests are peers of chat rather than views *of* it, and would need its own "which of four am I in" state; the stack instead reuses the same back-button idea already familiar from every other app, and each screen only needs to know the one screen behind it (`MobileTopBar`'s `backTo` prop). |
| 2026-09-14 | frontend | The four mobile screens are toggled by two DOM attributes, not per-component `{#if}` conditionals: each screen's root carries `data-screen="sidebar｜chat｜notes｜quests"`, `.app` carries `data-mobile-view` (from the `mobileView` store), and one `app.css` media query does the hiding. Keeps the show/hide logic in one place instead of four components each re-deriving it, and costs nothing on desktop, where the whole media query is inert. |
| 2026-09-14 | frontend | `MobileTopBar.svelte` always renders (one instance per chat/notes/quests component) rather than being conditionally mounted - it is simply `display: none` above the breakpoint. Simpler than mounting/unmounting on resize, and there is nothing stateful in it to reset. |
| 2026-09-14 | mobile | **Bug caught on a real device, not a resized desktop browser:** `mobileView` defaults to `'sidebar'`, and `app.css` hides `<main>` whenever it does, on the assumption `<Sidebar>` is showing instead. True everywhere except `/login`, which renders no `<Sidebar>` and has its whole form inside `<main>` - the login screen went **completely blank**. Fix: `+layout.svelte` only stamps `data-mobile-view` onto `.app` off the login route (`isLogin ? undefined : $mobileView`), so the whole drawer mechanism is inert there rather than special-cased per rule. **Testing note:** a Chromium window resized to 390px never caught this - it needs real WebKit plus an actual device profile (`playwright`'s `devices['iPhone 14']`: correct `deviceScaleFactor`, mobile UA, touch) to reproduce browser-specific and viewport-specific bugs. Default to that, not a resized desktop window, for any further mobile verification. |

---

## Completed

What has been finished and what actually changed. Kept because the *why* is often not obvious
from the diff.

### 2026-09-13 — T-23: a message now says when it failed to send

Three silent failures got a visible one. A message's bottom-**right** corner has always been the
timestamp; its bottom-**left** is now the mirror of that — same size and placement, reused for
status and errors, in red. `Message.error` (empty string when there is nothing to report) drives
it.

- **The whole send fails** (`POST /messages` rejects): rather than leaving the text stranded in
  the composer with only a `console.error`, it now renders as a real bubble in the stream with
  `error = 'Failed to send'`, built client-side with a `local-<uuid>` id. The composer clears as
  if it had sent, since the failed bubble is now where that content lives.
- **Some attachments fail after the message sends**: the message posts and shows normally; each
  failed attachment renders inline with a red border, and the bubble's `error` names what
  happened — `Couldn't send "file.png"` for one, `N attachments couldn't send` for several.
- **A file fails to even become an attachment** (unreadable, before anything is sent): red text
  appears in the composer in the same slot as the multiline hint (`twice at the end sends`),
  naming the file(s) that never made the tray.

**A failed attachment shows its name and mime type, never its content.** The first pass rendered
the in-memory data URL so a failed image could still preview — reverted once it was pointed out
that a data URL can be arbitrarily large (T-05 has no client-side size limit yet) and there is no
reason to keep holding a payload that is never going anywhere. `Attachment.failed` is now paired
with clearing `.content` in the same step (`Composer.svelte`'s `markFailed`), so the bytes are
dropped the instant they are known to be dead weight.

All three states are client-only — `Attachment.failed` and `Message.error` are never sent to the
server and never persisted, so a refresh loses them, same as any other front-end-only recovery
of a failure the server was never told about.

**Deliberately not built:** a pending/uploading indicator per attachment, and retry. This is a
single-user tool, not a product with unknown users on unknown connections — see the decisions
log. A failed send or attachment is retried by hand (retype, or re-attach and resend).

### 2026-09-13 — T-15: an AI reply is just a message

`GET /messages` used to fetch a page, then select **every** row from `answers` and append the ones
newer than that page's oldest message. The same answers came back on every page — with three
answers across twenty pages, the newest was returned up to twenty times. The root cause was that
`answers` had no relationship to a duck or a message, so they could only be correlated by
timestamp window.

The reply is now written straight into `messages` with `from = 'ai'`, and the `answers` row keeps
the prompt beside it via a `message_id` foreign key. The whole merge block is deleted: a page is
exactly the page, and AI replies paginate like everything else.

Two follow-on simplifications: `msgs.sort()` became `msgs.reverse()`, since the query already
orders by timestamp; and `Chat.svelte`'s offset stopped filtering out `from === 'ai'` rows — that
filter existed *because* of the merge, and leaving it would have silently skipped messages.

While in there: `answers.promt` is now `prompt`, and the unused `messages` text column is gone.
The import maps the old misspelled field, since exports still carry it. Two migrations rather than
one, because drizzle-kit needs an interactive answer to distinguish a rename from a drop-and-add,
and the table was empty so it made no difference.

Verified across 194 messages and 20 pages: 194 distinct rows, **zero duplicates**, each AI reply
returned exactly once, every page ascending.

### 2026-09-13 — T-19: the sidebar collapse is ours

The collapse targeted `#{badling.name}-collapse`, so a badling called *My Stuff* produced an
invalid selector, one called *2026 goals!* likewise, and two badlings sharing a name collided onto
the same element. It is now local state — a `Set` of collapsed uuids in
[`Sidebar.svelte`](../src/routes/Sidebar.svelte), keyed on what is *closed* so the default is open
with nothing to populate — with Svelte's `slide` transition doing the animation.

**That was the last user of Bootstrap's JavaScript, so the JS import is gone entirely.** The CSS
stays; plenty still depends on it. Verified against exactly the names the task named: *My Stuff*
and *2026 goals!* both collapse and reopen, two badlings named *My Stuff* collapse independently,
no page errors, and still zero off-site requests.

Also removed a `<use xlink:href="#bootstrap">` in the sidebar header — a sprite from a Bootstrap
example that this app never defined, rendering an empty 30×24 box next to "Ducks". It shows the
duck now.

### 2026-09-13 — T-18: bootstrap is a dependency

Bootstrap's CSS and JS were two CDN `<link>`/`<script>` tags inside `Header.svelte`'s `<header>`
element — render-blocking, and broken without internet. Both are now imports in
[`+layout.svelte`](../src/routes/+layout.svelte): the CSS before `app.css` so overrides still win,
and the JS dynamically in `onMount`, since the bundle touches `document` at module scope. Its
data-api is a delegated listener, so arriving after first paint is fine.

`Header.svelte` is deleted. It rendered nothing — its only markup was those two tags plus a
commented-out div, and its three imports were all unused.

The login page also pulled a decorative logo from an MDB CDN, so **the login screen needed the
internet**. It uses the local `duck.svg` now, with the dark-mode SVG invert disabled for it (that
card is white in both themes, so inverting would leave a white duck on white).

Verified: a full page load now makes **zero off-site requests**, Bootstrap's CSS still applies, and
the sidebar collapse — the one thing its JavaScript is for — still works.

### 2026-09-13 — T-14: sessions last four hours, and drafts outlive them

`SESSION_HOURS` (default 4) replaces the one-minute lifetime, and the cookie's expiry is set from
the same value as the database row, so the two cannot drift.

**Expiry deliberately does not renew on activity.** An expired session means logging in again, not
a silent refresh — that is the point of having one. What re-logging-in must not cost you is the
message you were part-way through typing, so [`$lib/drafts.ts`](../src/lib/drafts.ts) keeps it in
`localStorage`, keyed per duck: written debounced as you type, flushed synchronously on `pagehide`
(the last chance before a 401 redirect), restored on load, and cleared once the message sends.

Text only — staged attachments are base64 and would blow the storage quota. Every `localStorage`
access is wrapped, because it throws rather than returning null in private windows and with site
data blocked; a lost draft must never break the composer.

Verified: with a session aged out in the database, an API call 401s, the app lands on `/login`, and
after logging back in the half-written message is still in the box. Drafts stay separate per duck
and the right one is cleared on send.

### 2026-09-13 — T-13: one door, not seven

Every request now passes a single guard in [`hooks.server.ts`](../src/hooks.server.ts). Before
this only `GET /ducks` checked anything — `/messages`, `/notes`, `/quests`, `/attachments`,
`/import`, `POST /ducks` and `POST /badlings` were all open, on a box published to port 80, with
`/import` accepting arbitrary bulk writes.

The session used to travel three different ways: a `Session` header from the sidebar, a `session`
field inside the `/qna` request body, and a cookie everywhere else. It is now one **httpOnly**
cookie, set by the server at login rather than by `document.cookie`, so page scripts cannot read
or forge it. `getCookie` is gone from `api.ts`.

Requests with no matching route (static assets, 404s) and `/login` are public. A request that
wants HTML is redirected to the login page; anything else — which is every API call — gets a flat
401. The guard is skipped while `building`, so prerendering still works.

`secure` on the cookie follows `url.protocol` rather than being hardcoded: this is served over
plain HTTP on a LAN, and a hardcoded `secure: true` would stop the cookie being sent at all.

Verified: all eight endpoints 401 without a cookie, a page request 303s to `/login`, login sets an
HttpOnly cookie and unlocks the API, and a wrong password, a forged uuid and an expired session are
each rejected.

### 2026-09-13 — T-22: one attachment encoding

Migration `0002_normalize_attachment_encodings.sql` collapses the three historical shapes into the
canonical one. It runs wherever migrations run — `entrypoint.sh` calls `run-migrate.ts` on every
container start — so production is fixed by deploying rather than by remembering to run a script.

**No base64 is decoded.** Both legacy shapes turn out to be pure string rearrangements: the old
file-picker rows just have `type` and `content` swapped, and the old paste rows need the two halves
joined and the `data:` prefix stripped off the mime. Rows where the payload was never written match
neither condition and are left alone.

`toCanonical()` in [`$lib/attachments.ts`](../src/lib/attachments.ts) does the same job in TypeScript
on the **import** path, so loading an old Weaviate export cannot put the legacy shapes back into a
table the migration just cleaned. Attachments with no recoverable payload are counted and warned
about rather than silently stored.

Verified: one row of each legacy shape migrated to canonical and still served correct PNG bytes; an
unrecoverable row was left untouched; an import of both legacy shapes landed canonical.

### 2026-09-12 — T-16: loading older messages

Rebuilt from scratch after three failed attempts built on Chrome-only behaviour. Sentinel plus
`IntersectionObserver` rather than a scroll handler, `overflow-anchor: none`, and the scroll offset
restored by measuring immediately before the splice. See the two chat entries in the decisions log
for why each of those is the way it is. Verified in both WebKit and Chromium.

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

Failure surfacing followed later, see T-23 above.

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
