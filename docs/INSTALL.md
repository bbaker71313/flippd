# Installing Flippd Locally

Flippd is a single-file web app. No installation needed — just open the HTML file in your browser.

## Quick Start (2 minutes)

1. **Download** `Flippd_v5.html` from [/src/app/](../src/app/)
2. **Open** in your browser: Right-click → "Open with" → Choose your browser
3. **Enter access code** (you'll get this from early access email)
4. **Start scanning** — Take a photo of any item or shelf

That's it. No installation. No build step. No dependencies.

## For Developers

### Clone the Repo

```bash
git clone https://github.com/yourusername/Flippd.git
cd Flippd
```

### Open Locally

**Option A: Direct File**
1. Open `src/app/Flippd_v5.html` in your browser (Cmd+O or File → Open)
2. Or drag and drop the file into your browser

**Option B: Local Server (Recommended)**
```bash
# Python 3
python3 -m http.server 8000

# Or Node.js (if installed)
npx http-server

# Then open: http://localhost:8000/src/app/Flippd_v5.html
```

### Testing Changes

1. Edit `Flippd_v5.html` in your editor
2. Save the file
3. Reload browser (Cmd+R or Ctrl+R)
4. Changes appear instantly

## Using Flippd with a Proxy Backend

By default, Flippd uses direct API calls. To use a proxy:

1. **Set PROXY_URL** in the HTML file (around line 3169):
   ```javascript
   const PROXY_URL = 'https://your-backend-url.com';
   ```

2. **Test** by taking a scan. Should work instantly.

3. **If it fails**, check:
   - Is the proxy URL correct?
   - Is the proxy server running?
   - Check browser console for error messages (F12)

See [docs/API_INTEGRATION.md](../docs/API_INTEGRATION.md) for full proxy setup.

## Access Code

You need an access code to unlock Flippd. 

**If you have early access:**
- Check your email for the code
- It looks like: `FLIPPD2026`
- Enter it in the app welcome screen

**If you're self-hosting:**
- Generate your own codes (modify the `isUnlocked()` function in the HTML)
- Or remove the code requirement entirely for testing

## Troubleshooting

### "Access code required" error
- You need a valid code. Email support@flippd.com for early access.
- Or remove the code check for self-hosting.

### Camera not working
- Check browser permissions (Settings → Camera)
- Some browsers require HTTPS for camera access
- Test in incognito/private window

### Scans not working / "Connection failed"
- Check your internet connection
- If using a proxy: is the proxy URL correct?
- Check browser console (F12) for error messages
- Try a different item/photo

### Data not saving
- Check that localStorage is enabled (privacy settings)
- Try incognito/private window (often has different settings)
- Clear browser cache and reload

### Page looks broken on mobile
- Force refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows/Linux)
- Try a different browser
- Check that you're viewing in portrait orientation

## What Works Without Internet?

Once you have scanned and saved items to your inventory, the app works offline:
- ✅ View your inventory
- ✅ View P&L
- ✅ View saved photos
- ❌ Scanning requires internet (needs AI API)
- ❌ Market trends require internet (needs live data)

Data syncs when you reconnect.

## System Requirements

- **Browser:** Chrome, Firefox, Safari, or Edge (recent versions)
- **OS:** Windows, Mac, Linux, iOS, Android
- **RAM:** Minimal (app runs entirely in browser)
- **Storage:** Minimal (data stays on your device)
- **Internet:** Required for scanning, optional for viewing data

## Next Steps

- Read [ARCHITECTURE.md](../docs/ARCHITECTURE.md) to understand how Flippd works
- Check [DATA_MODEL.md](../docs/DATA_MODEL.md) to see localStorage schema
- See [DEPLOYMENT.md](../docs/DEPLOYMENT.md) to deploy to production

## Support

- **Issues with installation?** Open a [GitHub issue](https://github.com/yourusername/Flippd/issues)
- **Questions?** Email support@flippd.com
- **Want to contribute?** See [CONTRIBUTING.md](../CONTRIBUTING.md)
