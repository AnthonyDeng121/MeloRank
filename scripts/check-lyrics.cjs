const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { decodeLyric } = require('../qq-music-api-main/util/lyricDecode');
const { encryptQrc } = require('../qq-music-api-main/node_modules/qrc-decoder');

const text = '[00:01.50]原文\n[00:03.005]下一句';
assert.equal(decodeLyric(Buffer.from(text).toString('base64')), text);
assert.equal(decodeLyric(text), text);
assert.equal(decodeLyric(''), '');
assert.equal(decodeLyric(encryptQrc('[1500,1000]ko(1500,300)n(1800,700)')), '[00:01.500]kon');
const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/services/lyrics.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, sandbox);
const { parseLrc, matchLyric, lyricCues } = sandbox.exports;
const lines = parseLrc(text);
assert.equal(lines[0].time, 1.5);
assert.equal(lines[1].time, 3.005);
assert.equal(matchLyric(lines, 1.51), '原文');
assert.equal(matchLyric(lines, 5), '');
assert.equal(parseLrc('[00:01.5][00:02.50]repeat').length, 2);
assert.equal(parseLrc('[offset:100]\n[00:01.5]text')[0].time, 1.6);
assert.equal(matchLyric(parseLrc('[00:01.5]//'), 1.5), '');
assert.equal(matchLyric(parseLrc('[00:01.5] ／ ／ '), 1.5), '');
const cues = lyricCues(parseLrc('[00:01]First\n[00:03]//\n[00:05]Second'), 8);
assert.equal(cues.length, 2);
assert.equal(cues[0].end, 5);
assert.equal(cues[1].end, 8);
console.log('PASS base64/QRC decoding, word timings, LRC fractions, multiple timestamps and alignment');
