import weaviate from 'weaviate-client';

const client = await weaviate.connectToLocal()
const messages = client.collections.get('Message');

const result = await messages.generate.fetchObjects({
    groupedTask: `what do i use`
  },{
    limit: 2,
  })

result.objects.forEach(item => {
  console.log(JSON.stringify(item.properties, null, 2))
  console.log(item.metadata?.distance)
})
