# Large File Fixtures

The `too-large.css` and `exactly-2mb.css` fixtures cannot be checked in because they are 2MB+.
They are created at test time by the test setup in `cssStylesheetLoader.test.ts`.

See the `beforeAll` hook in that test file which calls `generateLargeFixture()`.

If you need to create them manually for local debugging:

```bash
node -e "
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname);

// exactly-2mb.css: exactly 2,000,000 bytes
const line = ':root { --padding: 1rem; } /* padding */ \n';
let content2mb = '';
while (Buffer.byteLength(content2mb + line, 'utf8') <= 2_000_000) {
  content2mb += line;
}
// Trim to exactly 2,000,000 bytes
const buf = Buffer.from(content2mb, 'utf8').slice(0, 2_000_000);
fs.writeFileSync(path.join(dir, 'exactly-2mb.css'), buf);

// too-large.css: 2,000,001 bytes
const buf2 = Buffer.alloc(2_000_001, 0x20); // spaces
buf2.write(':root { --x: 1; } ', 0);
fs.writeFileSync(path.join(dir, 'too-large.css'), buf2);
console.log('done');
"
```
