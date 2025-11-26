# Troubleshooting: GitPlus Commands Not Appearing

## Quick Fixes

### 1. Reload Extension Development Host Window
After making changes, you **must** reload the Extension Development Host window:
- Press `Cmd+R` (Mac) or `Ctrl+R` (Windows/Linux) in the Extension Development Host window
- Or close and reopen it (press `F5` again)

### 2. Check Extension is Activated
1. Open the **Debug Console** in the main VS Code window (not Extension Development Host)
2. Look for: `GitPlus extension is now active!`
3. If you don't see this, the extension didn't activate

### 3. Check Output Channel
1. Go to **View → Output** (or `Cmd+Shift+U` / `Ctrl+Shift+U`)
2. Select **"GitPlus"** from the dropdown
3. You should see: `GitPlus extension is now active!`

### 4. Verify Commands are Registered
1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Type: `GitPlus` (with capital G and P)
3. You should see:
   - `GitPlus: Rename Last Commit Message`
   - `GitPlus: Show File History`

### 5. Check if You're in a Git Repository
- The extension works best in a Git repository
- Open a folder that contains a `.git` directory
- Or initialize one: `git init`

## Common Issues

### Commands Don't Appear in Command Palette

**Possible causes:**
1. Extension not activated
2. Need to reload Extension Development Host window
3. Typing wrong search term (try "GitPlus" with capital letters)

**Solution:**
- Reload Extension Development Host window (`Cmd+R`)
- Check Debug Console for activation message
- Try typing "GitPlus" in Command Palette

### Context Menu Not Showing

**For File Explorer context menu:**
- Right-click on a **file** (not folder)
- Look for "Show File History" in the menu
- Make sure you're right-clicking in the Explorer panel

**For Source Control menu:**
- Go to Source Control view (Git icon in sidebar)
- Look for "Rename Last Commit Message" button in the title bar
- Only appears if you're in a Git repository

### Extension Not Activating

**Check:**
1. `out/extension.js` exists (run `npm run compile`)
2. No errors in Debug Console
3. `package.json` has correct `main` path: `"./out/extension.js"`

**Solution:**
```bash
# Recompile
npm run compile

# Reload Extension Development Host (F5)
```

### Commands Execute But Nothing Happens

**Check:**
1. Are you in a Git repository? (run `git status`)
2. Do you have at least one commit? (run `git log`)
3. Check Output channel for error messages

## Step-by-Step Debugging

### Step 1: Verify Setup
```bash
# Check compilation
ls -la out/extension.js

# Should show the file exists
```

### Step 2: Check Activation
1. Press `F5` to launch Extension Development Host
2. Open Debug Console in main VS Code window
3. Look for: `GitPlus extension is now active!`

### Step 3: Test Commands
1. In Extension Development Host, open a Git repository
2. Press `Cmd+Shift+P` / `Ctrl+Shift+P`
3. Type: `GitPlus`
4. Commands should appear

### Step 4: Test Context Menu
1. Right-click a file in Explorer
2. Look for "Show File History"
3. Go to Source Control view
4. Look for rename button in title bar

## Still Not Working?

### Check Extension Host Logs
1. Go to **Help → Toggle Developer Tools**
2. Check **Console** tab
3. Look for errors related to GitPlus

### Verify package.json Structure
Make sure your `package.json` has:
- `"main": "./out/extension.js"`
- Commands defined in `contributes.commands`
- Activation events defined

### Rebuild from Scratch
```bash
# Clean and rebuild
rm -rf out node_modules
npm install
npm run compile
```

Then press `F5` to launch Extension Development Host again.

## Expected Behavior

✅ **Command Palette**: Type "GitPlus" → See 2 commands  
✅ **File Explorer**: Right-click file → See "Show File History"  
✅ **Source Control**: See "Rename Last Commit Message" button  
✅ **Debug Console**: See "GitPlus extension is now active!"  
✅ **Output Channel**: See GitPlus logs

## Getting Help

If commands still don't appear:
1. Check Debug Console for errors
2. Check Output channel (View → Output → GitPlus)
3. Verify you're in Extension Development Host window (not main VS Code)
4. Make sure you're in a Git repository
5. Try reloading Extension Development Host window

