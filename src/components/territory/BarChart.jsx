import React, { useEffect, useRef, useState } from 'react'
import { truncateLabel, barLengths, columnWidths } from '../../territory/chartLayout'

const ROW = 30
const BAR = 14

// Horizontal bars sized to the container. Single series: one colour, text in ink tokens.
export default function BarChart({ data, format = (n) => String(n), ariaLabel }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(320)

  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const apply = () => setWidth(Math.max(200, Math.floor(el.clientWidth || 320)))
    apply()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rows = data || []
  const formatted = rows.map((d) => format(d.value))
  const longest = Math.max(1, ...formatted.map((s) => s.length))
  const { labelCol, valueCol, track, labelChars } = columnWidths(width, longest)
  const lens = barLengths(rows.map((d) => d.value), track)
  const summary = ariaLabel || rows.map((d, i) => `${d.label}: ${formatted[i]}`).join('; ')

  return (
    <div ref={ref} className="bar-chart">
      {rows.length > 0 && (
        <svg width={width} height={rows.length * ROW} role="img" aria-label={summary} focusable="false">
          {rows.map((d, i) => {
            const y = i * ROW
            const cy = y + ROW / 2
            const x0 = labelCol + 6
            return (
              <g key={`${d.label}-${i}`}>
                <title>{`${d.label}: ${formatted[i]}`}</title>
                <text x={0} y={cy} dominantBaseline="central" className="bar-chart-label" dir="auto"
                  style={{ unicodeBidi: 'plaintext' }}>{truncateLabel(d.label, labelChars)}</text>
                <rect x={x0} y={cy - BAR / 2} width={track} height={BAR} rx={4} className="bar-chart-track" />
                {lens[i] > 0 && <rect x={x0} y={cy - BAR / 2} width={lens[i]} height={BAR} rx={4} className="bar-chart-bar" />}
                <text x={x0 + Math.max(lens[i], 0) + 6} y={cy} dominantBaseline="central" className="bar-chart-value">{formatted[i]}</text>
              </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}
