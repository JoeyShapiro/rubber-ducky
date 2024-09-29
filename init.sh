#!/bin/sh

bun run schema.ts
docer exec -it rubber-ducky-ollama-1 ollama pull llama3
