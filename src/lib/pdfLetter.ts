import { jsPDF } from 'jspdf'

/** Generate a simple multi-paragraph letter PDF and trigger a download. */
export function generateLetterPdf(filename: string, title: string, paragraphs: string[]) {
  const doc = new jsPDF()
  doc.setFontSize(16)
  doc.text(title, 14, 20)
  doc.setFontSize(11)
  let y = 34
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, 180) as string[]
    doc.text(lines, 14, y)
    y += lines.length * 6 + 4
  }
  doc.save(`${filename}.pdf`)
}
