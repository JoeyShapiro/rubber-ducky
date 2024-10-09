#!/bin/sh

# setup
bun run schema.ts
docker exec -it rubber-ducky-ollama-1 ollama pull llama3.2
docker exec -it rubber-ducky-web-1 node schema.js

# build
bun run build
echo -n password | sha512sum
