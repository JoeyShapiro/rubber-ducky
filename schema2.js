import { vectorizer, dataType } from 'weaviate-client';
import weaviate from 'weaviate-client';

import dotenv from 'dotenv'
dotenv.config()
const env = process.env

let client = await weaviate.connectToLocal(
{
    host: env.WEAVIATE,   // URL only, no http prefix
    port: 50080,
    grpcPort: 50051,     // Default is 50051, WCD uses 443
}).catch((err) => {
    console.error(err.message)
});

// keep trying to connect
while (client == undefined) {
    await new Promise(r => setTimeout(r, 1000));
    client = await weaviate.connectToLocal(
    {
        host: env.WEAVIATE,   // URL only, no http prefix
        port: 50080,
        grpcPort: 50051,     // Default is 50051, WCD uses 443
    }).catch((err) => {
        console.error(err.message)
    });
    await new Promise(r => setTimeout(r, 1000));
}
console.log('client')

// Schema
await client.collections.create({
    name: 'Note',
    vectorizers: vectorizer.text2VecTransformers(),
    properties: [
        { name: 'content', dataType: dataType.TEXT },
    ],
    references: [{
        name: 'belongsTo',
        targetCollection: 'Duck',
    }]
});
console.log('notes')
