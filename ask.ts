import weaviate from 'weaviate-client';

const client = await weaviate.connectToLocal()
const messages = client.collections.get('Message');

let result = await messages.generate.fetchObjects({
    groupedTask: `what do i use`
},{
limit: 2,
});

/*
{
  "content": "`test`",
  "timestamp": "2024-09-28T21:28:06.597Z"
}
undefined
{
  "content": "`docker compose up --build -d`",
  "timestamp": "2024-09-28T21:28:06.655Z"
}
undefined
A JSON array!

It looks like you have a log entry with two entries:

1. The first entry has `content` set to `"test"` and a timestamp of `2024-09-28T21:28:06.597Z`.
2. The second entry has `content` set to `"docker compose up --build -d"` and a timestamp of `2024-09-28T21:28:06.655Z`.

So, it seems like you used the following commands:

1. Ran the command `test`
2. Ran the command `docker compose up --build -d`

Note that the timestamps are in ISO 8601 format, which is a standard way of representing dates and times in computers.
*/

result = await messages.generate.nearText('what do i use', {
    groupedTask: `what do i use`
},{
    limit: 2,
});

/*
{
  "content": "this is a very long message. i use weaviate as the db which is a vector db. svelte is the front end. of course i use bootstrap. svelte is also my backend... i think that is about it",
  "timestamp": "2024-09-28T21:28:06.468Z"
}
undefined
{
  "content": "fireship gave a tutorial on how to use this all",
  "timestamp": "2024-09-28T21:28:06.508Z"
}
undefined
A chat log!

It seems like you're discussing the tech stack for a project. Here's what I gather from your conversation:

1. **Weaviate**: You mentioned using Weaviate as your database, which is a vector database.
2. **Svelte**: You're using Svelte for both the frontend and backend of your project (I'm assuming you meant that you're using SvelteKit, which allows for server-side rendering).
3. **Bootstrap**: You're also using Bootstrap to add some visual flair to your application.

So, in summary:

* Weaviate: Vector database
* Svelte/SvelteKit: Frontend and Backend framework
* Bootstrap: CSS framework for styling

Let me know if there's anything else I can help with!
*/

result.objects.forEach(item => {
  console.log(JSON.stringify(item.properties, null, 2))
  console.log(item.metadata?.distance)
})

console.log(result.generated)
