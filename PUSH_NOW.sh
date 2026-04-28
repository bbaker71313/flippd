#!/bin/bash
# Quick push script for bbaker71313/flippd
# Run this from your local machine after cloning this repo

set -e

echo "🚀 Pushing Flippd to GitHub..."
echo ""

# Verify git is configured
git config user.name > /dev/null 2>&1 || {
  echo "⚠️  Git not configured. Set it up first:"
  echo "  git config --global user.name 'Your Name'"
  echo "  git config --global user.email 'your@email.com'"
  exit 1
}

# Verify remote is set
git remote | grep -q origin || {
  echo "⚠️  Remote not configured. Setting up..."
  git remote add origin https://github.com/bbaker71313/flippd.git
}

# Rename branch to main if needed
if git rev-parse --verify main > /dev/null 2>&1; then
  echo "✅ Branch is already 'main'"
else
  echo "Renaming branch to 'main'..."
  git branch -M main
fi

# Push to GitHub
echo "Pushing 46 files to GitHub..."
git push -u origin main

echo ""
echo "✅ Push complete!"
echo "Repository: https://github.com/bbaker71313/flippd"
echo ""
echo "Next steps:"
echo "  1. Add topics: https://github.com/bbaker71313/flippd/settings"
echo "  2. Enable Discussions"
echo "  3. Create release notes for v5.2.1"
