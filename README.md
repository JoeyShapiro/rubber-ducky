# rubber-ducky

A self-hosted, single-user workspace for tracking projects as conversations: post messages,
distill notes, track quests (tasks), and optionally ask a local LLM questions about what's going
on. Built with SvelteKit 2 + Svelte 4, Postgres (pgvector) via Drizzle, Bootstrap 5. Ships as one
Docker image with Postgres bundled inside it.

## Concepts

- **Badling** — a top-level group/workspace.
- **Duck** — a channel within a badling. Everything else is scoped to a duck or a badling.
- **Message** — the log. Plain text, with attachments, posted by `user`, `ai`, or `system`.
- **Note** — something currently true and worth having at hand, looked up by title. Not a
  transcript; deleting one ("tearing" it) folds its content back into the message log rather than
  discarding it.
- **Quest** — a task, with a status (`active`, `inactive`, `completed`, `aborted`, `locked`) and
  optional subquests. A parent quest's status is inferred from its children (active if any child
  is active, otherwise the shared status, otherwise inactive) and can still be overridden by hand.
  `locked` means blocked/pending, not finished — it stays with the open work, not the archive.
- **Attachment** — files/images on a message, stored inline in Postgres as base64.
- **Answer** — the record of an AI Q&A exchange (prompt + reply); the reply itself is also posted
  as an ordinary `ai` message so it appears in the log and pages like everything else.

Every message, note, and quest belongs to exactly one duck or badling (`parent_id`, `NOT NULL`) —
nothing exists outside that scope.

## Features

- Per-duck/badling message log with Markdown rendering, code highlighting, and image/file
  attachments (paste or file picker).
- Notes and quests scoped per duck/badling, with quest hierarchies and automatic status rollup.
- Optional local AI: point it at [Ollama](https://ollama.com) for a `/qna` endpoint (chat-style Q&A
  against a model of your choice) and automatic embeddings (`nomic-embed-text`) on messages and
  notes for future semantic search — embeddings are stored even if Ollama is never configured.
- Single-password auth (this is a single-user app): client-side PBKDF2, server-side pepper +
  Argon2id, no plaintext password ever sent over the wire — safe even without TLS on the app
  itself (see Deployment).
- Per-client login rate limiting (5 failed attempts / 5 minute lockout).
- Responsive layout: two/three columns on desktop, four full-screen drawers (sidebar, chat, notes,
  quests) on mobile.
- Bulk import from a JSON export (`/import`) — built for migrating off an earlier Weaviate-backed
  version of this app (see "Migrating from Weaviate" below), but it's a generic
  collections-keyed-by-name importer.

## Running it

The published image bundles Postgres + pgvector and the app in one container; Postgres data
persists on a mounted volume.

```bash
docker run -d \
  -v rddata:/var/lib/postgresql/data \
  -p 80:80 \
  --env-file .env \
  joeyshapiro/rubber-ducky
```

Put this behind a reverse proxy (nginx, Caddy, a Cloudflare Tunnel, ...) that terminates real TLS.
The container only ever speaks plain HTTP on port 80 — that's expected, not a gap: the browser's
connection to your proxy is what needs to be `https://` (client-side password hashing uses
`crypto.subtle`, which requires a secure context — the proxy's TLS is what provides it).

Database migrations run automatically on every container start (`entrypoint.sh` runs
`run-migrate.ts`, which only applies migrations not already recorded) — pulling a new image and
restarting against the same volume is enough to pick up schema changes.

### Upgrading a running container

Migrations aren't always additive — some have renamed or dropped columns (e.g.
`0005_badling_scoped_parent_id.sql`), so once a new image's migrations apply, the *previous*
image can no longer run against that same volume. Treat every upgrade as one-way and back up
first, not as something you can undo by just starting the old container again.

1. Note the running container's exact mounts/ports/env, so you can reproduce them:
   ```bash
   docker inspect <container> --format '{{json .Mounts}}{{"\n"}}{{json .Config.Env}}{{"\n"}}{{json .HostConfig.PortBindings}}'
   ```
2. Back up the database (this, not the old image, is the real rollback path):
   ```bash
   docker exec <container> su -c "pg_dump -U postgres rubber_ducky" postgres > rubber_ducky_backup_$(date +%F).sql
   ```
3. Update `.env` for anything the new version needs (new required vars fail loudly on boot if
   missing — see `.env` below).
4. Pull a pinned version, not `latest`, so you know exactly what's running:
   ```bash
   docker pull joeyshapiro/rubber-ducky:<version>
   ```
5. Stop the old container without removing it yet:
   ```bash
   docker stop <container>
   docker rename <container> <container>-old
   ```
6. Start the new one against the same volume (same `-v`/`-p` as step 1):
   ```bash
   docker run -d \
     --name <container> \
     -v rddata:/var/lib/postgresql/data \
     -p 80:80 \
     --env-file .env \
     joeyshapiro/rubber-ducky:<version>
   ```
7. Watch the logs for a clean migration + boot, then confirm login actually works in the browser:
   ```bash
   docker logs -f <container>
   ```
8. Only once confirmed healthy, clean up: `docker rm <container>-old`.

If it fails *before* migrations run (e.g. a missing env var — `entrypoint.sh` fails fast on those),
just fix `.env` and re-run step 6; nothing touched the DB yet. If it fails *after* migrations run,
restore from the step 2 backup rather than trying to run the old image again.

### Generating the password

The app has one password, stored as a peppered Argon2id hash, never as plaintext:

```bash
bun run password:hash "<your password>"
```

This prints `PASSWORD_HASH` and `PASSWORD_PEPPER` — put both in `.env`. Run it wherever you have
this repo checked out (it's not part of the image); re-running it with the same `PASSWORD_PEPPER`
already in `.env` regenerates only the hash, since rotating the pepper invalidates every existing
hash.

### `.env`

```bash
# required
PASSWORD_HASH=???       # from `bun run password:hash`
PASSWORD_PEPPER=???     # from `bun run password:hash`
POSTGRES_PASSWORD=???   # sets/rotates the in-container postgres superuser password on every start

# optional
PORT=80                          # must match the -p mapping and any reverse-proxy upstream
SESSION_HOURS=4                  # how long a login lasts; expiry means logging in again, not a silent refresh
OLLAMA_URL=http://host.docker.internal:11434   # omit to run without AI features
OLLAMA_MODEL=llama3.2            # model used for /qna
BODY_SIZE_LIMIT=Infinity         # raise this for large imports via /import
ADDRESS_HEADER=x-forwarded-for   # only if your proxy sets it; affects login rate-limit bucketing
PROTOCOL_HEADER=x-forwarded-proto
```

If you want AI features, pull the models on the Ollama host first:

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

## Development

```bash
bun install
bun run dev          # https, self-signed cert, so crypto.subtle works when testing over LAN too
```

Needs a local Postgres with pgvector — `docker-compose.yml` provides one (`docker compose up -d`),
matched against `POSTGRES_HOST`/`POSTGRES_PASSWORD` in your `.env`.

```bash
bun run db:generate   # generate a Drizzle migration from schema.ts changes
bun run db:migrate    # apply migrations (this is also what the container does on boot)
bun run db:seed       # seed data
bun run check         # svelte-check
bun run lint          # prettier + eslint
```

## Migrating from Weaviate

Earlier versions of this app stored data in Weaviate. `export-weaviate.js` dumps its collections
to JSON, matching the shape `/import` expects:

```bash
# run against a container that still has Weaviate configured (WEAVIATE in .env)
docker cp export-weaviate.js <container>:/app/export-weaviate.js
docker exec -it <container> node export-weaviate.js
```

Then `POST` the resulting `weaviate-export.json`'s `collections` object to `/import` on the new
Postgres-backed deployment.
