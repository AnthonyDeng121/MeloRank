/** Accept only the NetEase credentials used by this app; never retain unrelated cookies. */
export function normalizeNeteaseCookie(raw: string): string {
  if (raw.length > 16384 || /[\r\n]/.test(raw)) throw new Error('请粘贴 Cookie 字段，不要粘贴整段请求或多行内容');
  const allowed = new Set(['MUSIC_U', '__csrf', 'NMTID', 'MUSIC_A']);
  const values = new Map<string, string>();
  for (const part of raw.trim().split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (allowed.has(name) && value) {
      if (!/^[\x21-\x7e]+$/.test(value)) throw new Error('登录凭证包含无效字符，请重新复制');
      values.set(name, value);
    }
  }
  if (!values.has('MUSIC_U')) throw new Error('缺少 MUSIC_U，请按 MUSIC_U=复制的值; 的格式填写');
  return Array.from(values, ([name, value]) => `${name}=${value}`).join('; ') + ';';
}
