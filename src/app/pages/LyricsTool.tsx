import React, { useRef } from 'react';
import '../../styles/LyricsTool.css';
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, ImageRun } from "docx";
import { saveAs } from "file-saver";

export function LyricsTool() {
  // 导出专用隐藏 DOM 的 ref
  const exportRef = useRef<HTMLDivElement>(null);
  
  // 复制成功提示状态
  const [showCopySuccess, setShowCopySuccess] = React.useState(false);
  
  // 歌词解析函数，提取纯歌词文本
  const parseLyrics = (lyricString: string) => {
    if (!lyricString) return [];
    const timeExp = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?]/g;
    const lines = lyricString.split('\n');
    const parsedLyrics = [];

    for (const line of lines) {
      const matches = [...line.matchAll(timeExp)];
      if (matches.length > 0) {
        const text = line.replace(timeExp, '').trim();
        for (const match of matches) {
          parsedLyrics.push({ text });
        }
      }
    }

    return parsedLyrics;
  };
  
  // 捕获导出图片
  const captureExportImage = async (): Promise<string> => {
    if (!exportRef.current) {
      throw new Error("导出区域不存在");
    }
    
    const canvas = await html2canvas(exportRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    
    return canvas.toDataURL("image/jpeg", 1.0);
  };
  
  // 导出 PDF
  const handleExportPDF = async () => {
    const img = await captureExportImage();
    const pdf = new jsPDF("p", "mm", "a4");
    
    // 使用与DOCX相同的A4尺寸
    const a4Width = 210; // A4宽度（mm）
    const a4Height = 297; // A4高度（mm）
    
    pdf.addImage(img, "JPEG", 0, 0, a4Width, a4Height);
    pdf.save("歌词卡片.pdf");
  };
  
  // 导出 Word
  const handleExportDOCX = async () => {
    const img = await captureExportImage();
    const binary = Uint8Array.from(
      atob(img.split(",")[1]),
      c => c.charCodeAt(0)
    );
    
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  type: "jpg",
                  data: binary,
                  transformation: {
                    width: 595,  // A4 宽
                    height: 842, // A4 高
                  },
                }),
              ],
            }),
          ],
        },
      ],
    });
    
    const blob = await Packer.toBlob(doc);
    saveAs(blob, "歌词卡片.docx");
  };
  
  // 处理导出按钮点击，这里可以添加格式选择逻辑
  const handleExport = () => {
    // 默认导出为PDF，或者可以添加格式选择
    handleExportPDF();
  };
  
  return (
    <div className="lyrics-tool-page">
      <h2>歌词工具</h2>

      <div className="lyrics-tool-container">
        <div className="lyrics-editor">
          <div className="editor-header">
            <h3>歌词编辑器</h3>
            <div className="editor-actions">
              <button className="tool-btn">导入</button>
              <button className="tool-btn" onClick={async () => {
                const textarea = document.querySelector('.lyrics-textarea') as HTMLTextAreaElement;
                if (textarea) {
                  // 提取纯歌词文本，不包含时间戳
                  const parsedLyrics = parseLyrics(textarea.value);
                  const pureLyrics = parsedLyrics.map(lyric => lyric.text).join('\n');
                  await navigator.clipboard.writeText(pureLyrics);
                  setShowCopySuccess(true);
                  setTimeout(() => setShowCopySuccess(false), 1500);
                }
              }}>复制</button>
              <button className="tool-btn" onClick={handleExport}>导出</button>
            </div>
            {showCopySuccess && (
              <div className="copy-success-toast">
                复制成功！
              </div>
            )}
          </div>
          <textarea
            className="lyrics-textarea"
            placeholder="在此粘贴或输入歌词..."
            rows={20}
          ></textarea>
        </div>

        <div className="lyrics-card-section">
          <div className="card-header">
            <h3>歌词卡片预览</h3>
            <button className="tool-btn">生成卡片</button>
          </div>
          <div className="lyrics-card-preview">
            <div className="card-preview-content">
              <div className="card-song-info">
                <div className="card-title">歌曲标题</div>
                <div className="card-artist">艺术家名称</div>
              </div>
              <div className="card-lyrics-preview">
                <p>第一段：</p>
                <p>示例歌词第一行</p>
                <p>示例歌词第二行</p>
                <br />
                <p>副歌：</p>
                <p>副歌歌词</p>
                <p>重复副歌行</p>
              </div>
              <div className="card-watermark">MeloRank</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 隐藏导出歌词卡片（不影响网页） */}
      <div
        ref={exportRef}
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "800px",
          background: "#fff",
          padding: "20px",
        }}
      >
        {/* 导出用的歌词卡片 */}
        <div className="lyrics-card-preview" style={{ margin: 0 }}>
          <div className="card-preview-content">
            <div className="card-song-info">
              <div className="card-title">歌曲标题</div>
              <div className="card-artist">艺术家名称</div>
            </div>
            <div className="card-lyrics-preview">
              <p>第一段：</p>
              <p>示例歌词第一行</p>
              <p>示例歌词第二行</p>
              <br />
              <p>副歌：</p>
              <p>副歌歌词</p>
              <p>重复副歌行</p>
            </div>
            <div className="card-watermark">MeloRank</div>
          </div>
        </div>
      </div>
    </div>
  );
}