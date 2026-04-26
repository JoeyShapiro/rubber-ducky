# create-svelte

Everything you need to build a Svelte project, powered by [`create-svelte`](https://github.com/sveltejs/kit/tree/main/packages/create-svelte).

## Use the public container
```bash
bun run build
docker build -t rubber-ducky .

docker run -v rddata:/var/lib/postgresql/data -p 80:80 --env-file .env rubber-ducky
```

```bash
# .env
PASSWORD=??? # should be pre hashed
PORT=80
POSTGRES_PASSWORD=???
OLLAMA_URL=http://localhost:11434
# for proper importing of data
BODY_SIZE_LIMIT=Infinity
```

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npm create svelte@latest

# create a new project in my-app
npm create svelte@latest my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.

## Export Weaviate data

This project includes a helper script to export all app collections from Weaviate into flat files that are easy to import into Postgres.

Run the export:

```bash
# export in docker
docker cp export-weaviate.js rubber-ducky-web-1:/app/export-weaviate.js
docker exec -it rubber-ducky-web-1 node export-weaviate.js
```

```bash
npm run export:weaviate
```

Optional flags:

```bash
node export-weaviate.js --format=json,csv --outDir=exports --collections=Session,Badling,Duck,Message,Attachment,Answer,Note --pageSize=200
```

What it writes:

- `exports/weaviate-export-<timestamp>/weaviate-export.json`
- `exports/weaviate-export-<timestamp>/csv/<Collection>.csv`

Notes:

- Requires `WEAVIATE` in your `.env`.
- For related collections (`Duck`, `Message`, `Attachment`, `Note`), it adds a flattened `belongsToId` column in the output.
