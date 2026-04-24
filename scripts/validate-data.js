const path = require('path');
const { MAPS } = require('../lib/defaults');
const { loadAllMapData } = require('../lib/map-data');

const dataDirectory = path.join(__dirname, '..', 'data');
const mapCache = loadAllMapData(dataDirectory);
const problems = [];

for (const map of MAPS) {
  const loadedMap = mapCache.get(map.id);

  if (!loadedMap) {
    problems.push(`${map.id}: map did not load.`);
    continue;
  }

  if (loadedMap.loadError) {
    problems.push(`${map.id}: ${loadedMap.loadError}`);
    continue;
  }

  if (!loadedMap.spawns.length) {
    problems.push(`${map.id}: expected at least one spawn.`);
  }
}

if (problems.length) {
  console.error('Map data validation failed.');
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }
  process.exit(1);
}

const totalSpawns = Array.from(mapCache.values()).reduce(
  (count, map) => count + map.spawns.length,
  0
);

console.log(
  `Validated ${MAPS.length} map file(s) and ${totalSpawns} static spawn marker(s).`
);
