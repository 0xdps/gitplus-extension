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

### 3. 3-Way Merge Conflict Resolver (IntelliJ-Style)

Resolve merge conflicts with a powerful 3-panel editor, just like IntelliJ IDEA.

**How to use:**

- **Keyboard shortcut**: `Cmd+Shift+M` (Mac) / `Ctrl+Shift+M` (Windows/Linux)
- **Command Palette** → `GitPlus: Resolve Merge Conflicts (3-Way)`
- **Right-click** a conflicted file → `Resolve Merge Conflicts (3-Way)`

**Layout:**

```
┌───────────────────┬───────────────────┬───────────────────┐
│   Yours (HEAD)    │      Result       │  Theirs (Branch)  │
│                   │   (Editable)      │                   │
│   [Accept →]      │                   │    [← Accept]     │
└───────────────────┴───────────────────┴───────────────────┘
```

**Features:**

- ✅ **3-column layout** - Yours (left), Result (center), Theirs (right)
- ✅ **Accept buttons** - One-click to accept left, right, or both
- ✅ **Manual editing** - Edit the result directly in the center panel
- ✅ **Accept All** - Apply all yours or all theirs at once
- ✅ **Progress tracking** - Shows X/Y conflicts resolved
- ✅ **Auto-detect conflicts** - Automatically finds all conflicted files
- ✅ **Auto-stage** - Resolved file is automatically staged with `git add`
- ✅ **Keyboard shortcut** - Quick access with `Cmd/Ctrl+Shift+M`

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
| `GitPlus: Resolve Merge Conflicts (3-Way)` | Open IntelliJ-style 3-panel merge conflict resolver            | `Cmd/Ctrl+Shift+M`    |

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
- ✅ Test "Resolve Merge Conflicts" with active conflicts
- ✅ Test Accept Left/Right/Both buttons
- ✅ Test manual editing in result panel
- ✅ Test saving merged result

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
