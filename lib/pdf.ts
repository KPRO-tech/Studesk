'use client'

/**
 * PDF utilities:
 * - exportNotePdf: creates selectable text PDFs with pdf-lib only
 * - extractPdfText: extracts text from uploaded PDFs with pdfjs-dist
 */

export interface PdfExtractResult {
  text: string
  pages: number
}

export type PdfUnsupportedReason =
  | 'emoji'
  | 'control'
  | 'unsupported'

export interface PdfUnsupportedCharacter {
  char: string
  codePoint: string
  reason: PdfUnsupportedReason
}

export class UnsupportedPdfContentError extends Error {
  issues: PdfUnsupportedCharacter[]

  constructor(issues: PdfUnsupportedCharacter[]) {
    super('unsupported_pdf_content')
    this.name = 'UnsupportedPdfContentError'
    this.issues = issues
  }
}

let workerConfigured = false

async function getPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
    workerConfigured = true
  }
  return pdfjs
}

type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic'
type Alignment = 'left' | 'center' | 'right'

interface TextRun {
  text: string
  style: FontStyle
  underline?: boolean
  strikethrough?: boolean
  link?: string
}

interface Block {
  type: 'paragraph' | 'h1' | 'h2' | 'h3' | 'hr' | 'li'
  runs: TextRun[]
  alignment: Alignment
  indent?: number
  listMarker?: string
}

type PdfFont = import('pdf-lib').PDFFont

type PdfLine = {
  runs: (TextRun & { font: PdfFont })[]
  lineH: number
  alignment: Alignment
  indent: number
  listMarker?: string
  blockType: Block['type']
}

type FontSet = {
  regular: PdfFont
  bold: PdfFont
  italic: PdfFont
  boldItalic: PdfFont
}

const A4 = { width: 595.28, height: 841.89 }
const PAGE_MARGIN = { left: 52, right: 52, top: 52, bottom: 52 }
const CONTENT_WIDTH = A4.width - PAGE_MARGIN.left - PAGE_MARGIN.right
const CONTROL_CHAR_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/

export function isUnsupportedPdfContentError(
  error: unknown,
): error is UnsupportedPdfContentError {
  return (
    error instanceof UnsupportedPdfContentError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'UnsupportedPdfContentError' &&
      'issues' in error)
  )
}

export function sanitizePdfPlainText(value: string): string {
  return Array.from(value)
    .filter((char) => isPdfSafeCharacter(char))
    .join('')
}

export function sanitizePdfHtml(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined') return sanitizePdfPlainText(html)

  const template = document.createElement('template')
  template.innerHTML = looksLikeHtml(html) ? html : escapeHtml(html)

  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT,
  )
  const textNodes: Text[] = []
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text)
  }
  for (const node of textNodes) {
    node.nodeValue = sanitizePdfPlainText(node.nodeValue ?? '')
  }

  return template.innerHTML
}

export function findUnsupportedPdfCharacters(
  values: string[],
): PdfUnsupportedCharacter[] {
  const seen = new Set<string>()
  const issues: PdfUnsupportedCharacter[] = []

  for (const value of values) {
    for (const char of Array.from(value)) {
      if (isPdfSafeCharacter(char)) continue
      const codePoint = toCodePoint(char)
      if (seen.has(codePoint)) continue
      seen.add(codePoint)
      issues.push({
        char,
        codePoint,
        reason: getUnsupportedReason(char),
      })
      if (issues.length >= 16) return issues
    }
  }

  return issues
}

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
  const { PDFDocument, PDFName, rgb, StandardFonts } = await import('pdf-lib')

  const safeTitle = sanitizePdfPlainText(title).trim() || 'Sans titre'
  const dateStr = sanitizePdfPlainText(
    new Date(updatedAt).toLocaleString(locale),
  )
  const blocks = parseHtml(html)
  const unsupported = findUnsupportedPdfCharacters([
    title,
    dateStr,
    ...blocks.flatMap((block) => block.runs.map((run) => run.text)),
  ])

  if (unsupported.length > 0) {
    throw new UnsupportedPdfContentError(unsupported)
  }

  const pdfDoc = await PDFDocument.create()
  pdfDoc.setTitle(safeTitle)
  pdfDoc.setCreator('Studesk')
  pdfDoc.setSubject('Note Studesk')

  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
  }

  const titleLines = wrapRuns(
    [{ text: safeTitle, style: 'bold' }],
    'h1',
    'left',
    0,
    undefined,
    fonts,
  )
  const dateLines = wrapRuns(
    [{ text: dateStr, style: 'normal' }],
    'paragraph',
    'left',
    0,
    undefined,
    fonts,
  )
  const bodyLines = blocks.flatMap((block, index) => {
    if (block.type === 'hr') {
      return [
        {
          runs: [],
          lineH: 20,
          alignment: 'left' as Alignment,
          indent: 0,
          blockType: 'hr' as Block['type'],
        },
      ]
    }

    const before = blockSpacingBefore(block.type, index)
    const lines = wrapRuns(
      block.runs,
      block.type,
      block.alignment,
      block.indent ?? 0,
      block.listMarker,
      fonts,
    )

    return before > 0
      ? [
          {
            runs: [],
            lineH: before,
            alignment: 'left' as Alignment,
            indent: 0,
            blockType: 'paragraph' as Block['type'],
          },
          ...lines,
        ]
      : lines
  })

  const allLines: PdfLine[] = [
    ...titleLines,
    ...dateLines.map((line) => ({ ...line, lineH: 18 })),
    {
      runs: [],
      lineH: 18,
      alignment: 'left',
      indent: 0,
      blockType: 'hr',
    },
    ...bodyLines,
  ]

  let page = pdfDoc.addPage([A4.width, A4.height])
  let y = A4.height - PAGE_MARGIN.top

  for (const line of allLines) {
    if (y - line.lineH < PAGE_MARGIN.bottom) {
      page = pdfDoc.addPage([A4.width, A4.height])
      y = A4.height - PAGE_MARGIN.top
    }

    y -= line.lineH

    if (line.blockType === 'hr') {
      page.drawLine({
        start: { x: PAGE_MARGIN.left, y: y + line.lineH / 2 },
        end: { x: A4.width - PAGE_MARGIN.right, y: y + line.lineH / 2 },
        thickness: 0.5,
        color: rgb(0.82, 0.84, 0.86),
      })
      continue
    }

    if (line.runs.length === 0) continue

    const fs = fontSize(line.blockType)
    const indent = line.indent * 18
    const lineMaxWidth = CONTENT_WIDTH - indent
    let xStart = PAGE_MARGIN.left + indent

    if (line.listMarker) {
      page.drawText(line.listMarker, {
        x: xStart,
        y,
        size: fs,
        font: fonts.regular,
        color: rgb(0.08, 0.08, 0.08),
      })
      xStart += fonts.regular.widthOfTextAtSize(`${line.listMarker}  `, fs)
    }

    const totalWidth = line.runs.reduce(
      (total, run) => total + run.font.widthOfTextAtSize(run.text, fs),
      0,
    )

    let x = xStart
    if (line.alignment === 'center') x = xStart + (lineMaxWidth - totalWidth) / 2
    if (line.alignment === 'right') x = xStart + lineMaxWidth - totalWidth

    for (const run of line.runs) {
      if (!run.text) continue
      const runWidth = run.font.widthOfTextAtSize(run.text, fs)
      const textColor = run.link ? rgb(0.15, 0.4, 0.86) : rgb(0.08, 0.08, 0.08)

      page.drawText(run.text, {
        x,
        y,
        size: fs,
        font: run.font,
        color: textColor,
      })

      if (run.underline || run.link) {
        page.drawLine({
          start: { x, y: y - 1.5 },
          end: { x: x + runWidth, y: y - 1.5 },
          thickness: 0.6,
          color: textColor,
        })
      }

      if (run.strikethrough) {
        page.drawLine({
          start: { x, y: y + fs * 0.35 },
          end: { x: x + runWidth, y: y + fs * 0.35 },
          thickness: 0.6,
          color: textColor,
        })
      }

      if (run.link) {
        const annotation = pdfDoc.context.obj({
          Type: 'Annot',
          Subtype: 'Link',
          Rect: [x, y - 2, x + runWidth, y + fs],
          Border: [0, 0, 0],
          A: { Type: 'Action', S: 'URI', URI: normalizeUrl(run.link) },
        })
        const annotationRef = pdfDoc.context.register(annotation)
        const existing = page.node.Annots()
        if (existing) {
          existing.push(annotationRef)
        } else {
          page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([annotationRef]))
        }
      }

      x += runWidth
    }
  }

  const bytes = await pdfDoc.save()
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${toPdfFileName(safeTitle)}.pdf`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function parseHtml(html: string): Block[] {
  const source = html.trim()
  if (!source) {
    return [
      {
        type: 'paragraph',
        runs: [{ text: 'Note vide', style: 'italic' }],
        alignment: 'left',
      },
    ]
  }

  const template = document.createElement('template')
  template.innerHTML = looksLikeHtml(source) ? source : escapeHtml(source)
  const blocks: Block[] = []
  parseChildren(template.content, blocks, 0)

  return blocks.length > 0
    ? blocks
    : [{ type: 'paragraph', runs: collectRuns(template.content, {}), alignment: 'left' }]
}

function parseChildren(parent: ParentNode, blocks: Block[], depth: number) {
  let pending: TextRun[] = []

  const flushPending = () => {
    const runs = trimRuns(pending)
    if (runs.length) {
      blocks.push({ type: 'paragraph', runs, alignment: 'left' })
    }
    pending = []
  }

  parent.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      pending.push(...collectRuns(node, {}))
      return
    }

    if (!(node instanceof HTMLElement)) return

    const tag = node.tagName.toLowerCase()
    if (tag === 'br') {
      pending.push({ text: ' ', style: 'normal' })
      return
    }

    if (tag === 'hr') {
      flushPending()
      blocks.push({ type: 'hr', runs: [], alignment: 'left' })
      return
    }

    if (/^h[1-6]$/.test(tag)) {
      flushPending()
      const level = Number(tag.slice(1))
      const type: Block['type'] = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3'
      const runs = trimRuns(collectRuns(node, { style: 'bold' }))
      if (runs.length) blocks.push({ type, runs, alignment: getAlignment(node) })
      return
    }

    if (tag === 'ul' || tag === 'ol') {
      flushPending()
      parseList(node, blocks, tag === 'ol', depth)
      return
    }

    if (tag === 'p' || tag === 'div' || tag === 'section' || tag === 'article') {
      flushPending()
      if (hasDirectBlockChild(node)) {
        parseChildren(node, blocks, depth)
      } else {
        const runs = trimRuns(collectRuns(node, {}))
        if (runs.length) blocks.push({ type: 'paragraph', runs, alignment: getAlignment(node) })
      }
      return
    }

    pending.push(...collectRuns(node, {}))
  })

  flushPending()
}

function parseList(
  list: HTMLElement,
  blocks: Block[],
  ordered: boolean,
  depth: number,
) {
  let index = 1
  list.childNodes.forEach((node) => {
    if (!(node instanceof HTMLElement) || node.tagName.toLowerCase() !== 'li') return

    const runs = trimRuns(collectRuns(node, {}, true))
    if (runs.length) {
      blocks.push({
        type: 'li',
        runs,
        alignment: getAlignment(node),
        indent: depth + 1,
        listMarker: ordered ? `${index}.` : '-',
      })
    }
    index += 1

    node.childNodes.forEach((child) => {
      if (!(child instanceof HTMLElement)) return
      const tag = child.tagName.toLowerCase()
      if (tag === 'ul' || tag === 'ol') {
        parseList(child, blocks, tag === 'ol', depth + 1)
      }
    })
  })
}

function collectRuns(
  node: Node,
  inherited: Partial<TextRun>,
  skipLists = false,
): TextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeWhitespace(node.textContent ?? '')
    return text ? [{ text, style: inherited.style ?? 'normal', ...inherited }] : []
  }

  if (!(node instanceof HTMLElement || node instanceof DocumentFragment)) return []
  if (node instanceof HTMLElement) {
    const tag = node.tagName.toLowerCase()
    if (skipLists && (tag === 'ul' || tag === 'ol')) return []
    if (tag === 'br') return [{ text: ' ', style: inherited.style ?? 'normal', ...inherited }]
    if (tag === 'script' || tag === 'style' || tag === 'hr') return []

    const next: Partial<TextRun> = { ...inherited }
    if (tag === 'b' || tag === 'strong') next.style = addBold(next.style)
    if (tag === 'i' || tag === 'em') next.style = addItalic(next.style)
    if (tag === 'u') next.underline = true
    if (tag === 's' || tag === 'strike' || tag === 'del') next.strikethrough = true
    if (tag === 'a') {
      next.link = node.getAttribute('href') ?? undefined
      next.underline = true
    }

    const styleAttr = node.getAttribute('style') ?? ''
    if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(styleAttr)) {
      next.style = addBold(next.style)
    }
    if (/font-style\s*:\s*italic/i.test(styleAttr)) next.style = addItalic(next.style)
    if (/text-decoration[^;]*underline/i.test(styleAttr)) next.underline = true
    if (/text-decoration[^;]*(line-through|strike)/i.test(styleAttr)) {
      next.strikethrough = true
    }

    return Array.from(node.childNodes).flatMap((child) =>
      collectRuns(child, next, skipLists),
    )
  }

  return Array.from(node.childNodes).flatMap((child) =>
    collectRuns(child, inherited, skipLists),
  )
}

function wrapRuns(
  runs: TextRun[],
  type: Block['type'],
  alignment: Alignment,
  indent: number,
  listMarker: string | undefined,
  fonts: FontSet,
): PdfLine[] {
  const fs = fontSize(type)
  const maxWidth = CONTENT_WIDTH - indent * 18
  const markerWidth = listMarker
    ? fonts.regular.widthOfTextAtSize(`${listMarker}  `, fs)
    : 0
  const lines: PdfLine[] = []
  let current: (TextRun & { font: PdfFont })[] = []
  let currentWidth = 0

  const pushLine = () => {
    const trimmed = trimLineRuns(current)
    if (trimmed.length) {
      lines.push({
        runs: trimmed,
        lineH: lineSpacing(type),
        alignment,
        indent,
        listMarker: lines.length === 0 ? listMarker : undefined,
        blockType: type,
      })
    }
    current = []
    currentWidth = 0
  }

  for (const run of runs) {
    const font = pickFont(fonts, run.style)
    const parts = run.text.split(/(\s+)/)
    for (const raw of parts) {
      if (!raw) continue
      const text = /\s+/.test(raw) ? ' ' : raw
      if (!current.length && text === ' ') continue

      const availableWidth =
        maxWidth - (lines.length === 0 && listMarker ? markerWidth : 0)
      const width = font.widthOfTextAtSize(text, fs)

      if (current.length && currentWidth + width > availableWidth) {
        pushLine()
        if (text === ' ') continue
      }

      if (width > availableWidth) {
        for (const char of Array.from(text)) {
          const charWidth = font.widthOfTextAtSize(char, fs)
          if (current.length && currentWidth + charWidth > availableWidth) {
            pushLine()
          }
          current.push({ ...run, text: char, font })
          currentWidth += charWidth
        }
      } else {
        current.push({ ...run, text, font })
        currentWidth += width
      }
    }
  }

  if (current.length) pushLine()
  return lines
}

function fontSize(type: Block['type']): number {
  if (type === 'h1') return 22
  if (type === 'h2') return 17
  if (type === 'h3') return 14
  return 11.5
}

function lineSpacing(type: Block['type']): number {
  if (type === 'h1') return 31
  if (type === 'h2') return 24
  if (type === 'h3') return 20
  return 17
}

function blockSpacingBefore(type: Block['type'], index: number): number {
  if (index === 0) return 0
  if (type === 'h1') return 12
  if (type === 'h2') return 10
  if (type === 'h3') return 8
  if (type === 'li') return 2
  return 5
}

function pickFont(fonts: FontSet, style: FontStyle): PdfFont {
  if (style === 'bold') return fonts.bold
  if (style === 'italic') return fonts.italic
  if (style === 'bolditalic') return fonts.boldItalic
  return fonts.regular
}

function addBold(style: FontStyle = 'normal'): FontStyle {
  return style === 'italic' || style === 'bolditalic' ? 'bolditalic' : 'bold'
}

function addItalic(style: FontStyle = 'normal'): FontStyle {
  return style === 'bold' || style === 'bolditalic' ? 'bolditalic' : 'italic'
}

function trimRuns(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && sameRunStyle(last, run)) {
      last.text += run.text
    } else {
      merged.push({ ...run })
    }
  }

  if (merged[0]) merged[0].text = merged[0].text.replace(/^\s+/, '')
  if (merged[merged.length - 1]) {
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, '')
  }

  return merged.filter((run) => run.text.length > 0)
}

function trimLineRuns<T extends TextRun>(runs: T[]): T[] {
  if (runs[0]) runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, '') }
  if (runs[runs.length - 1]) {
    runs[runs.length - 1] = {
      ...runs[runs.length - 1],
      text: runs[runs.length - 1].text.replace(/\s+$/, ''),
    }
  }
  return runs.filter((run) => run.text.length > 0)
}

function sameRunStyle(a: TextRun, b: TextRun): boolean {
  return (
    a.style === b.style &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.strikethrough) === Boolean(b.strikethrough) &&
    a.link === b.link
  )
}

function getAlignment(node: HTMLElement): Alignment {
  const value = (node.style.textAlign || node.getAttribute('align') || '').toLowerCase()
  if (value === 'center' || value === 'right') return value
  return 'left'
}

function hasDirectBlockChild(node: HTMLElement): boolean {
  return Array.from(node.children).some((child) =>
    /^(p|div|section|article|h[1-6]|ul|ol|hr)$/i.test(child.tagName),
  )
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[\t\r\n]+/g, ' ')
}

function normalizeUrl(value: string): string {
  const url = value.trim()
  if (!url) return ''
  try {
    const parsed = new URL(url, window.location.origin)
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return parsed.toString()
    }
  } catch {
    return ''
  }
  return ''
}

function isPdfSafeCharacter(char: string): boolean {
  if (CONTROL_CHAR_PATTERN.test(char)) return false
  if (char === '\n' || char === '\r' || char === '\t') return true
  if (isEmojiLike(char)) return false

  try {
    STANDARD_FONT_METRICS.encodeText(char)
    return true
  } catch {
    return false
  }
}

function getUnsupportedReason(char: string): PdfUnsupportedReason {
  if (CONTROL_CHAR_PATTERN.test(char)) return 'control'
  if (isEmojiLike(char)) return 'emoji'
  return 'unsupported'
}

function isEmojiLike(char: string): boolean {
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}|\uFE0F/u.test(char)
}

function toCodePoint(char: string): string {
  const code = char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')
  return code ? `U+${code}` : 'U+0000'
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toPdfFileName(title: string): string {
  const normalized = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return normalized || 'note'
}

const STANDARD_FONT_METRICS = {
  encodeText(char: string) {
    const code = char.codePointAt(0)
    if (
      code == null ||
      !(
        code === 0x09 ||
        code === 0x0a ||
        code === 0x0d ||
        (code >= 0x20 && code <= 0x7e) ||
        (code >= 0xa0 && code <= 0xff)
      )
    ) {
      throw new Error('unsupported_character')
    }
  },
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
