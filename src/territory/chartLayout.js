// Pure layout maths for the horizontal BarChart.

// Shortens a label to at most `max` characters, ending with an ellipsis.
export function truncateLabel(label, max) {
  const s = String(label ?? '')
  const chars = Array.from(s)
  if (chars.length <= max) return s
  if (max <= 1) return '…'
  return chars.slice(0, max - 1).join('').trimEnd() + '…'
}

// Bar lengths in px for `values` within `trackWidth`. Largest value fills the track;
// any positive value gets at least `minBar` px so it stays visible; zero/invalid is 0.
export function barLengths(values, trackWidth, minBar = 2) {
  const nums = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0))
  const max = Math.max(0, ...nums)
  if (max === 0 || trackWidth <= 0) return nums.map(() => 0)
  return nums.map((v) => (v === 0 ? 0 : Math.max(minBar, (v / max) * trackWidth)))
}

// Splits chart width into label column, bar track and value column.
export function columnWidths(width, valueChars = 7) {
  const valueCol = Math.min(valueChars * 8 + 8, width * 0.3)
  const labelCol = Math.max(70, Math.min(width * 0.38, 160))
  const track = Math.max(0, width - labelCol - valueCol - 12)
  return { labelCol, valueCol, track, labelChars: Math.max(4, Math.floor(labelCol / 7)) }
}
