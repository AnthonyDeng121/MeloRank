function decodeCoverImage(value) {
  const bad = () => Object.assign(new Error('封面须为不超过 2 MB 的 JPEG 或 PNG 图片'), { status: 400 });
  if (typeof value !== 'string' || value.length > 2800000) throw bad();
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw bad();
  const data = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'jpeg' ? data[0] === 255 && data[1] === 216 && data[2] === 255
    : data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!valid || data.length < 8 || data.length > 2097152 || data.toString('base64') !== match[2]) throw bad();
  return { name: `cover.${match[1] === 'jpeg' ? 'jpg' : 'png'}`, mimetype: `image/${match[1]}`, size: data.length, data };
}
module.exports = { decodeCoverImage };
