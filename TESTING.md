# Quick Testing Guide

## Step-by-Step Local Testing

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile the Extension
```bash
npm run compile
```

This creates the `out/` directory with compiled JavaScript files.

### 3. Launch Extension Development Host

**Method A: Using VS Code Debugger (Easiest)**
1. Open this project folder in VS Code
2. Press `F5` (or `Cmd+F5` on Mac)
3. A new VS Code window will open labeled "[Extension Development Host]"
4. This window has your extension loaded

**Method B: Using Command Line**
```bash
code --extensionDevelopmentPath=$(pwd)
```

### 4. Test in the Extension Development Host Window

1. **Open a Git Repository**
   - In the Extension Development Host window, open a folder that contains a Git repository
   - Or create a test repo:
     ```bash
     mkdir test-repo && cd test-repo
     git init
     echo "test" > test.txt
     git add test.txt
     git commit -m "Initial commit"
     ```

2. **Test Rename Last Commit Message**
   - Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Type: "Rename Last Commit Message"
   - Enter a new message
   - Verify the commit was amended

3. **Test File History**
   - Right-click any file in Explorer → "Show File History"
   - Or use Command Palette → "Show File History"
   - Select a commit from the list
   - Try viewing content, diff, or details
   - If it's the HEAD commit, try "Edit Message"

4. **Test Source Control Menu**
   - Go to Source Control view
   - Look for "Rename Last Commit Message" button in the title bar

### 5. Making Changes During Development

**Option A: Watch Mode (Recommended)**
```bash
# Terminal 1: Start watch mode
npm run watch

# Terminal 2: Press F5 in VS Code to launch Extension Development Host
# After making code changes, reload the Extension Development Host window:
# Cmd+R (Mac) or Ctrl+R (Windows/Linux)
```

**Option B: Manual Compile**
```bash
# After each code change:
npm run compile
# Then reload Extension Development Host window (Cmd+R / Ctrl+R)
```

### 6. Debugging

- Set breakpoints in `.ts` files
- Use VS Code's Debug Console to inspect variables
- Check the Debug Console for `console.log` output
- Extension logs appear in the Debug Console of the main VS Code window (not the Extension Development Host)

### 7. Common Issues

**Extension not loading?**
- Make sure `out/extension.js` exists (run `npm run compile`)
- Check the Debug Console for errors
- Verify `package.json` has correct `main` path

**Commands not appearing?**
- Reload the Extension Development Host window
- Check Command Palette → type "GitPlus"
- Verify activation events in `package.json`

**Git commands failing?**
- Ensure Git is installed: `git --version`
- Make sure you're testing in a Git repository
- Check the workspace path is correct

### 8. Testing Checklist

- [ ] Extension activates without errors
- [ ] "Rename Last Commit Message" appears in Command Palette
- [ ] "Show File History" appears in Command Palette
- [ ] Right-click context menu shows "Show File History"
- [ ] Source Control title bar shows rename button
- [ ] Rename commit works and amends correctly
- [ ] File history shows commit list
- [ ] Can view file content at different commits
- [ ] Can view diffs
- [ ] Can view commit details
- [ ] "Edit Message" appears for HEAD commit in file history
- [ ] Edit message works from file history

## Quick Commands Reference

```bash
# Install dependencies
npm install

# Compile once
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Package for distribution
vsce package

# Launch Extension Development Host
code --extensionDevelopmentPath=$(pwd)
```

