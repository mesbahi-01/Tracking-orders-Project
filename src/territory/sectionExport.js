import * as XLSX from 'xlsx'
import { rowsToSheet, downloadWorkbook } from './xlsxIO.js'

// Loaded via dynamic import() on click so SheetJS stays out of the main bundle.
export function downloadSection(sheetName, headers, rows, filename) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, rowsToSheet(headers, rows), sheetName.slice(0, 31))
  downloadWorkbook(wb, filename)
}
