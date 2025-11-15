# GitHub Pages Setup - Step by Step

Your Tracking Orders PWA is ready to deploy to GitHub Pages! Follow these steps:

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `tracking-orders-pwa`
3. **Description**: "Track orders PWA with IndexedDB"
4. **Public** or **Private** (your choice)
5. Click **Create repository**

## Step 2: Push Your Code

In PowerShell, run these commands from your project directory:

```powershell
cd "c:\Users\Andrew\Desktop\Projects-2025\Tracking orders Project"

git remote set-url origin https://github.com/YOUR_USERNAME/tracking-orders-pwa.git

git add .

git commit -m "Initial commit: Tracking Orders PWA with authentication and GitHub Pages support"

git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username.**

## Step 3: Enable GitHub Pages in Your Repo

1. Go to your repository on GitHub
2. Click **Settings** (gear icon)
3. Scroll down to **Pages** section on the left sidebar
4. Under "Build and deployment":
   - **Source**: Select **Deploy from a branch**
   - **Branch**: Select **main**
   - **Folder**: Select **/ (root)** 
   - Click **Save**

⚠️ **Important**: GitHub Pages needs to deploy the `/dist` folder. You have two options:

### Option A: Deploy from dist folder (Recommended)
1. Go to Settings → Pages
2. Set Branch to `main` and Folder to `/dist`
3. Save

### Option B: Use GitHub Actions (Automatic builds)
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Then commit and push this file - GitHub will automatically build and deploy!

## Step 4: Wait for Deployment

- GitHub Pages will start building
- Check the **Actions** tab to see build progress
- Once deployed, you'll see a green checkmark
- Your app will be live at: `https://YOUR_USERNAME.github.io/tracking-orders-pwa`

## Step 5: Test Your Deployment

1. Open your deployed site in browser
2. Test login with any username/password
3. Add an order
4. Logout and log back in
5. **Your order should still be there!** (Data persists in IndexedDB)
6. Try installing as a PWA (click "Install" button on supported browsers)

## Important Notes

### Data Persistence
- All orders are stored in **IndexedDB** locally
- When you logout, the data is **NOT deleted** - it stays on your device
- When you login again, your orders are still there
- This is by design for offline support

### Authentication
- Current auth is simple localStorage-based (stored username/password)
- For production apps, integrate with a real backend

### PWA Installation
- Your app is installable on mobile and desktop
- After installing, it works offline with all your data
- Data syncs locally on that device

## Troubleshooting

### App not loading after deployment?
- Check URL is: `https://YOUR_USERNAME.github.io/tracking-orders-pwa/`
- Open browser DevTools (F12)
- Check Console tab for errors
- Check Network tab - ensure all files loaded

### 404 errors on assets?
- The `base: '/tracking-orders-pwa/'` in `vite.config.js` handles this
- Already configured ✓

### Pages not rebuilding after push?
- Go to repo Settings → Pages
- Check Actions tab for build errors
- Re-push: `git push origin main`

## Next Pushes

After making changes locally:

```powershell
npm run build
git add .
git commit -m "Update: describe your changes"
git push origin main
```

GitHub Pages will automatically rebuild and redeploy!

## Support

If you need to:
- **Use a custom domain**: Settings → Pages → Custom domain
- **Add SSL certificate**: GitHub provides free HTTPS automatically
- **Change branch**: Settings → Pages → Select different branch

---

Your Tracking Orders PWA is now ready for the world! 🚀
