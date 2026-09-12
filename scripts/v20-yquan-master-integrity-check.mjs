import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const manifest=JSON.parse(fs.readFileSync('public/assets/hiu-y-quan/characters/master/manifest.json','utf8'));
const originalHashes={
  male:'ad114edc159823330d9c4c1016fe180d1b26c8183a15b08eb3c5eab29f46fdd4',
  female:'22009a0f5fa80b05516705b8acf297f4d77dcfe531a2429bcf7c519d6379d42f'
};
for(const [gender,expected] of Object.entries(originalHashes)){
  const master=manifest.characters[gender];
  assert.equal(master.sha256,expected,`${gender}: master reference may not be silently substituted`);
  const bytes=fs.readFileSync(master.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`${gender}: original uploaded JPEG bytes changed`);
}
console.log('V20 master source integrity PASS: both original uploads preserved. Animation identity is not certified by this check.');
