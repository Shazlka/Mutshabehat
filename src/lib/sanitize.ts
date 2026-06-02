import sanitizeHtml from 'sanitize-html'

// Tags produced by RichEditor (execCommand + contenteditable)
const NOTE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'span', 'div', 'br', 'p'],
  allowedAttributes: {
    span: ['style'],
    div:  ['dir'],
    p:    ['dir'],
  },
  allowedStyles: {
    span: {
      // Only allow hex or rgb colors — nothing else
      color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/],
    },
  },
}

export function sanitizeNote(html: string | null | undefined): string | null {
  if (!html) return html ?? null
  const clean = sanitizeHtml(html, NOTE_OPTIONS)
  return clean || null
}
