# GitPlus — Extended Git Utilities for VS Code

A lightweight extension that adds essential Git features missing from the default VS Code experience.

## 🚀 Features (Current)

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

## 🚧 Coming Soon

We're actively building more powerful Git utilities to make your workflow smoother. Stay tuned for upcoming features including file history tracking, advanced diff views, and more. Your feedback helps shape what comes next!

<!-- File History Viewer feature is currently hidden. -->

## 🔧 Requirements

- Git installed on your system
- A workspace folder that is already a Git repository

## 📦 Installation

1. Open the VS Code Marketplace
2. Search for `GitPlus`
3. Click Install

## 🧩 Commands Overview

| Command                               | Description                                              |
| ------------------------------------- | -------------------------------------------------------- |
| `GitPlus: Edit Commit Message` | Edit any local (unpushed) commit message with undo support                          |

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
