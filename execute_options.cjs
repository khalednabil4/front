const https = require('https');

https.get('http://127.0.0.1:8000/core/centers-map/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const regions = json.map.regions;
    
    regions.forEach(r => {
      console.log(`Region ${r.id} (${r.name}):`);
      console.log(`  path: ${r.path}`);
      console.log(`  points: ${r.map_shape.points.length} points`);
    });
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
