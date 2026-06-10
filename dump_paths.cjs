const https = require('https');
const fs = require('fs');

https.get('http://127.0.0.1:8000/core/centers-map/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    fs.writeFileSync('paths_dump.json', JSON.stringify(json.map.regions.map(r => ({
      name: r.name,
      path: r.path
    })), null, 2));
    console.log("Dumped to paths_dump.json");
  });
});
