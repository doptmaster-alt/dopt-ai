import fs from 'fs';
import path from 'path';

export interface ParsedFile {
  fileName: string;
  fileType: string;
  textContent: string | null;
  base64Image: string | null;
  mimeType: string | null;
}

export async function parseFile(filePath: string, originalName: string): Promise<ParsedFile> {
  const ext = path.extname(originalName).toLowerCase();
  const mimeType = getMimeType(ext);

  // 이미지 파일 → Claude Vision API용 base64
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return {
      fileName: originalName,
      fileType: 'image',
      textContent: null,
      base64Image: base64,
      mimeType: mimeType,
    };
  }

  // PDF 파일
  if (ext === '.pdf') {
    try {
      const pdfParse = (await import('pdf-parse') as any).default;
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return {
        fileName: originalName,
        fileType: 'pdf',
        textContent: data.text,
        base64Image: null,
        mimeType: null,
      };
    } catch (e: any) {
      return {
        fileName: originalName,
        fileType: 'pdf',
        textContent: `[PDF 파싱 오류: ${e.message}]`,
        base64Image: null,
        mimeType: null,
      };
    }
  }

  // Word 문서 (.docx)
  if (ext === '.docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return {
        fileName: originalName,
        fileType: 'docx',
        textContent: result.value,
        base64Image: null,
        mimeType: null,
      };
    } catch (e: any) {
      return {
        fileName: originalName,
        fileType: 'docx',
        textContent: `[DOCX 파싱 오류: ${e.message}]`,
        base64Image: null,
        mimeType: null,
      };
    }
  }

  // Excel 파일
  if (['.xlsx', '.xls'].includes(ext)) {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.readFile(filePath);
      let allText = '';
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        allText += `\n[시트: ${sheetName}]\n${csv}\n`;
      }
      return {
        fileName: originalName,
        fileType: 'excel',
        textContent: allText.trim(),
        base64Image: null,
        mimeType: null,
      };
    } catch (e: any) {
      return {
        fileName: originalName,
        fileType: 'excel',
        textContent: `[Excel 파싱 오류: ${e.message}]`,
        base64Image: null,
        mimeType: null,
      };
    }
  }

  // PowerPoint 파일 (.pptx)
  if (ext === '.pptx') {
    try {
      const officeparser = await import('officeparser');
      const result = await officeparser.parseOffice(filePath);
      // officeparser v6+ returns structured object with toText()
      let text: string;
      if (typeof result === 'string') {
        text = result;
      } else if (result && typeof result.toText === 'function') {
        text = result.toText();
      } else if (result && result.content) {
        text = JSON.stringify(result.content);
      } else {
        text = String(result);
      }
      return {
        fileName: originalName,
        fileType: 'pptx',
        textContent: text,
        base64Image: null,
        mimeType: null,
      };
    } catch (e: any) {
      return {
        fileName: originalName,
        fileType: 'pptx',
        textContent: `[PPTX 파싱 오류: ${e.message}]`,
        base64Image: null,
        mimeType: null,
      };
    }
  }

  // 텍스트 파일 (.txt, .csv, .md)
  if (['.txt', '.csv', '.md', '.json'].includes(ext)) {
    const text = fs.readFileSync(filePath, 'utf-8');
    return {
      fileName: originalName,
      fileType: 'text',
      textContent: text,
      base64Image: null,
      mimeType: null,
    };
  }

  return {
    fileName: originalName,
    fileType: 'unknown',
    textContent: `[지원하지 않는 파일 형식: ${ext}]`,
    base64Image: null,
    mimeType: null,
  };
}

function getMimeType(ext: string): string | null {
  const types: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return types[ext] || null;
}
