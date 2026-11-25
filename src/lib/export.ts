import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
}

/**
 * Triggers a client-side CSV file download with UTF-8 BOM for clean Excel opening.
 */
export function exportToCSV<T>(filename: string, rows: T[], columns: ExportColumn<T>[]) {
  const escapeCell = (val: unknown) => {
    const str = String(val ?? "");
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = columns.map((c) => escapeCell(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCell(c.accessor(row))).join(",")
  );
  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/**
 * Triggers a genuine Excel (.xlsx) workbook download using SheetJS.
 */
export function exportToExcel<T>(
  filename: string,
  sheetName: string,
  rows: T[],
  columns: ExportColumn<T>[]
) {
  const data = rows.map((row) => {
    const record: Record<string, string | number> = {};
    for (const col of columns) {
      const val = col.accessor(row);
      record[col.header] = val === null || val === undefined ? "" : val;
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  const outName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, outName);
}

/**
 * Generates and downloads a formatted Movish Group PDF report using jsPDF.
 */
export function exportToPDF<T>(
  filename: string,
  title: string,
  subtitle: string,
  rows: T[],
  columns: ExportColumn<T>[]
) {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });

  doc.setFillColor(27, 49, 86);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("MOVISH GROUP — BUSINESS MANAGEMENT SYSTEM", 14, 10);
  doc.setFontSize(9);
  doc.text(`${title} | ${subtitle}`, 14, 17);

  autoTable(doc, {
    startY: 28,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) =>
      columns.map((c) => {
        const val = c.accessor(row);
        return val === null || val === undefined ? "—" : String(val);
      })
    ),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [11, 92, 168], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      `Generated ${new Date().toLocaleString("en-IN")} | Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
