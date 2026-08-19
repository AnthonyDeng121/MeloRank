import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType } from 'docx';
import { saveAs } from 'file-saver';
import type { RankingItem, ScoringMode } from './rankingLogic';

/** 将排行榜预览节点导出为图片数据。 */
export async function captureRankingImage(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  return canvas.toDataURL('image/jpeg', 1);
}

/** 导出 PDF。 */
export async function exportRankingPdf(element: HTMLElement, filename: string): Promise<void> {
  const image = await captureRankingImage(element);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const width = 190;
  const height = (pdf.internal.pageSize.getHeight() * width) / pdf.internal.pageSize.getWidth();
  pdf.addImage(image, 'JPEG', 10, 10, width, height);
  pdf.save(filename);
}

/** 导出 DOCX，使用榜单条目数据生成可编辑文档。 */
export async function exportRankingDocx(items: RankingItem[], mode: ScoringMode, filename: string): Promise<void> {
  const rows = items.map((item, index) => new TableRow({ children: [
    new TableCell({ children: [new Paragraph(`NO.${mode === 'scoring' ? item.rank : index + 1}`)] }),
    new TableCell({ children: [new Paragraph(`${item.title} - ${item.artist}`), new Paragraph(item.review || '暂无评价')] }),
    ...(mode === 'scoring' ? [new TableCell({ children: [new Paragraph(`评分：${item.finalScore}`)] })] : [])
  ] }));
  const doc = new Document({ sections: [{ children: [new Paragraph('MeloRank 年度榜单'), new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })] }] });
  saveAs(await Packer.toBlob(doc), filename);
}
