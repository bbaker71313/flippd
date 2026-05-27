# Deploying Flippd to Production

Flippd is a single-file HTML app — deployment is simple.

## Option 1: Vercel (Recommended, 5 minutes)

### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Authorize Vercel to access your repos

### Step 2: Import This Repo
1. Click "New Project"
2. Select "Import Git Repository"
3. Paste: `https://github.com/yourusername/Flippd.git`
4. Click "Import"

### Step 3: Configure
1. **Framework:** None (static site)
2. **Root Directory:** `./src/landing` (for landing pages)
3. Click "Deploy"

### Step 4: Add Environment Variables
1. Go to **Settings** → **Environment Variables**
2. Add:
   - `GA4_MEASUREMENT_ID` = Your GA4 ID
   - `PROXY_URL` = Your backend URL (if applicable)
3. Redeploy (Settings → Redeploy)

### Step 5: Connect Domain (Optional)
1. Go to **Settings** → **Domains**
2. Add your domain: `flippd.com`
3. Update DNS records (instructions on page)
4. Takes 5-30 minutes to propagate

**Your site is now live at:** `https://flippd.vercel.app` (or your custom domain)

---

## Option 2: Netlify (5 minutes)

### Step 1: Create Netlify Account
1. Go to [netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Authorize Netlify

### Step 2: New Site from Git
1. Click "Add new site" → "Import an existing project"
2. Select GitHub
3. Authorize, find your `Flippd` repo
4. Click "Deploy site"

### Step 3: Build Settings
1. **Build command:** (leave blank)
2. **Publish directory:** `src/landing`
3. Click "Deploy"

### Step 4: Environment Variables
1. Go to **Site settings** → **Build & deploy** → **Environment**
2. Add: `GA4_MEASUREMENT_ID`, `PROXY_URL`
3. Trigger redeploy

### Step 5: Custom Domain
1. Go to **Site settings** → **Domain**
2. Add your domain
3. Update DNS

**Your site is now live at:** `https://[your-site].netlify.app` (or custom domain)

---

## Option 3: GitHub Pages (Free, 5 minutes)

### Step 1: GitHub Settings
1. Go to your Flippd repo
2. **Settings** → **Pages**
3. **Source:** Deploy from branch
4. **Branch:** `main` (or your default branch)
5. **Folder:** `/src/landing`
6. Click "Save"

### Step 2: Custom Domain (Optional)
1. In **Pages** section, enter your domain: `flippd.com`
2. Update your DNS CNAME record:
   ```
   Name: flippd
   Type: CNAME
   Value: yourusername.github.io
   ```
3. Takes 5-30 minutes

**Your site is now live at:** `https://yourusername.github.io/Flippd` (or custom domain)

---

## Option 4: Self-Hosted (VPS, Dedicated Server)

### Requirements
- Server with web hosting (AWS, DigitalOcean, Linode, etc.)
- Domain name
- SSH access to server

### Deployment Steps
1. SSH into server
2. Clone repo: `git clone https://github.com/yourusername/Flippd.git`
3. Copy files to web root:
   ```bash
   cp src/app/Flippd_v5.html /var/www/html/app.html
   cp src/landing/Flippd_Landing_*.html /var/www/html/
   ```
4. Set up SSL (HTTPS):
   ```bash
   # Using Let's Encrypt (free)
   sudo certbot certonly --standalone -d flippd.com
   ```
5. Configure web server (Nginx/Apache) to serve HTTPS
6. Test: Open `https://flippd.com` in browser

### Example Nginx Config
```nginx
server {
    listen 443 ssl;
    server_name flippd.com;

    ssl_certificate /etc/letsencrypt/live/flippd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/flippd.com/privkey.pem;

    root /var/www/html;
    index Flippd_Landing_Honest.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

## Post-Deployment Checklist

After deploying, verify:

- [ ] **Site loads:** Open your domain in browser
- [ ] **No 404 errors:** All pages load correctly
- [ ] **HTTPS works:** URL starts with `https://` (not `http://`)
- [ ] **GA4 tracking:** Open DevTools Console, see gtag requests
- [ ] **Email form works:** Fill it out, check it arrives in email provider
- [ ] **Mobile responsive:** Open on phone, check layout
- [ ] **Proxy working** (if applicable): Try a scan from the app
- [ ] **DNS propagated:** Domain points to correct server (if custom domain)

## Environment Variables for Production

Make sure these are set in your deployment platform:

```
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
PROXY_URL=https://your-backend-url.com
MAILCHIMP_API_KEY=xxxxxxxxxxxxx (if using email service)
```

**Never commit sensitive keys to GitHub.** Use platform environment variables instead.

## Updating After Deployment

### Vercel / Netlify (Automatic)
- Push changes to GitHub
- Vercel/Netlify automatically redeploy
- Site updates within 1-2 minutes

### GitHub Pages (Automatic)
- Push to main branch
- GitHub Pages rebuilds automatically
- Site updates within 2-5 minutes

### Self-Hosted (Manual)
```bash
git pull origin main
cp src/landing/*.html /var/www/html/
# Done
```

## SSL/HTTPS

All production deployments should use HTTPS.

**Vercel:** Automatic (included)  
**Netlify:** Automatic (included)  
**GitHub Pages:** Automatic (included)  
**Self-Hosted:** Use Let's Encrypt (free)

## CDN & Caching

For faster global delivery:

**Cloudflare (Free Tier)**
1. Create account at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update DNS nameservers to Cloudflare
4. Enable caching in Cloudflare settings

Benefits:
- ✅ Faster delivery worldwide
- ✅ Free SSL
- ✅ DDoS protection
- ✅ Caching

## Monitoring & Logging

**Vercel Analytics:**
1. Go to **Analytics** tab
2. See page views, bounce rate, core web vitals

**Netlify Analytics:**
1. Go to **Analytics** tab
2. See visitors, page views, bandwidth

**Google Analytics:**
1. Go to [analytics.google.com](https://analytics.google.com)
2. Check GA4 property for real-time data
3. See conversion rates, traffic sources

## Troubleshooting Deployment

### Site not loading / 404 error
- Check that HTML files are in correct directory
- Verify root/publish directory in deployment settings
- Check DNS is pointing to correct server

### HTTPS not working
- Regenerate SSL certificate
- For Vercel/Netlify: automatic, no action needed
- For self-hosted: renew Let's Encrypt cert

### Forms not submitting
- Check CORS headers on backend
- Verify proxy URL is correct
- Check email provider API credentials

### Analytics not firing
- Verify GA4 Measurement ID in environment
- Check gtag code is in HTML
- Wait 24 hours (GA4 can be slow initially)

## Rollback Plan

If deployment breaks:

**Vercel/Netlify:**
1. Go to **Deployments**
2. Find last working deployment
3. Click "Redeploy"

**GitHub Pages:**
1. Revert last commit: `git revert HEAD`
2. Push to main
3. GitHub rebuilds automatically

**Self-Hosted:**
1. Keep previous version backed up
2. If new version breaks, copy old version back
3. Diagnose issue, fix, redeploy

## Support

- **Deployment issues?** Open [GitHub issue](https://github.com/yourusername/Flippd/issues)
- **Questions?** Email: support@flippd.com
- **Want help?** See [CONTRIBUTING.md](../CONTRIBUTING.md)
