# Tracking Orders PWA

Small PWA to track orders (React + Vite + IndexedDB).

Features
- Single interface with a search bar
- Form: Client, Product, Desired date
- Below the form: a list of order cards showing created date and info
- Each order card: toggle delivered/undelivered, edit order
- Offline-capable via service worker, stores data in IndexedDB

Quick start

1. Install deps

```powershell
npm install
```

2. Run dev server

```powershell
npm run dev
```

3. Build

```powershell
npm run build
npm run preview
```

Notes
- This scaffold uses the `idb` package to simplify IndexedDB usage.
- Service worker registers automatically; for full offline support add icons to `/public` and refine SW caching strategies.

Next steps / improvements
- Add icons to `public/` (icon-192.png, icon-512.png) for installability UI
- Add more robust caching and offline fallbacks
- Add simple unit tests (React Testing Library / Vitest)
