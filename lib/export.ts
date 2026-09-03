import ExcelJS from "exceljs";

export type { Worksheet } from "exceljs";

/* ------------------------------------------------------------------ */
/*  Date formatting                                                   */
/* ------------------------------------------------------------------ */

function formatDateForFile(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* ------------------------------------------------------------------ */
/*  Download helper                                                   */
/* ------------------------------------------------------------------ */

export async function downloadWorkbook(
  sheets: Array<{
    name: string;
    columns: { header: string; key: string }[];
    data: Record<string, unknown>[];
    images?: Array<{ base64: string; extension: "png" | "jpeg" | "gif"; width: number; height: number }>;
  }>,
  fileName: string,
) {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns;

    if (sheet.data.length > 0) {
      worksheet.addRows(sheet.data);
    }

    if (sheet.images && sheet.images.length > 0) {
      for (const image of sheet.images) {
        const img = workbook.addImage({
          base64: image.base64,
          extension: image.extension,
        });
        worksheet.addImage(img, {
          tl: { col: 0, row: 0 },
          ext: { width: image.width, height: image.height },
        });
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}_${formatDateForFile(new Date())}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Date filtering                                                    */
/* ------------------------------------------------------------------ */

export function isWithinLastDays(dateStr: string | undefined, days = 7): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return date >= cutoff;
}

export function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}
