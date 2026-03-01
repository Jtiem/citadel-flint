const { execFileSync } = require('child_process');
try {
  const diff = execFileSync('git', ['show', 'HEAD:package.json'], { encoding: 'utf-8' });
  console.log("Success: " + diff.substring(0, 50).replace(/\n/g, '\\n'));
} catch (e) {
  console.error("Failed", e);
}
