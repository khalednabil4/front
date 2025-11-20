# Hostinger Deployment Checklist

## Pre-Deployment
- [ ] Hostinger account created and web hosting plan active
- [ ] FTP/SFTP credentials obtained from Hostinger
- [ ] Gemini API key available
- [ ] `.env.local` file created with `GEMINI_API_KEY=your_key`

## Build & Prepare
- [ ] Run `npm install` to install dependencies
- [ ] Run `npm run build` to create production build
- [ ] Verify `dist/` folder contains `index.html` and `assets/` folder
- [ ] All files in `dist/` are ready for upload

## Upload to Hostinger
- [ ] Log in to Hostinger account
- [ ] Open File Manager or connect via FTP/SFTP
- [ ] Navigate to `public_html` folder
- [ ] Upload `index.html` from `dist/`
- [ ] Upload entire `assets/` folder from `dist/`
- [ ] Verify all files uploaded successfully

## Post-Deployment
- [ ] Visit your domain in browser
- [ ] Verify application loads without errors
- [ ] Open browser console (F12) to check for errors
- [ ] Test core functionality (water monitoring features)
- [ ] Verify API calls are working

## Troubleshooting
- [ ] Check that `index.html` is in root of `public_html`
- [ ] Verify `assets/` folder is in `public_html`
- [ ] Check browser console for 404 errors
- [ ] Verify Gemini API key is correctly set
- [ ] Clear browser cache and reload

## Quick Commands

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview locally before uploading
npm run preview
```

## Important Notes
- The built application is in the `dist/` folder
- Only upload contents of `dist/` to `public_html`
- Do NOT upload `node_modules/` or source files
- Keep `.env.local` secure and never commit it
- The application is client-side only (no backend needed)
