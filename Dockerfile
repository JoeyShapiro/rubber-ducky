FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-server-dev-all \
    build-essential \
    git \
    curl \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --branch v0.8.0 https://github.com/pgvector/pgvector.git /tmp/pgvector \
    && cd /tmp/pgvector \
    && make && make install \
    && rm -rf /tmp/pgvector

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run db:generate && bun run build && bun install --production

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/lib/postgresql/15/lib/vector.so /usr/lib/postgresql/15/lib/
COPY --from=builder /usr/share/postgresql/15/extension/vector* /usr/share/postgresql/15/extension/

COPY --from=builder /root/.bun/bin/bun /usr/local/bin/bun

USER postgres
RUN /usr/lib/postgresql/15/bin/initdb -D /var/lib/postgresql/data \
    && /usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data start \
    && psql -c "CREATE EXTENSION vector;" \
    && /usr/lib/postgresql/15/bin/pg_ctl -D /var/lib/postgresql/data stop

USER root
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/lib/db/run-migrate.ts ./run-migrate.ts

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# TODO i dont think this does anything. and you dont really need it
ENV PORT=80

EXPOSE 80 5432
ENTRYPOINT ["/entrypoint.sh"]
