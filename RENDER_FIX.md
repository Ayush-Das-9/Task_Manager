# Render Deployment Troubleshooting

## Issue: "Not Found" Error (404)

### Quick Fix

The issue was that Render's build command was trying to manually install Node.js, which requires root access.

**Solution:** Use Render's native Node.js support via `NODE_VERSION` environment variable.

### Updated render.yaml

```yaml
envVars:
  - key: NODE_VERSION
    value: 18.17.0
```

This tells Render to provide Node.js 18.17.0 during the build.

---

## Deployment Steps

1. **Commit the Fixed render.yaml:**
   ```bash
   git add render.yaml app.py
   git commit -m "Fix Render deployment with NODE_VERSION"  
   git push origin main
   ```

2. **Render Will Auto-Redeploy:**
   - Watch the build logs in Render dashboard
   - Look for: `npm install` and `npm run build` success messages
   - Build should complete in ~2-3 minutes

3. **Check Logs:**
   - In Render dashboard → Your service → Logs
   - Should see: `✓ React build found: dist/index.html exists`
   - If you see warnings, the build failed

---

## Verify Build Succeeded

In Render logs, you should see:

```
> npm install
added 66 packages

> npm run build  
✓ 35 modules transformed
dist/index.html                  0.51 kB
dist/assets/index-XXXXX.css     10.48 kB
dist/assets/index-XXXXX.js     157.09 kB
✓ built in 2.92s

✓ React build found: dist/index.html exists
```

---

## Common Issues

### Build Fails: "npm: command not found"
- **Cause:** `NODE_VERSION` not set
- **Fix:** Add to Render dashboard → Environment → Add Variable:
  ```
  NODE_VERSION = 18.17.0
  ```

### Build Succeeds But Still 404
- **Check:** Render logs for "WARNING: dist/ folder not found"
- **Fix:** Build command failed silently. Check full logs.

### App Works Locally But Not on Render
- **Check:** Is `dist/` in `.gitignore`? (Should be - Render builds it)
- **Verify:** `package.json` and `vite.config.js` are committed

---

## Environment Variables to Set

| Variable | Value | Where |
|----------|-------|-------|
| `NODE_VERSION` | `18.17.0` | Render Dashboard |
| `PYTHON_VERSION` | `3.11.0` | Already in render.yaml |
| `MONGO_URI` | `mongodb+srv://...` | Render Dashboard (Secret) |
| `RENDER_EXTERNAL_URL` | `https://task-manager-2h25.onrender.com` | Already in render.yaml |

---

## Success Indicators

✅ Build logs show npm commands  
✅ Logs show "✓ React build found"  
✅ Accessing root URL shows React app (not 404)  
✅ API endpoints work: `/api/categories`, `/api/tasks`  

---

After pushing the fix, your app should be live at:
**https://task-manager-2h25.onrender.com** 🚀
