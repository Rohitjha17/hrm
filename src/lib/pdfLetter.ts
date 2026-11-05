import { jsPDF } from 'jspdf'

/** Generate a simple multi-paragraph letter PDF and trigger a download. */
export async function generateLetterPdf(
  filename: string,
  title: string,
  paragraphs: string[],
  options?: { letterhead?: string | null; logoUrl?: string | null; footer?: string | null },
) {
  const doc = new jsPDF()
  if (options?.logoUrl) {
    try {
      const blob = await fetch(options.logoUrl).then((response) => response.blob())
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      doc.addImage(dataUrl, 14, 10, 28, 18)
    } catch {
      // A blocked external logo never prevents payroll download.
    }
  }
  if (options?.letterhead) {
    doc.setFontSize(10)
    doc.text(options.letterhead, 196, 14, { align: 'right' })
  }
  doc.setFontSize(16)
  doc.text(title, 14, options?.logoUrl ? 36 : 20)
  doc.setFontSize(11)
  let y = options?.logoUrl ? 48 : 34
  for (const p of paragraphs) {
    const lines = doc.splitTextToSize(p, 180) as string[]
    doc.text(lines, 14, y)
    y += lines.length * 6 + 4
  }
  if (options?.footer) {
    doc.setFontSize(9)
    doc.text(options.footer, 105, 285, { align: 'center' })
  }
  doc.save(`${filename}.pdf`)
}
