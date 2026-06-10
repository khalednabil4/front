const https = require('https');

https.get('http://127.0.0.1:8000/core/centers-map/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const regions = json.map.regions;
    console.log("Original Region 10 path:", regions.find(r => r.id === 10).path);
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
