# Deployment Guide

## Local Build

First, test the production build locally:

```powershell
npm run build
npm run preview
```

Visit `http://localhost:4173` to preview the production build.

---

## Option 1: Deploy to Vercel (Recommended - Easiest)

Vercel is the easiest and fastest way to deploy React/Vite apps.

### Steps:

1. **Push to GitHub** (if not already done)
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/tracking-orders-pwa.git
   git branch -M main
   git push -u origin main
   ```

2. **Go to Vercel**
   - Visit https://vercel.com
   - Click "Sign Up" and login with GitHub
   - Click "New Project"
   - Select your repository
   - Vercel auto-detects Vite settings
   - Click "Deploy"

3. **Done!** Your app will be live at a URL like `https://tracking-orders-pwa.vercel.app`

### Environment Variables (if needed)
- No special configuration needed for this app since it uses IndexedDB locally

---

## Option 2: Deploy to Netlify

### Steps:

1. **Build the app**
   ```powershell
   npm run build
   ```

2. **Drag and drop to Netlify**
   - Go to https://app.netlify.com
   - Sign up/login
   - Drag the `dist/` folder to the deploy area
   - Done! You'll get a live URL

3. **Or connect GitHub**
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Select GitHub repository
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click "Deploy"

---

## Option 3: Deploy to GitHub Pages

GitHub Pages is free and integrates directly with your GitHub repository.

### Prerequisites

- GitHub account
- Git installed on your machine
- Repository created on GitHub named `tracking-orders-pwa`

### Steps:

1. **Initialize Git** (if not done already)
   ```powershell
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/tracking-orders-pwa.git
   git branch -M main
   git push -u origin main
   ```
   Replace `YOUR_USERNAME` with your GitHub username.

2. **Build the app**
   ```powershell
   npm run build
   ```

3. **Push to GitHub**
   ```powershell
   git add .
   git commit -m "Build for GitHub Pages"
   git push origin main
   ```

4. **Enable GitHub Pages** in your repository
   - Go to your GitHub repository → **Settings** → **Pages**
   - Under "Build and deployment":
     - Source: **Deploy from a branch**
     - Branch: **main** / folder: **/ (root)** or **/dist**
     - Click **Save**

5. **Wait for deployment**
   - GitHub will build and deploy automatically
   - Check "Actions" tab to see build status
   - Your site will be live at: `https://YOUR_USERNAME.github.io/tracking-orders-pwa`

### Automatic Deployment

Every time you push to `main` branch, GitHub Pages will automatically rebuild and deploy.

**Quick deploy after making changes:**
```powershell
npm run build
git add .
git commit -m "Update: your changes here"
git push origin main
```

### Custom Domain (Optional)

To use a custom domain:
1. Go to repo → Settings → Pages
2. Under "Custom domain", enter your domain
3. Update DNS records at your domain provider to point to GitHub Pages



---

## Post-Deployment Checklist

- [ ] Test login with any username/password
- [ ] Add an order with multiple items
- [ ] Search for orders
- [ ] Toggle delivered status
- [ ] Edit an order
- [ ] Delete an order
- [ ] Undo a cancelled order
- [ ] Test PWA install (click menu → "Install app" on mobile or "Install" on desktop)
- [ ] Check offline functionality (after PWA install, disable network and verify it still works)

---

## Authentication Notes

Current authentication is **simple localStorage-based** and intended for basic security. It stores credentials in browser storage.

For production with real security, consider:
- Adding a backend with JWT tokens
- Using Firebase Authentication
- Implementing OAuth

---

## Performance & PWA

- **Build size**: ~150-200KB (uncompressed)
- **Offline support**: Enabled via service worker
- **Installable**: Yes (manifest.json + service worker registered)
- **IndexedDB**: Persists all orders locally

---

## Troubleshooting

**App not loading?**
- Check browser console for errors
- Ensure service worker is registered (Network tab in DevTools)
- Clear browser cache and reload

**PWA not installing?**
- Ensure HTTPS is used (all deployment platforms above use HTTPS)
- Check manifest.json is accessible
- Service worker must be registered successfully

**Orders not persisting?**
- IndexedDB is browser-specific (works offline)
- Orders stay on this device/browser
- Use PWA install to keep data on your device

