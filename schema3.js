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
        { name: 'questParentId', dataType: dataType.TEXT },
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
        { title: 'Support subtasks', description: 'Allow quests to have child quests via questParentId references.', status: 'completed', done: true },
        { title: 'Add due date picker', description: 'Replace the plain text due field with a real date input in the modal.', status: 'active', done: false },
        { title: 'Quest filtering', description: 'Add a filter bar to show only active, completed, or aborted quests.', status: 'inactive', done: false },
    ];

    const sampleUuids = [];
    for (const s of samples) {
        const uuid = await quests.data.insert({
            properties: { ...s, due: '', createdOn: new Date(), questParentId: '' },
            references: { belongsTo: rubberDuckyUuid },
        });
        sampleUuids.push(uuid);
        console.log('sample quest:', s.title, uuid);
    }

    // Subquests of "Support subtasks" (index 1)
    const subtaskSubquests = [
        { title: 'Design questParentId schema', description: 'Add questParentId text property to the Quest collection.', status: 'completed', done: true },
        { title: 'Update API endpoints', description: 'Pass quest_parent in POST body; return it in the response.', status: 'completed', done: true },
        { title: 'Build breadcrumb UI', description: 'Show a clickable breadcrumb trail when drilling into subquests.', status: 'completed', done: true },
        { title: 'Replace icon with count', description: 'Show child count on the icon when a quest has subquests.', status: 'completed', done: true },
    ];
    for (const s of subtaskSubquests) {
        const uuid = await quests.data.insert({
            properties: { ...s, due: '', createdOn: new Date(), questParentId: sampleUuids[1] },
            references: { belongsTo: rubberDuckyUuid },
        });
        console.log('  subquest:', s.title, uuid);
    }

    // Subquests of "Add due date picker" (index 2)
    const datePickerSubquests = [
        { title: 'Add date input to modal', description: 'Swap the plain text due field for an <input type="date">.', status: 'active', done: false },
        { title: 'Format date for display', description: 'Show a human-readable date string on the quest card.', status: 'inactive', done: false },
    ];
    for (const s of datePickerSubquests) {
        const uuid = await quests.data.insert({
            properties: { ...s, due: '', createdOn: new Date(), questParentId: sampleUuids[2] },
            references: { belongsTo: rubberDuckyUuid },
        });
        console.log('  subquest:', s.title, uuid);
    }
} else {
    console.log('rubber-ducky duck not found, skipping sample quests');
}
