import { vectorizer, dataType } from 'weaviate-client';
import weaviate from 'weaviate-client';

const client = await weaviate.connectToLocal(
{
    host: 'localhost',   // URL only, no http prefix
    port: 50080,
    grpcPort: 50051,     // Default is 50051, WCD uses 443
});
console.log('client')

// Schema
await client.collections.create({
    name: 'Session',
    properties: [
        { name: 'createdOn', dataType: dataType.DATE },
        { name: 'expiresOn', dataType: dataType.DATE },
    ],
});
console.log('session')

await client.collections.create({
    name: 'Badling',
    properties: [
        { name: 'name', dataType: dataType.TEXT },
        { name: 'description', dataType: dataType.TEXT },
        { name: 'createdOn', dataType: dataType.DATE },
    ],
});
console.log('badling')

await client.collections.create({
    name: 'Duck',
    properties: [
        { name: 'name', dataType: dataType.TEXT },
        { name: 'description', dataType: dataType.TEXT },
        { name: 'createdOn', dataType: dataType.DATE },
    ],
    references: [{
        name: 'belongsTo',
        targetCollection: 'Badling',
    }]
});
console.log('ducks')

await client.collections.create({
    name: 'Message',
    vectorizers: vectorizer.text2VecTransformers(),
    generative: weaviate.configure.generative.ollama({
        apiEndpoint: 'http://host.docker.internal:11434',  // If using Docker, use this to contact your local Ollama instance
        model: 'llama3',  // The model to use, e.g. 'phi3', or 'mistral', 'command-r-plus', 'gemma'
    }),
    properties: [
        { name: 'from', dataType: dataType.TEXT },
        { name: 'content', dataType: dataType.TEXT },
        { name: 'timestamp', dataType: dataType.DATE },
    ],
    references: [{
        name: 'belongsTo',
        targetCollection: 'Duck',
    }]
});
console.log('messages')

await client.collections.create({
    name: 'Attachment',
    vectorizers: vectorizer.text2VecTransformers(),
    properties: [
        { name: 'name', dataType: dataType.TEXT },
        { name: 'type', dataType: dataType.TEXT },
        { name: 'content', dataType: dataType.TEXT },
    ],
    references: [{
        name: 'belongsTo',
        targetCollection: 'Message',
    }]
});
console.log('attachments')

await client.collections.create({
    name: 'Answer',
    properties: [
        { name: 'promt', dataType: dataType.TEXT },
        { name: 'content', dataType: dataType.TEXT },
        { name: 'timestamp', dataType: dataType.DATE },
        { name: 'messages', dataType: dataType.TEXT }, // cant do one to many
    ]
});
console.log('answers')

// Data
// Badlings
const badling = client.collections.get('Badling')

let uuid_projects = await badling.data.insert({
  'name': 'Projects',
  'description': 'My projects',
  'createdOn': new Date(),
});
console.log('projects: ', uuid_projects)

let uuid_games = await badling.data.insert({
    'name': 'Games',
    'description': 'shrug',
    'createdOn': new Date(),
});

console.log('games: ', uuid_games)

let uuid_misc = await badling.data.insert({
    'name': 'Misc',
    'description': 'Misc (however you spell it) ideas and thoughts',
    'createdOn': new Date(),
});

console.log('misc: ', uuid_misc)

// Ducks
const duck = client.collections.get('Duck')
let uuid_this = await duck.data.insert({
    properties: {
        'name': 'rubber-ducky',
        'createdOn': new Date(),
        'description': 'A rubber duck',
    },
    references: {
        'belongsTo': uuid_projects,
    }
});
console.log('rubber: ', uuid_this)

let uuid = await duck.data.insert({
    properties: {
        'name': 'coca',
        'createdOn': new Date(),
        'description': 'A coca',
        'belongsTo': uuid_projects,
    },
    references: {
        'belongsTo': uuid_projects,
    }
});
console.log('coca: ', uuid)

uuid = await duck.data.insert({
    properties: {
        'name': 'quake',
        'createdOn': new Date(),
        'description': 'A quake',
    },
    references: {
        'belongsTo': uuid_projects,
    }
});
console.log('quake: ', uuid)

uuid = await duck.data.insert({
    properties: {
        'name': 'dota',
        'createdOn': new Date(),
        'description': 'A dota',
    },
    references: {
        'belongsTo': uuid_games,
    }
});
console.log('dota: ', uuid)

uuid = await duck.data.insert({
    properties: {
        'name': 'Ideas',
        'createdOn': new Date(),
        'description': 'random ideas i have',
    },
    references: {
        'belongsTo': uuid_misc,
    }
});
console.log('ideas: ', uuid)

uuid = await duck.data.insert({
    properties: {
        'name': 'talk',
        'createdOn': new Date(),
        'description': 'random things to talk about',
    },
    references: {
        'belongsTo': uuid_misc,
    }
});
console.log('talk: ', uuid)

// Messages
const message = client.collections.get('Message')
let messages = [ 'Hello world', 'vecdb', 'svelte',
    'this is a very long message. i use weaviate as the db which is a vector db. svelte is the front end. of course i use bootstrap. svelte is also my backend... i think that is about it',
    'fireship gave a tutorial on how to use this all', 'the docs have good data, but it isnt very helpful', '```c\ninclude <stdio.h>\nint main() {\nprintf("hello");\nreturn0;\n}```',
    '`test`', '`python test.py`', '`docker compose up --build -d`', '`bun schema.ts`'];
for (const m of messages) {
    uuid = await message.data.insert({
        properties: {
            'from': 'user',
            'content': m,
            'timestamp': new Date(),
        },
        references: {
            'belongsTo': uuid_this,
        }
    });
    console.log('message: ', uuid);

    // sleep for a bit
    await new Promise(r => setTimeout(r, 1000));
}
