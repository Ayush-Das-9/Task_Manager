# React Deployment Guide

## Files Ready for Render

Your React app is ready to deploy! Here's what's configured:

### Build Configuration

**[render.yaml](file:///e:/Ai_handler/render.yaml)** - Updated with:
```yaml
buildCommand: |
  # Install Node.js for React build
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
  # Build React frontend
  npm install
  npm run build
  # Install Python dependencies
  pip install -r requirements.txt
```

This ensures Render:
1. Installs Node.js 18
2. Installs npm dependencies
3. Builds React to `dist/` folder
4. Installs Python dependencies
5. Starts Flask with `gunicorn`

---

## Deployment Steps

### 1. **Commit & Push to GitHub**

```bash
# Stage all files
git add .

# Commit
git commit -m "Convert frontend to React with Vite"

# Push to GitHub
git push origin main
```

**Important files being pushed:**
- `src/` - All React components
- `package.json` - Node dependencies
- `vite.config.js` - Build configuration
- `render.yaml` - Deployment config
- `app.py` - Updated Flask server
- `.gitignore` - Excludes `node_modules/`, `dist/`

> **Note:** The `dist/` folder is NOT pushed (excluded by .gitignore). Render will build it during deployment.

---

### 2. **Render Auto-Deploy**

Once you push, Render will automatically:
1. Detect the new commit
2. Run the build command (installs Node.js, builds React, installs Python)
3. Start the server with `gunicorn app:app`

**Build time:** ~3-5 minutes (first time with Node.js install)

---

### 3. **Verify Environment Variables**

Make sure these are set in your Render dashboard:

| Variable | Value | Notes |
|----------|-------|-------|
| `MONGO_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `RENDER_EXTERNAL_URL` | `https://task-manager-2h25.onrender.com` | For keep-alive pings |
| `PYTHON_VERSION` | `3.11.0` | Python runtime version |

---

### 4. **Access Your App**

🎉 **Live URL:** https://task-manager-2h25.onrender.com

The React app will be served by Flask from the `dist/` folder.

---

## What Happens on Render

```
┌─────────────────────────────────────────┐
│ 1. Git push detected                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 2. Install Node.js 18                   │
│    curl nodesource script...            │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 3. npm install                          │
│    Installs React, Vite, dependencies   │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 4. npm run build                        │
│    Creates dist/ with optimized bundles │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 5. pip install -r requirements.txt      │
│    Installs Flask, pymongo, gunicorn    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│ 6. gunicorn app:app                     │
│    Serves React (dist/) + API endpoints │
└─────────────────────────────────────────┘
```

---

## Troubleshooting

**Build Fails:**
- Check Render logs for errors
- Verify `package.json` and `render.yaml` are pushed
- Ensure `PYTHON_VERSION` is set

**App Shows Old Version:**
- Hard refresh browser (Ctrl+F5 / Cmd+Shift+R)
- Check if build succeeded in Render logs
- Verify `dist/index.html` exists on Render

**API Errors:**
- Verify `MONGO_URI` environment variable is set correctly
- Check Flask logs in Render dashboard
- Ensure MongoDB Atlas allows Render's IP (or 0.0.0.0/0 for testing)

---

## Free Tier Limitations

⚠️ Render free tier services:
- **Sleep after 15 min** of inactivity
- **Keep-alive enabled:** App pings itself every 14 minutes
- **Cold start:** First request after sleep takes ~30 seconds

To prevent sleep, the app includes a background thread that pings `RENDER_EXTERNAL_URL` every 14 minutes.

---

## Local Development

**Option 1: Production Mode (What you have now)**
```bash
npm run build
python app.py
# Visit http://localhost:5000
```

**Option 2: Development Mode (Hot Reload)**
```bash
# Terminal 1: Flask API
python app.py

# Terminal 2: Vite dev server
npm run dev
# Visit http://localhost:5173 (proxies /api to :5000)
```

---

You're all set! Just commit and push to deploy. 🚀
