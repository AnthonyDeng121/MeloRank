import { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, TableLayoutType, SectionType, VerticalAlign } from 'docx';
import type { RankingItem } from '../contexts/RankingContext';
import { saveAs } from 'file-saver';

export type RankingExportFormat = 'docx' | 'pdf' | 'pages' | 'long-image';
const PAGE_WIDTH = 11906, PAGE_HEIGHT = 16838, MARGIN = 720;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };

export async function imageToPng(url: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 300;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#eeeeee'; context.fillRect(0, 0, 300, 300);
  const draw = (src: string) => new Promise<void>((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => { image.src = ''; reject(new Error('封面读取超时')); }, 10000);
    image.crossOrigin = 'anonymous';
    image.onload = () => { clearTimeout(timer); context.drawImage(image, 0, 0, 300, 300); resolve(); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('封面读取失败')); };
    image.src = src;
  });
  try {
    if (!url) throw new Error('无封面');
    try { await draw(url); } catch {
      const host = new URL(url).hostname;
      if (!['y.qq.com', 'y.gtimg.cn'].includes(host)) throw new Error('无可用封面');
      const base = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      await draw(`${base}/api/proxy/qqmusic/image?url=${encodeURIComponent(url)}`);
    }
  } catch {
    context.fillStyle = '#eeeeee'; context.fillRect(0, 0, 300, 300);
    context.fillStyle = '#666666'; context.font = '24px Arial'; context.textAlign = 'center';
    context.fillText('MeloRank', 150, 155);
  }
  // SVG, WebP, remote JPEG and placeholders are all encoded as real PNG bytes.
  return new Uint8Array(await (await fetch(canvas.toDataURL('image/png'))).arrayBuffer());
}

function scorePng(score: number, red: boolean): Uint8Array {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 300;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, 300, 300);
  context.strokeStyle = context.fillStyle = red ? '#c32626' : '#111111';
  context.lineWidth = 9; context.beginPath(); context.arc(150, 150, 128, 0, Math.PI * 2); context.stroke();
  context.font = 'bold 86px "Times New Roman"'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText(Number(score.toFixed(1)).toString(), 150, 157);
  return Uint8Array.from(atob(canvas.toDataURL('image/png').split(',')[1]), c => c.charCodeAt(0));
}

function paragraph(text: string, options: { bold?: boolean; size?: number; keepNext?: boolean } = {}) {
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60, line: 280 },
    keepNext: options.keepNext, children: [new TextRun({ text, font: 'Microsoft YaHei', size: options.size || 22, bold: options.bold })] });
}
const picture = (data: Uint8Array, size = 142) => new Paragraph({ alignment: AlignmentType.CENTER,
  spacing: { before: 0, after: 0 }, children: [new ImageRun({ type: 'png', data, transformation: { width: size, height: size } })] });
function cell(children: (Paragraph | Table)[], width: number) {
  return new TableCell({ children, width: { size: width, type: WidthType.DXA }, borders,
    verticalAlign: VerticalAlign.CENTER, margins: { top: 60, bottom: 60, left: 80, right: 80 } });
}
function table(rows: TableRow[], width = CONTENT_WIDTH, columns = [width]) {
  return new Table({ rows, width: { size: width, type: WidthType.DXA }, columnWidths: columns, layout: TableLayoutType.FIXED });
}

interface PreparedItem extends RankingItem { cover: Uint8Array; score: Uint8Array }
function scoredEntry(item: PreparedItem): Table {
  const body = table([
    new TableRow({ cantSplit: true, children: [new TableCell({
      ...{ borders, columnSpan: 3 }, children: [paragraph(`NO.${item.rank} ${item.title} - ${item.artist}`, { bold: true, keepNext: true })],
    })] }),
    new TableRow({ cantSplit: true, children: [
      cell([picture(item.cover)], Math.round(CONTENT_WIDTH * .26)),
      cell([paragraph(`原始分数：${item.originalScore}`), paragraph(`整体性：${item.integrity}`), paragraph(`保值度：${item.durability}`),
        paragraph(item.review || '没有评价的义务！')], Math.round(CONTENT_WIDTH * .48)),
      cell([picture(item.score)], Math.round(CONTENT_WIDTH * .26)),
    ] }),
  ], CONTENT_WIDTH, [2721, 5024, 2721]);
  // The whole entry is a single non-splitting OUTER row, including title and body.
  return table([new TableRow({ cantSplit: true, children: [new TableCell({ children: [body, new Paragraph({ spacing: { after: 0, line: 20 } })],
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
    margins: { top: 0, bottom: 0, left: 0, right: 0 } })] })]);
}

function unscoredRow(items: PreparedItem[]): Table {
  return table([new TableRow({ cantSplit: true, children: Array.from({ length: 2 }, (_, i) => {
    const item = items[i];
    return cell(item ? [paragraph(`NO.${item.rank} ${item.title} - ${item.artist}`, { bold: true, keepNext: true }), picture(item.cover),
      paragraph(item.review || '没有评价的义务！')] : [new Paragraph({})], CONTENT_WIDTH / 2);
  }) })], CONTENT_WIDTH, [CONTENT_WIDTH / 2, CONTENT_WIDTH / 2]);
}

// Explicit section pages make the same DOCX the source for PDF and image exports.
// Conservative text measurement leaves room for Word font/layout differences.
export function planRankingPages(items: RankingItem[], scoring: boolean): RankingItem[][] {
  const pages: RankingItem[][] = [];
  let page: RankingItem[] = [], used = 0;
  const height = (item: RankingItem) => {
    const titleLines = Math.ceil((item.title.length + item.artist.length + 10) / (scoring ? 65 : 28));
    const reviewLines = (item.review || '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / (scoring ? 24 : 28))), 0);
    return scoring ? Math.max(165, 95 + reviewLines * 21) + titleLines * 24 + 24 : 180 + (titleLines + reviewLines) * 24;
  };
  for (let i = 0; i < items.length; i += scoring ? 1 : 2) {
    const group = items.slice(i, i + (scoring ? 1 : 2));
    const next = Math.max(...group.map(height));
    if (page.length && (used + next > 920 || page.length >= (scoring ? 4 : 8))) { pages.push(page); page = []; used = 0; }
    page.push(...group); used += next;
  }
  if (page.length) pages.push(page);
  return pages;
}

export async function buildRankingDocx(items: RankingItem[], scoring: boolean): Promise<Blob> {
  if (!items.length) throw new Error('榜单为空，无法导出');
  const prepared: PreparedItem[] = [];
  // Bounded image loading avoids dozens of simultaneous image requests.
  for (let offset = 0; offset < items.length; offset += 4) {
    prepared.push(...await Promise.all(items.slice(offset, offset + 4).map(async item => ({ ...item,
      cover: await imageToPng(item.coverUrl), score: scorePng(item.finalScore, item.integrity > 0 && item.durability > 0) }))));
  }
  const pages = planRankingPages(prepared, scoring) as PreparedItem[][];
  const doc = new Document({ styles: { default: { document: { run: { font: 'Microsoft YaHei', size: 22 }, paragraph: { spacing: { after: 0 } } } } },
    sections: pages.map(page => ({ properties: { type: SectionType.NEXT_PAGE,
      page: { size: { width: PAGE_WIDTH, height: PAGE_HEIGHT }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      children: scoring ? page.flatMap(item => [scoredEntry(item), new Paragraph({ spacing: { after: 30, line: 40 } })])
        : Array.from({ length: Math.ceil(page.length / 2) }, (_, i) => unscoredRow(page.slice(i * 2, i * 2 + 2))),
    })) });
  return Packer.toBlob(doc);
}

export async function renderRankingPages(blob: Blob) {
  const { renderAsync } = await import('docx-preview');
  const host = document.createElement('iframe');
  host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:1200px;border:0;background:white;z-index:-1;';
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  document.body.appendChild(host);
  const frameDocument = host.contentDocument!;
  frameDocument.body.style.margin = '0';
  const container = frameDocument.createElement('div');
  frameDocument.body.appendChild(container);
  try {
    await renderAsync(blob, container, undefined, { className: 'ranking-docx', inWrapper: false, breakPages: true, useBase64URL: true });
    await frameDocument.fonts.ready;
    await Promise.all(Array.from(container.querySelectorAll('img')).map(image => image.decode()));
    const pages = Array.from(container.querySelectorAll<HTMLElement>('section.ranking-docx'));
    if (!pages.length) throw new Error('文档分页渲染失败');
    for (const page of pages) {
      page.style.boxShadow = 'none'; page.style.margin = '0'; page.style.backgroundColor = 'white';
      if (page.scrollHeight > page.clientHeight + 3) throw new Error('有条目内容超过一页，请缩短超长评论后重新导出');
    }
    return { host, pages };
  } catch (error) { host.remove(); throw error; }
}

export async function downloadRanking(items: RankingItem[], scoring: boolean, format: RankingExportFormat, name: string) {
  const blob = await buildRankingDocx(items, scoring);
  if (format === 'docx') { saveAs(blob, `${name}.docx`); return; }
  const { host, pages } = await renderRankingPages(blob);
  try {
    const { default: html2canvas } = await import('html2canvas');
    const imagePages = format === 'pages';
    const { default: JSZip } = imagePages ? await import('jszip') : { default: null };
    const zip = JSZip ? new JSZip() : null;
    const { jsPDF } = format === 'pdf' ? await import('jspdf') : { jsPDF: null };
    const pdf = jsPDF ? new jsPDF({ unit: 'mm', format: 'a4', compress: true }) : null;
    let longCanvas: HTMLCanvasElement | null = null, longY = 0;
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      // Render each section at the iframe origin so later pages are never clipped
      // against the iframe viewport by the browser's foreignObject renderer.
      pages.forEach(section => { section.style.display = section === page ? 'block' : 'none'; });
      const canvas = await html2canvas(page, { scrollX: 0, scrollY: 0,
        scale: 1.5, backgroundColor: '#ffffff', useCORS: true, foreignObjectRendering: true, logging: false });
      if (pdf) { if (index) pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg', .96), 'JPEG', 0, 0, 210, 297); }
      else {
        // Images contain the inside of the DOCX page, with the 0.5-inch margins cropped away.
        const margin = Math.round(canvas.width * MARGIN / PAGE_WIDTH);
        const cropped = document.createElement('canvas');
        cropped.width = canvas.width - 2 * margin; cropped.height = canvas.height - 2 * margin;
        cropped.getContext('2d')!.drawImage(canvas, margin, margin, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
        if (zip) zip.file(`${name}_${String(index + 1).padStart(3, '0')}.png`, cropped.toDataURL('image/png').split(',')[1], { base64: true });
        else {
          if (!longCanvas) {
            longCanvas = document.createElement('canvas'); longCanvas.width = cropped.width; longCanvas.height = cropped.height * pages.length;
            if (longCanvas.height > 65535 || longCanvas.width * longCanvas.height > 120000000) throw new Error('长图片超过浏览器尺寸限制，请选择“每页图片”');
            longCanvas.getContext('2d')!.fillStyle = '#ffffff'; longCanvas.getContext('2d')!.fillRect(0, 0, longCanvas.width, longCanvas.height);
          }
          longCanvas.getContext('2d')!.drawImage(cropped, 0, longY); longY += cropped.height;
        }
      }
      canvas.width = canvas.height = 0;
    }
    if (pdf) pdf.save(`${name}.pdf`);
    else if (zip) saveAs(await zip.generateAsync({ type: 'blob' }), `${name}_分页图片.zip`);
    else if (longCanvas) {
      const canvas = longCanvas;
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('长图片生成失败，请使用每页图片')), 'image/png'));
      saveAs(png, `${name}_长图.png`);
    }
  } finally { host.remove(); }
}
