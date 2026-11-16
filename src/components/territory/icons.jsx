import React from 'react'

// Small inline stroke icons (24×24 grid, currentColor). Decorative: aria-hidden; the
// control that holds one carries the accessible name.
function Icon({ size = 20, children, className, strokeWidth = 2 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}>
      {children}
    </svg>
  )
}

const make = (paths) => function NamedIcon(props) { return <Icon {...props}>{paths}</Icon> }

export const IconMap = make(<><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>)
export const IconFarm = make(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>)
export const IconCustomers = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.8c2 .7 3.5 2.4 3.5 5.2" /></>)
export const IconUser = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>)
export const IconNearby = make(<><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8.5" /><path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2" /></>)
export const IconMore = make(<><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>)
export const IconSearch = make(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>)
export const IconFilter = make(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>)
export const IconLocate = make(<><circle cx="12" cy="12" r="4" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="8" /></>)
export const IconPlus = make(<path d="M12 5v14M5 12h14" />)
export const IconMinus = make(<path d="M5 12h14" />)
export const IconClose = make(<path d="M6 6l12 12M18 6L6 18" />)
export const IconChevronRight = make(<path d="M9 6l6 6-6 6" />)
export const IconChevronDown = make(<path d="M6 9l6 6 6-6" />)
export const IconDirections = make(<><path d="M12 2.5l9.5 9.5-9.5 9.5L2.5 12z" /><path d="M9 13v-2a1 1 0 0 1 1-1h5" /><path d="M13 7.5L15.5 10 13 12.5" /></>)
export const IconExternal = make(<><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>)
export const IconEdit = make(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>)
export const IconTrash = make(<><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>)
export const IconDashboard = make(<><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>)
export const IconReports = make(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>)
export const IconData = make(<><ellipse cx="12" cy="5.5" rx="8" ry="3" /><path d="M4 5.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /><path d="M4 11.5v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>)
export const IconOrders = make(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></>)
export const IconNotes = make(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>)
export const IconShield = make(<><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>)
export const IconUpload = make(<><path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>)
export const IconDownload = make(<><path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>)
export const IconRestore = make(<><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 8v4l3 2" /></>)
export const IconSheet = make(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 9h16M4 15h16M10 3v18" /></>)
export const IconWarning = make(<><path d="M12 3.5L2.5 20h19z" /><path d="M12 10v4.5" /><path d="M12 17.5h0" /></>)
export const IconPhone = make(<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />)
export const IconLogout = make(<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h11" /></>)
export const IconGlobe = make(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" /></>)
export const IconCapacity = make(<><path d="M3.5 17a8.5 8.5 0 1 1 17 0" /><path d="M12 17l4.5-5.5" /><circle cx="12" cy="17" r="1.2" /></>)
export const IconPin = make(<><path d="M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>)
export const IconCloud = make(<><path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z" /><path d="M12 11v5M9.5 13.5L12 11l2.5 2.5" /></>)

// App logo: a map pin holding an egg.
export function LogoMark({ size = 32 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="var(--brand-600, #0f766e)" />
      <path d="M16 26s7-6.2 7-11.6A7 7 0 0 0 9 14.4C9 19.8 16 26 16 26z" fill="#fff" />
      <path d="M16 9.6c-1.9 0-3.3 2.6-3.3 4.9a3.3 3.3 0 0 0 6.6 0c0-2.3-1.4-4.9-3.3-4.9z" fill="var(--accent-500, #f59e0b)" />
    </svg>
  )
}
