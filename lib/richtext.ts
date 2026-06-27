/** Helpers for the lightweight HTML rich-text notes. */

/** Heuristic: does this string already contain HTML markup? */
export function isHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

/** Escape plain text and preserve line breaks as <br>. */
export function plainTextToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped.replace(/\n/g, '<br>')
}

/** Normalize stored note content to HTML for the editor. */
export function toEditorHtml(content: string): string {
  if (!content) return ''
  return isHtml(content) ? content : plainTextToHtml(content)
}

/** Convert note HTML to readable plain text (for previews & PDF export). */
export function htmlToText(html: string): string {
  if (!html) return ''
  if (typeof document === 'undefined' || !isHtml(html)) {
    return html.replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim()
  }
  const root = document.createElement('div')
  root.innerHTML = html
    .replace(/<\/(p|div|h[1-6]|li|hr|tr)>/gi, '\n')
    .replace(/<br\s*\/?>(?!\n)/gi, '\n')
  const text = root.textContent ?? ''
  return text.replace(/\n{3,}/g, '\n\n').trim()
}
