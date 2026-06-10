const fs = require('fs');
const https = require('https');

https.get('http://127.0.0.1:8000/core/centers-map/', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const regions = json.map.regions;
    
    // Analyze points
    const allPoints = [];
    regions.forEach(r => {
      const pts = r.map_shape.points || [];
      pts.forEach(p => {
        allPoints.push({ x: p.x, y: p.y, region: r.id, name: r.name });
      });
    });
    
    console.log(`Total regions: ${regions.length}`);
    console.log(`Total points: ${allPoints.length}`);
    
    // Check overlaps
    let exactMatches = 0;
    let nearMatches = 0;
    const TOLERANCE = 2.0;
    
    for (let i = 0; i < allPoints.length; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        if (allPoints[i].region !== allPoints[j].region) {
          const dx = Math.abs(allPoints[i].x - allPoints[j].x);
          const dy = Math.abs(allPoints[i].y - allPoints[j].y);
          if (dx === 0 && dy === 0) exactMatches++;
          else if (dx <= TOLERANCE && dy <= TOLERANCE) nearMatches++;
        }
      }
    }
    
    console.log(`Exact matches between different regions: ${exactMatches}`);
    console.log(`Near matches (dist <= ${TOLERANCE}) between different regions: ${nearMatches}`);
    
  });
}).on('error', (err) => {
  console.log("Error: " + err.message);
});
