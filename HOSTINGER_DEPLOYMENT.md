# Deploying Water Monitoring to Hostinger

## Prerequisites
- Hostinger account with web hosting plan
- FTP/SFTP access credentials
- Your Gemini API key

## Step 1: Build the Application

The application has already been built. The production files are in the `dist/` folder.

```bash
npm run build
```

## Step 2: Prepare Environment Variables

Before uploading, ensure your `.env.local` file contains:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

**Important:** The `.env.local` file is gitignored and should NOT be committed to version control.

## Step 3: Upload to Hostinger

### Option A: Using Hostinger File Manager (Easiest)

1. Log in to your Hostinger account
2. Go to **Hosting** → **File Manager**
3. Navigate to the **public_html** folder
4. Upload all files from the `dist/` folder to `public_html`
   - `index.html`
   - `assets/` folder (contains all CSS and JS files)

### Option B: Using FTP/SFTP

1. Download an FTP client (e.g., FileZilla, WinSCP)
2. Connect using your Hostinger FTP credentials:
   - Host: Your Hostinger domain or FTP server address
   - Username: Your FTP username
   - Password: Your FTP password
   - Port: 21 (FTP) or 22 (SFTP)
3. Navigate to the `public_html` folder
4. Upload all files from the `dist/` folder

## Step 4: Configure Environment Variables on Hostinger

Since Hostinger is a static hosting environment, you need to set the API key in your application before deployment.

### Method 1: Using .env.local (Recommended)

1. Create a `.env.local` file in the root directory with:
   ```
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
2. Rebuild the application:
   ```bash
   npm run build
   ```
3. Upload the new `dist/` folder contents

### Method 2: Inline Configuration (Less Secure)

If you need to set the API key after deployment, you can modify the `index.html` file, but this is NOT recommended as it exposes your API key in the client-side code.

## Step 5: Verify Deployment

1. Visit your domain (e.g., `https://yourdomain.com`)
2. The Water Monitoring application should load
3. Test the functionality to ensure everything works

## Troubleshooting

### Application doesn't load
- Check that all files from `dist/` are uploaded to `public_html`
- Verify that `index.html` is in the root of `public_html`
- Check browser console (F12) for errors

### API key not working
- Ensure `.env.local` is set before building
- Rebuild with `npm run build`
- Re-upload the `dist/` folder

### CORS errors
- If you see CORS errors, you may need to configure CORS headers on Hostinger
- Contact Hostinger support for help with CORS configuration

### Large bundle size warning
- The application bundle is ~650KB (189KB gzipped)
- This is normal for a React application with Recharts
- Hostinger should handle this without issues

## File Structure After Upload

Your `public_html` folder should look like:
```
public_html/
├── index.html
└── assets/
    ├── index-[hash].js
    └── [other asset files]
```

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env.local` to version control
- Never expose your Gemini API key in client-side code
- Consider using environment variables or a backend proxy for sensitive operations
- Hostinger's static hosting means all code is client-side; ensure this is acceptable for your use case

## Support

For Hostinger-specific issues:
- Contact Hostinger support: https://support.hostinger.com
- Check Hostinger documentation: https://www.hostinger.com/help

For application issues:
- Check the browser console for errors (F12)
- Review the application logs
