const fs = require("fs");
const s = fs.readFileSync(__dirname + "/../js/data.js", "utf8");
const artists = new Set();
for (const m of s.matchAll(/artist:\s*"([^"]+)"/g)) {
  const a = m[1];
  artists.add(a);
  artists.add(a.split(/\s+B2B\s+/i)[0].trim());
}
const list = [...artists].sort();
fs.writeFileSync(__dirname + "/artists-list.json", JSON.stringify(list, null, 2));
console.log("COUNT", list.length);
console.log(list.join("\n"));
