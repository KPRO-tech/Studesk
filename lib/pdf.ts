'use client'

/**
 * Client-side PDF text extraction using pdfjs-dist.
 * Loaded lazily so the heavy worker bundle is only fetched when a user
 * actually uploads a PDF (keeps the rest of the app light).
 */

export interface PdfExtractResult {
  text: string
  pages: number
}

let workerConfigured = false

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerConfigured) {
    // Turbopack/webpack resolve this to a bundled worker URL.
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    workerConfigured = true
  }
  return pdfjs
}

/**
 * Export a rich-text note to PDF while preserving its formatting (bold,
 * italic, underline, strike, headings, lists, alignment, separators, links).
 *
 * We render the note's HTML inside an offscreen, print-styled container and
 * let jsPDF rasterize it with html2canvas. The container uses plain sRGB
 * colors (hex) on purpose — html2canvas 1.x cannot parse `oklch()`, which the
 * app theme relies on, so we never inherit the app stylesheet here.
 */
export async function exportNotePdf({
  title,
  html,
  updatedAt,
  locale = 'fr-FR',
}: {
  title: string
  html: string
  updatedAt: number
  locale?: string
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas')).default
  // @ts-expect-error jsPDF requires html2canvas globally or injected
  window.html2canvas = html2canvas

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const safeTitle = title.trim() || 'Sans titre'
  const dateStr = new Date(updatedAt).toLocaleString(locale)

  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '0'
  container.style.width = '720px'
  container.style.background = '#ffffff'
  container.innerHTML = `
    <style>
      .pdf-doc * { box-sizing: border-box; }
      .pdf-doc {
        width: 720px;
        padding: 8px 4px;
        font-family: Helvetica, Arial, sans-serif;
        font-size: 15px;
        line-height: 1.6;
        color: #1a1a1a;
        background: #ffffff;
        word-break: break-word;
      }
      .pdf-doc h1.pdf-title { font-size: 26px; font-weight: 700; margin: 0 0 4px; }
      .pdf-doc .pdf-meta { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
      .pdf-doc hr.pdf-rule { border: none; border-top: 1px solid #d1d5db; margin: 16px 0; }
      .pdf-doc h1, .pdf-doc h2, .pdf-doc h3 { font-weight: 700; margin: 18px 0 8px; line-height: 1.3; }
      .pdf-doc h2 { font-size: 20px; }
      .pdf-doc h1:not(.pdf-title) { font-size: 23px; }
      .pdf-doc p, .pdf-doc div { margin: 0 0 8px; }
      .pdf-doc ul, .pdf-doc ol { margin: 0 0 8px; padding-left: 24px; }
      .pdf-doc li { margin: 0 0 4px; }
      .pdf-doc a { color: #2563eb; text-decoration: underline; }
      .pdf-doc u { text-decoration: underline; }
      .pdf-doc s, .pdf-doc strike { text-decoration: line-through; }
      .pdf-doc hr { border: none; border-top: 1px solid #d1d5db; margin: 14px 0; }
      .pdf-doc img { max-width: 100%; }
    </style>
    <div class="pdf-doc">
      <h1 class="pdf-title">${escapeHtml(safeTitle)}</h1>
      <p class="pdf-meta">${escapeHtml(dateStr)}</p>
      <hr class="pdf-rule" />
      <div class="pdf-body">${html || '<p style="color:#9ca3af">Note vide</p>'}</div>
    </div>
  `
  document.body.appendChild(container)

  try {
    const target = container.querySelector('.pdf-doc') as HTMLElement
    await doc.html(target, {
      x: 40,
      y: 40,
      width: 515, // A4 width (595pt) minus 40pt margins on each side
      windowWidth: 720,
      autoPaging: 'text',
      margin: [40, 40, 48, 40],
    })
    doc.save(`${safeTitle.replace(/[^\w-]+/g, '_') || 'note'}.pdf`)
  } finally {
    document.body.removeChild(container)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Extract plain text from a PDF file. Throws on unreadable files. */
export async function extractPdfText(
  file: File,
  opts: { maxChars?: number } = {},
): Promise<PdfExtractResult> {
  const maxChars = opts.maxChars ?? 24_000
  const pdfjs = await getPdfjs()
  const buffer = await file.arrayBuffer()
  const loadingTask = pdfjs.getDocument({ data: buffer })
  const doc = await loadingTask.promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const strings = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .filter(Boolean)
    text += strings.join(' ') + '\n\n'
    if (text.length >= maxChars) break
  }
  const pages = doc.numPages
  await loadingTask.destroy().catch(() => {})
  const trimmed = text.trim().slice(0, maxChars)
  if (!trimmed) throw new Error('empty_pdf')
  return { text: trimmed, pages }
}
