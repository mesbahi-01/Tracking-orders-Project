# Tracking Orders PWA

Small PWA to track orders (React + Vite + IndexedDB) with built-in authentication.

## Features
- Single interface with search bar
- Form: Client, Desired date, Multiple items (Product, Quantity, Unit)
- Order list with status badges (Pending, Delivered, Cancelled)
- Each order card: toggle delivered/undelivered, edit, cancel (undo), delete
- Offline-capable via service worker
- Data persists in IndexedDB locally
- **Simple login/authentication** with logout
- Sticky header and form for easy access while scrolling
- Scrollable order list with flex-based responsive layout

## Quick Start

1. Install deps
```powershell
npm install
```

2. Run dev server
```powershell
npm run dev
```

3. Open browser to `http://localhost:5173`
4. Login with any username/password (stored in browser localStorage)

## Build & Deploy

For production build:
```powershell
npm run build
npm run preview
```

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions** to Vercel, Netlify, or GitHub Pages.

## Project Structure

```
src/
├── main.jsx              # App entry, SW registration
├── App.jsx               # Main app with auth logic
├── db.js                 # IndexedDB wrapper
├── styles.css            # All styling
├── sw.js                 # Service worker for offline/caching
└── components/
    ├── Login.jsx         # Login form
    ├── OrderForm.jsx     # Create/edit orders with items
    └── OrderList.jsx     # Display orders, expandable items
public/
├── manifest.json         # PWA manifest
└── icon-*.png            # PWA icons (placeholder)
```

## How It Works

1. **Login**: Enter any username/password (stored in localStorage)
2. **Create Order**: 
   - Enter client name and desired date
   - Add multiple items (Product, Quantity, Unit)
   - Click "Add order"
3. **Manage Orders**:
   - Search by client or product
   - Click expand arrow to see items
   - Toggle delivery status
   - Edit or delete orders
   - Cancel/undo cancelled orders
4. **Logout**: Click logout button in top-right
5. **PWA Install**: On mobile, tap menu → Install app (after deployed)

## Technology Stack

- **React 18** - UI framework
- **Vite 5** - Build tool
- **IndexedDB** (via `idb` package) - Local storage
- **Service Worker** - Offline support & caching
- **PWA Manifest** - Installability

## Authentication

Current authentication is **simple localStorage-based** for basic security.
- Credentials stored in browser (not secure for sensitive data)
- For production, integrate with a backend or Firebase

## Offline Support

- App shell cached by service worker
- All orders stored in IndexedDB
- Works fully offline after first install
- Install as PWA for persistent app

## Notes

- Icons (`public/icon-192.png`, `public/icon-512.png`) are placeholders; replace with actual icons for better PWA install UX
- Orders are per-browser/device (IndexedDB is local)
- To share orders across devices, integrate a backend database

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment & troubleshooting.

