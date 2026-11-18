# GitPlus — Extended Git Utilities for VS Code

A lightweight extension that adds essential Git features missing from the default VS Code experience.

## 🚀 Features

### 1. Edit Commit Message

Quickly edit commit messages for local commits that haven't been pushed yet.

**How to use:**

- **For HEAD commit**: Use the Source Control title bar button or Command Palette → `GitPlus: Edit Commit Message`
- **For any local commit**: Command Palette → `GitPlus: Edit Commit Message` → Select from list of local commits

**Features:**

- ✅ **Local commits only** - Shows only commits that haven't been pushed to remote
- ✅ **Undo support** - Made a mistake? Click "Undo" in the success notification to restore the original message
- ✅ **No confirmation needed** - Direct editing for faster workflow (local commits are safe to edit)
- ✅ **Fast performance** - Optimized to load commit lists quickly using batch git operations

**Note**: The extension uses `git rev-list` to identify unpushed commits, ensuring you only edit local history.

---

### 2. Show File History

View the complete Git history for any file with options to explore content, diffs, and commit details.

**How to use:**

- **Right-click** a file in Explorer → `Show File History`
- **Right-click** in editor → `Show File History`
- **Command Palette** → `GitPlus: Show File History`

**Features:**

- ✅ **Full commit history** - See all commits that touched the file
- ✅ **View file at any commit** - See the exact file content at that point in time
- ✅ **View diff** - See what changed in each commit
- ✅ **Commit details** - Full commit info with stats
- ✅ **Tracks renames** - Uses `git log --follow` to track file across renames

---

### 3. 3-Way Merge Conflict Resolver

Resolve content conflicts in a 3-column editor: the current side, an editable result, and the incoming side. Changed lines are highlighted, and a few unchanged lines stay visible around each conflict.

**How to use:**

- **Keyboard shortcut**: `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows/Linux) while the active editor is an unmerged file with conflict markers. Show Problems keeps that shortcut the rest of the time.
- **Command Palette** → `GitPlus: Resolve Merge Conflicts (3-Way)`
- **Editor title** icon when that file has conflict markers
- **Right-click** a file in the Explorer
- **Source Control** icon on a merge change

**Layout:**

```
┌───────────────────┬───────────────────┬───────────────────┐
│   Current (HEAD)  │      Result       │ Incoming (branch) │
│                   │    (Editable)     │                   │
└───────────────────┴───────────────────┴───────────────────┘
```

**Features:**

- ✅ **Current, incoming, or both** - Either order, or keep neither, including an empty side
- ✅ **Manual editing** - Edit the result directly in the center column
- ✅ **Diff3 base** - Shows the `|||||||` ancestor when Git wrote one
- ✅ **Rebase, cherry-pick, and revert** - Labels say which side is which
- ✅ **Modify/delete and binary files** - Choose one side instead of the text editor
- ✅ **Multi-root** - Finds conflicts in every Git repository in the workspace
- ✅ **Auto-stage** - The resolved file is staged with `git add`
- ✅ **Next file** - After staging, jump to the next conflicted file

## 🔧 Requirements

- Git installed on your system
- A workspace folder that is already a Git repository

## 📦 Installation

1. Open the VS Code Marketplace
2. Search for `GitPlus`
3. Click Install

## 🧩 Commands Overview

| Command                                    | Description                                                    | Shortcut              |
| ------------------------------------------ | -------------------------------------------------------------- | --------------------- |
| `GitPlus: Edit Commit Message`             | Edit any local (unpushed) commit message with undo support     | —                     |
| `GitPlus: Show File History`               | View commit history for the current file                       | —                     |
| `GitPlus: Resolve Merge Conflicts (3-Way)` | Resolve content conflicts, or pick a side for modify/delete and binary files | `Cmd/Ctrl+Shift+M` when the editor has conflict markers |

## 💬 Feedback & Suggestions

GitPlus is evolving. If you have ideas for missing Git features or UX improvements, feel free to share them.

## 🛠️ Development

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- TypeScript
- VS Code (for testing)

### Setup

```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run compile
```

### Testing Locally

#### Option 1: Using VS Code Debugger (Recommended)

1. Open this project in VS Code
2. Press `F5` or go to **Run and Debug** → **Run Extension**
3. A new VS Code window will open (Extension Development Host)
4. In the new window:
   - Open a folder that is a Git repository
   - Test the commands:
     - **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`) → Type "Rename Last Commit Message" or "Show File History"
     - **Source Control** → Look for the "Rename Last Commit Message" button in the title bar
     - **File Explorer** → Right-click a file → "Show File History"

#### Option 2: Using Watch Mode

1. In one terminal, start watch mode:
   ```bash
   npm run watch
   ```
2. Press `F5` in VS Code to launch Extension Development Host
3. Make changes to the code - TypeScript will auto-compile
4. Reload the Extension Development Host window (`Cmd+R` / `Ctrl+R`) to see changes

#### Testing Checklist

- ✅ Test "Edit Commit Message" command for HEAD commit
- ✅ Test "Edit Commit Message" command with commit selection
- ✅ Test "Undo" functionality after editing
- ✅ Verify only local (unpushed) commits are shown
- ✅ Test Source Control title bar button
- ✅ Test "Show File History" from explorer context menu
- ✅ Test "Show File History" from editor context menu
- ✅ Test viewing file content at specific commit
- ✅ Test viewing diff for a commit
- ✅ Test "Resolve Merge Conflicts" with a content conflict, including an empty side and a diff3 base
- ✅ Test modify/delete and binary conflicts by keeping one side
- ✅ Test staging, then opening the next conflicted file
- ✅ Confirm `Cmd/Ctrl+Shift+M` still opens Problems when the editor has no conflict markers

### Build

```bash
npm run compile
```

### Watch Mode

```bash
npm run watch
```

### Package Extension

```bash
# Install vsce globally (if not already installed)
npm install -g @vscode/vsce

# Package the extension
vsce package
```

This creates a `.vsix` file that can be installed manually or published to the marketplace.

## 📝 License

MIT
