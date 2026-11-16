const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normalizeName(s) {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\u0640\u064B-\u0652]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNumberLoose(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const t = v.trim().replace(',', '.')
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function parseCapacity(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : null
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(\d[\d\s.,\u00a0\u202f]*)/)
  if (!m) return null
  const digits = m[1].replace(/[\s.,\u00a0\u202f]/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}
