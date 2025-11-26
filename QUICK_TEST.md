# Quick Test Guide - Is GitPlus Working?

## Ignore This Error

The `OTLPExporterError` you're seeing is from **Cursor's telemetry system**, not GitPlus. You can safely ignore it - it won't affect GitPlus functionality.

## Test GitPlus Now

### Step 1: Check Extension Activation

1. In the **main VS Code/Cursor window** (not Extension Development Host), open **Debug Console**
2. Look for this line: `GitPlus extension is now active!`
3. ✅ If you see it → Extension is working!
4. ❌ If you don't see it → Extension didn't activate (see troubleshooting below)

### Step 2: Test Commands in Extension Development Host

1. Make sure you're in the **Extension Development Host** window (title shows "[Extension Development Host]")
2. Open a folder that contains a Git repository (or create one)
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
4. Type: `GitPlus`
5. You should see:
   - ✅ `GitPlus: Rename Last Commit Message`
   - ✅ `GitPlus: Show File History`

### Step 3: Test Context Menu

1. In Extension Development Host, right-click any **file** in the Explorer
2. Look for: `Show File History`
3. ✅ If you see it → Working!
4. ❌ If you don't → See troubleshooting

### Step 4: Test Source Control Menu

1. Go to Source Control view (Git icon in sidebar)
2. Look for a button in the title bar (might say "Rename Last Commit Message" or show an edit icon)
3. ✅ If you see it → Working!

## If Commands Don't Appear

### Quick Fix 1: Reload Extension Development Host

- Press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux) in Extension Development Host window
- Try commands again

### Quick Fix 2: Restart Extension Development Host

1. Stop debugging (click stop button or press `Shift+F5`)
2. Press `F5` again to launch Extension Development Host
3. Try commands again

### Quick Fix 3: Verify Compilation

```bash
cd /Users/devendrapratapsingh/personal/gitplus-vs-code-extension
npm run compile
```

Make sure `out/extension.js` exists and was recently updated.

### Quick Fix 4: Check Output Channel

1. Go to **View → Output** (or `Cmd+Shift+U`)
2. Select **"GitPlus"** from the dropdown
3. You should see: `GitPlus extension is now active!`
4. If you see errors here, share them

## What to Look For

✅ **Success Indicators:**

- Debug Console shows: `GitPlus extension is now active!`
- Command Palette shows GitPlus commands when typing "GitPlus"
- Right-click menu shows "Show File History"
- Output channel shows GitPlus logs

❌ **Failure Indicators:**

- No "GitPlus extension is now active!" in Debug Console
- Commands don't appear in Command Palette
- Context menu doesn't show GitPlus options
- Errors in Output channel

## Still Not Working?

Share:

1. What you see in Debug Console (look for "GitPlus" messages)
2. What you see in Output channel (View → Output → GitPlus)
3. Whether commands appear when you type "GitPlus" in Command Palette
4. Any error messages related to GitPlus (ignore OTLP/telemetry errors)
