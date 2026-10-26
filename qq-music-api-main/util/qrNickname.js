// Parse quoted callback arguments without executing upstream JavaScript.
module.exports = text => {
  const fields = [...text.matchAll(/'((?:\\.|[^'\\])*)'/g)];
  return (fields[5]?.[1] || '')
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\(['\\])/g, '$1');
};
