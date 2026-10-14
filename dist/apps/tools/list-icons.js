const fs = require("fs");
const src = fs.readFileSync("assets/icons.js", "utf8");
const keys = new Set();
for (const m of src.matchAll(/"([a-zA-Z0-9]+)":\s*"/g)) keys.add(m[1]);
console.log("count:", keys.size);
console.log([...keys].sort().join(","));
