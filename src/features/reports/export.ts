import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface ReportColumn {
  key: string
  label: string
}

type Row = Record<string, unknown>

/** Export rows to an .xlsx file (headers derived from the report columns). */
export function exportExcel(filename: string, columns: ReportColumn[], rows: Row[]) {
  const header = columns.map((c) => c.label)
  const body = rows.map((r) => columns.map((c) => r[c.key] ?? ''))
  const ws = XLSX.utils.aoa_to_sheet([header, ...body])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/** Export rows to a tabular .pdf (headers derived from the report columns). */
export function exportPdf(title: string, filename: string, columns: ReportColumn[], rows: Row[]) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ''))),
    startY: 22,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [79, 70, 229] },
  })
  doc.save(`${filename}.pdf`)
}
