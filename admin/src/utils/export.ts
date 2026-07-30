import { brand } from '@/theme';
import type { OrderExportResult } from '@/services/order';

/** 简易 CSV 行解析（支持引号转义） */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function parseCsv(csv: string): string[][] {
  const raw = csv.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return raw
    .split('\n')
    .filter((line) => line.length > 0)
    .map(parseCsvLine);
}

/** CSV → Excel 兼容 HTML 表格（.xls），带表头样式与中文支持 */
export function csvToExcelHtmlBlob(csv: string): Blob {
  const rows = parseCsv(csv);
  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const colCount = rows.reduce((max, r) => Math.max(max, r.length), 0) || 1;
  // 经验列宽：单号/地址更宽
  const colWidths = Array.from({ length: colCount }, (_, i) => {
    if (i === 0 || i === 1) return 140;
    if (i === 7 || i === 14) return 200;
    return 100;
  });

  const thead = rows[0]
    ? `<tr>${rows[0]
        .map(
          (c) =>
            `<th style="background:${brand.primary};color:${brand.textInverse};font-weight:bold;border:1px solid ${brand.primaryDark};padding:6px 10px;white-space:nowrap;">${escapeHtml(c)}</th>`,
        )
        .join('')}</tr>`
    : '';

  const tbody = rows
    .slice(1)
    .map(
      (row) =>
        `<tr>${row
          .map(
            (c) =>
              `<td style="border:1px solid ${brand.gray300};padding:4px 8px;mso-number-format:'\\@';">${escapeHtml(c)}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('');

  const colGroup = `<colgroup>${colWidths.map((w) => `<col style="width:${w}px" />`).join('')}</colgroup>`;

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>订单</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
table { border-collapse: collapse; font-family: "Microsoft YaHei", SimSun, Arial, sans-serif; font-size: 12px; }
</style>
</head>
<body>
<table>${colGroup}<thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body>
</html>`;

  return new Blob([`\uFEFF${html}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const pure = base64.includes(',') ? base64.split(',').pop()! : base64;
  const binary = atob(pure);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function ensureExcelFilename(name?: string): string {
  const fallback = `orders_${new Date().toISOString().slice(0, 10)}.xls`;
  if (!name) return fallback;
  if (/\.csv$/i.test(name)) return name.replace(/\.csv$/i, '.xls');
  if (/\.(xls|xlsx)$/i.test(name)) return name;
  return `${name}.xls`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildExportBlob(data: OrderExportResult): { blob: Blob; filename: string } {
  const filename = ensureExcelFilename(data.xlsxFilename || data.filename);

  if (data.blob instanceof Blob) {
    return { blob: data.blob, filename };
  }

  const b64 = data.xlsxBase64 || data.xlsx || data.base64;
  if (b64) {
    const isXlsx = /\.xlsx$/i.test(filename);
    return {
      blob: base64ToBlob(
        b64,
        isXlsx
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/vnd.ms-excel',
      ),
      filename,
    };
  }

  const csv = data.csv || data.content;
  if (csv) {
    return {
      blob: csvToExcelHtmlBlob(csv),
      filename: ensureExcelFilename(filename.replace(/\.xlsx$/i, '.xls')),
    };
  }

  throw new Error('导出结果为空');
}
