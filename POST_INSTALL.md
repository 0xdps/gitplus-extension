# GitPlus Extension is Working

## How to Verify GitPlus is Working

### 1. Check Extension Activation

Look for this message in the Debug Console (not Extension Development Host):

```
GitPlus extension is now active!
```

### 2. Test Commands

**In the Extension Development Host window:**

1. **Open a Git Repository**
   - Open any folder that contains a `.git` directory
   - Or create a test repo:
     ```bash
     mkdir test-repo && cd test-repo
     git init
     echo "test" > test.txt
     git add test.txt
     git commit -m "Initial commit"
     ```

2. **Test "Rename Last Commit Message"**
   - Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type: "Rename Last Commit Message"
   - You should see the command appear
   - Select it and try renaming your commit

3. **Test "Show File History"**
   - Right-click any file in the Explorer
   - Look for "Show File History" in the context menu
   - Or use Command Palette → "Show File History"
   - Select a file and view its history

4. **Test Source Control Menu**
   - Go to Source Control view (Git icon in sidebar)
   - Look for "Rename Last Commit Message" button in the title bar

### 3. Check for GitPlus Logs

If something goes wrong, look for logs prefixed with `GitPlus:` in the Debug Console:

- `GitPlus: Error showing file history: ...`
- `GitPlus: Error renaming commit: ...`

### 4. Common Issues

**Commands don't appear?**

- Make sure you're in a Git repository
- Reload the Extension Development Host window (`Cmd+R` / `Ctrl+R`)
- Check the Debug Console for activation errors

**Extension not activating?**

- Check that `out/extension.js` exists (run `npm run compile`)
- Look for errors in the Debug Console
- Verify `package.json` has correct `main` path

**Git commands failing?**

- Ensure Git is installed: `git --version`
- Make sure you're testing in a Git repository
- Check workspace path is correct

## Quick Test Script

```bash
# Create a test repository
mkdir gitplus-test && cd gitplus-test
git init
echo "# Test" > README.md
git add README.md
git commit -m "Initial commit"

# Now test the extension in VS Code Extension Development Host
# 1. Open this folder in Extension Development Host
# 2. Try "Rename Last Commit Message"
# 3. Right-click README.md → "Show File History"
```

## Debugging Tips

1. **Set Breakpoints**: Put breakpoints in `src/extension.ts` or command files
2. **Check Debug Console**: Look in the main VS Code window's Debug Console (not Extension Development Host)
3. **Reload Window**: After code changes, reload Extension Development Host (`Cmd+R`)
4. **Check Output**: Go to View → Output → Select "GitPlus" from dropdown (if we add output channel)

## Success Indicators

✅ Extension activates without errors  
✅ Commands appear in Command Palette  
✅ Context menu shows "Show File History"  
✅ Source Control shows rename button  
✅ Commands execute successfully  
✅ No GitPlus-specific errors in console
