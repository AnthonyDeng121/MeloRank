export async function prepareCoverUpload(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10485760) throw new Error('请选择 10 MB 以内的 JPEG、PNG 或 WebP 图片');
  const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('无法读取图片')); reader.readAsDataURL(file); });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error('图片无法解码，请选择其他图片')); value.src = source; });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效');
  const side = Math.min(image.naturalWidth, image.naturalHeight), canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(1000, side);
  const context = canvas.getContext('2d'); if (!context) throw new Error('浏览器无法处理图片');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
  const result = canvas.toDataURL('image/jpeg', 0.88);
  if (!result.startsWith('data:image/jpeg;base64,') || result.length > 2800000) throw new Error('图片压缩后仍过大，请选择其他图片');
  return result;
}
