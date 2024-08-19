import { vectorizer, dataType } from 'weaviate-client';
import weaviate from 'weaviate-client';

const client = await weaviate.connectToLocal()
console.log('client')

// Schema
await client.collections.create({
    name: 'Badling',
    properties: [
        { name: 'name', dataType: dataType.TEXT },
        { name: 'description', dataType: dataType.TEXT },
    ],
});
console.log('badling')

await client.collections.create({
    name: 'Duck',
    properties: [
        { name: 'name', dataType: dataType.TEXT },
        { name: 'createdOn', dataType: dataType.DATE },
        { name: 'description', dataType: dataType.TEXT },
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
    properties: [
        { name: 'content', dataType: dataType.TEXT },
        { name: 'timestamp', dataType: dataType.DATE },
    ],
    references: [{
        name: 'belongsTo',
        targetCollection: 'Duck',
    }]
});
console.log('messages')

// Data
// Badlings
const badling = client.collections.get('Badling')

let uuid_projects = await badling.data.insert({
  'name': 'Projects',
  'description': 'My projects',
});
console.log('projects: ', uuid_projects)

let uuid_games = await badling.data.insert({
    'name': 'Games',
    'description': 'shrug',
});

console.log('games: ', uuid_games)

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

// Messages
const message = client.collections.get('Message')
let messages = [ 'Hello world', 'vecdb', 'svelte',
    'this is a very long message. i use weaviate as the db which is a vector db. svelte is the front end. of course i use bootstrap. svelte is also my backend... i think that is about it',
    'fireship gave a tutorial on how to use this all', 'the docs have good data, but it isnt very helpful', '```c\ninclude <stdio.h>\nint main() {\nprintf("hello");\nreturn0;\n}```',
    '`test`', '`python test.py`', '`docker compose up --build -d`', '`bun schema.ts`'];
for (const m of messages) {
    uuid = await message.data.insert({
        properties: {
            'content': m,
            'timestamp': new Date(),
        },
        references: {
            'belongsTo': uuid_this,
        }
    });
    console.log('message: ', uuid);
}
