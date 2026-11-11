const assert = require('node:assert/strict');
for (const path of ['../backend/src/coverImage', '../qq-music-api-main/util/coverImage']) {
  const { decodeCoverImage } = require(path);
  assert.equal(decodeCoverImage('data:image/jpeg;base64,/9j/AAECAwQ=').size, 8);
  assert.throws(() => decodeCoverImage('data:image/svg+xml;base64,PHN2Zz4='), error => error.status === 400);
  assert.throws(() => decodeCoverImage('data:image/jpeg;base64,aGVsbG8='), error => error.status === 400);
  assert.throws(() => decodeCoverImage('data:image/jpeg;base64,' + Buffer.alloc(2097153, 255).toString('base64')), error => error.status === 400);
}
console.log('PASS both servers: local cover MIME, binary signature, valid base64 and size bounds');
