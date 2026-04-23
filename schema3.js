import postgres from 'postgres';
import weaviate from 'weaviate-client';
import dotenv from 'dotenv';
dotenv.config();

const weaviateClient = await weaviate.connectToLocal({
    host: process.env.WEAVIATE,
    port: 50080,
    grpcPort: 50051,
});

const ducks = weaviateClient.collections.get('Duck');
const duckResults = await ducks.query.fetchObjects({
    filters: ducks.filter.byProperty('name').equal('rubber-ducky'),
});

if (duckResults.objects.length === 0) {
    console.log('rubber-ducky duck not found in weaviate, skipping sample quests');
    process.exit(0);
}

const duckObj = duckResults.objects[0];
const duckId = duckObj.uuid;
const duckName = duckObj.properties.name ?? 'rubber-ducky';
const duckDescription = duckObj.properties.description ?? '';
console.log('duck:', duckId);

const sql = postgres({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: 5432,
    database: 'rubber_ducky',
    username: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

await sql`
    INSERT INTO ducks (id, name, description, created_on)
    VALUES (${duckId}, ${duckName}, ${duckDescription}, NOW())
    ON CONFLICT (id) DO NOTHING
`;
console.log('inserted duck:', duckName);

const samples = [
    { title: 'Add Quest persistence', description: 'Wire quests to Weaviate so they survive a page reload.', status: 'completed', done: true },
    { title: 'Support subtasks', description: 'Allow quests to have child quests via questParentId references.', status: 'completed', done: true },
    { title: 'Add due date picker', description: 'Replace the plain text due field with a real date input in the modal.', status: 'active', done: false },
    { title: 'Quest filtering', description: 'Add a filter bar to show only active, completed, or aborted quests.', status: 'inactive', done: false },
];

const sampleIds = [];
for (const s of samples) {
    const [row] = await sql`
        INSERT INTO quests (title, description, due, status, done, created_on, duck_id)
        VALUES (${s.title}, ${s.description}, '', ${s.status}, ${s.done}, NOW(), ${duckId})
        RETURNING id
    `;
    sampleIds.push(row.id);
    console.log('sample quest:', s.title, row.id);
}

const subtaskSubquests = [
    { title: 'Design questParentId schema', description: 'Add questParentId text property to the Quest collection.', status: 'completed', done: true },
    { title: 'Update API endpoints', description: 'Pass quest_parent in POST body; return it in the response.', status: 'completed', done: true },
    { title: 'Build breadcrumb UI', description: 'Show a clickable breadcrumb trail when drilling into subquests.', status: 'completed', done: true },
    { title: 'Replace icon with count', description: 'Show child count on the icon when a quest has subquests.', status: 'completed', done: true },
];
for (const s of subtaskSubquests) {
    const [row] = await sql`
        INSERT INTO quests (title, description, due, status, done, created_on, quest_parent_id, duck_id)
        VALUES (${s.title}, ${s.description}, '', ${s.status}, ${s.done}, NOW(), ${sampleIds[1]}, ${duckId})
        RETURNING id
    `;
    console.log('  subquest:', s.title, row.id);
}

const datePickerSubquests = [
    { title: 'Add date input to modal', description: 'Swap the plain text due field for an <input type="date">.', status: 'active', done: false },
    { title: 'Format date for display', description: 'Show a human-readable date string on the quest card.', status: 'inactive', done: false },
];
for (const s of datePickerSubquests) {
    const [row] = await sql`
        INSERT INTO quests (title, description, due, status, done, created_on, quest_parent_id, duck_id)
        VALUES (${s.title}, ${s.description}, '', ${s.status}, ${s.done}, NOW(), ${sampleIds[2]}, ${duckId})
        RETURNING id
    `;
    console.log('  subquest:', s.title, row.id);
}

await sql.end();
console.log('done');
