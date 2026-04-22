import { dataType } from 'weaviate-client';
import weaviate from 'weaviate-client';

import dotenv from 'dotenv'
dotenv.config()
const env = process.env

let client = await weaviate.connectToLocal(
{
    host: env.WEAVIATE,
    port: 50080,
    grpcPort: 50051,
}).catch((err) => {
    console.error(err.message)
});

while (client == undefined) {
    await new Promise(r => setTimeout(r, 1000));
    client = await weaviate.connectToLocal(
    {
        host: env.WEAVIATE,
        port: 50080,
        grpcPort: 50051,
    }).catch((err) => {
        console.error(err.message)
    });
    await new Promise(r => setTimeout(r, 1000));
}
console.log('client')

await client.collections.create({
    name: 'Quest',
    properties: [
        { name: 'title', dataType: dataType.TEXT },
        { name: 'description', dataType: dataType.TEXT },
        { name: 'due', dataType: dataType.TEXT },
        { name: 'status', dataType: dataType.TEXT },
        { name: 'done', dataType: dataType.BOOLEAN },
        { name: 'createdOn', dataType: dataType.DATE },
    ],
    references: [{
        name: 'belongsTo',
        targetCollection: 'Duck',
    }]
});
console.log('quest')

// Sample quests for the rubber-ducky duck
const ducks = client.collections.get('Duck');
const duckResults = await ducks.query.fetchObjects({
    filters: ducks.filter.byProperty('name').equal('rubber-ducky'),
});

if (duckResults.objects.length > 0) {
    const rubberDuckyUuid = duckResults.objects[0].uuid;
    const quests = client.collections.get('Quest');

    const samples = [
        { title: 'Add Quest persistence', description: 'Wire quests to Weaviate so they survive a page reload.', status: 'completed', done: true },
        { title: 'Support subtasks', description: 'Allow quests to have child quests via parent_id references.', status: 'inactive', done: false },
        { title: 'Add due date picker', description: 'Replace the plain text due field with a real date input in the modal.', status: 'active', done: false },
        { title: 'Quest filtering', description: 'Add a filter bar to show only active, completed, or aborted quests.', status: 'inactive', done: false },
    ];

    for (const s of samples) {
        const uuid = await quests.data.insert({
            properties: { ...s, due: '', createdOn: new Date() },
            references: { belongsTo: rubberDuckyUuid },
        });
        console.log('sample quest:', s.title, uuid);
    }
} else {
    console.log('rubber-ducky duck not found, skipping sample quests');
}
