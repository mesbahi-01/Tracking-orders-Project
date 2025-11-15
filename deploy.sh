#!/bin/bash

# GitHub Pages Deployment Script for Tracking Orders PWA
# This script builds and deploys to GitHub Pages

echo "Building app for production..."
npm run build

if [ $? -ne 0 ]; then
  echo "Build failed!"
  exit 1
fi

echo "Deploying to GitHub Pages..."

# Commit changes
git add -A
git commit -m "Deploy to GitHub Pages" || echo "No changes to commit"

# Push to main branch
git push origin main

echo "Deployment complete!"
echo "Your app will be live at: https://YOUR_USERNAME.github.io/tracking-orders-pwa"
echo ""
echo "IMPORTANT: Make sure to:"
echo "1. Replace YOUR_USERNAME with your actual GitHub username"
echo "2. Verify GitHub Pages is enabled in your repo settings (Settings > Pages > Source: deploy from a branch)"
