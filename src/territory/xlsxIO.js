import * as XLSX from 'xlsx'

// Reads a File/Blob or an ArrayBuffer/Uint8Array into a workbook.
export async function readWorkbook(fileOrArrayBuffer) {
  let data = fileOrArrayBuffer
  if (data && typeof data.arrayBuffer === 'function') data = await data.arrayBuffer()
  return XLSX.read(data, { type: 'array' })
}

export function downloadBuffer(buffer, filename) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export function downloadWorkbook(wb, filename) {
  downloadBuffer(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), filename)
}

// Raw cell values; empty cells are null. First row is the header row.
export function sheetRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName]
  if (!ws) return { headers: [], rows: [] }
  const all = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false })
  const [head = [], ...rows] = all
  const headers = head.map((h) => (h === null || h === undefined ? '' : String(h)))
  return { headers, rows }
}

// Builds a sheet with explicitly typed cells so strings never turn into numbers,
// dates or formulas. null/undefined leave the cell empty.
export function rowsToSheet(headers, rows) {
  const ws = {}
  const all = [headers, ...rows]
  let maxCol = 0
  all.forEach((row, r) => {
    row.forEach((v, c) => {
      if (c > maxCol) maxCol = c
      if (v === null || v === undefined) return
      const ref = XLSX.utils.encode_cell({ r, c })
      if (typeof v === 'boolean') ws[ref] = { t: 'b', v }
      else if (typeof v === 'number') ws[ref] = { t: 'n', v }
      else ws[ref] = { t: 's', v: String(v) }
    })
  })
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(all.length - 1, 0), c: Math.max(maxCol, 0) } })
  return ws
}
