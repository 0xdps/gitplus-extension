# Welcome to GitPlus! 🎉

Thank you for installing GitPlus - your extended Git utilities for VS Code!

## 🚀 What's Available Now

### Edit Commit Message

Quickly edit commit messages for local commits that haven't been pushed yet.

**Quick Start:**

1. **Edit HEAD commit** - Click the pencil icon in Source Control title bar
2. **Edit any local commit** - Command Palette (`Cmd/Ctrl+Shift+P`) → "GitPlus: Edit Commit Message"
3. **Made a mistake?** - Click "Undo" in the success notification

**Key Features:**

- ✅ Shows only unpushed commits (safe to edit)
- ✅ Undo support for quick corrections
- ✅ No confirmation dialogs - streamlined workflow
- ✅ Fast performance with optimized git operations

## 🧪 Try It Out

### Quick Test

1. **Open a Git Repository**
   - Any folder with a `.git` directory
   - Or create a test repo:
     ```bash
     mkdir gitplus-test && cd gitplus-test
     git init
     echo "# Test" > README.md
     git add README.md
     git commit -m "Initial commit"
     ```

2. **Edit a Commit Message**
   - Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
   - Type: "GitPlus: Edit Commit Message"
   - Select the commit to edit
   - Update the message and save
   - Try the "Undo" button if you want to revert

3. **Use the Source Control Button**
   - Go to Source Control view (Git icon in sidebar)
   - Look for the "Edit Last Commit Message" button in the title bar
   - Edit your HEAD commit message directly

## 🔍 Troubleshooting

If something goes wrong, check the "GitPlus" output channel:

- View → Output → Select "GitPlus" from dropdown
- Look for error messages prefixed with `GitPlus:`

**Common Issues:**

**No commits showing up?**
- Make sure you have local commits that haven't been pushed
- Check if you're in a Git repository
- Verify Git is installed: `git --version`

**Command not found?**
- Reload VS Code window
- Check that you're in a Git repository
- Look for errors in the "GitPlus" output channel

## 🚧 Coming Soon

We're actively building more powerful Git utilities:

- File history tracking
- Advanced diff views
- Interactive rebase helpers
- And more!

Your feedback helps shape what comes next. Have ideas? Let us know!

## 💬 Feedback & Support

GitPlus is evolving. If you have ideas for missing Git features or UX improvements, feel free to share them.

---

**Enjoy using GitPlus!** 🎉
