# GitPlus — Extended Git Utilities for VS Code

A lightweight extension that adds essential Git features missing from the default VS Code experience.

## 🚀 Features (Current)

### 1. Rename Last Commit Message

Quickly update the most recent commit message without touching staging or other changes.

**How to use:**

- Open the Command Palette → `GitPlus: Rename Last Commit Message`
- Enter your updated message
- Confirm and the last commit will be amended safely

⚠️ **Only affects the latest commit (HEAD).** Renaming older commits is not supported (yet).

### 2. File History Viewer

See the full Git history of any file, including renames and modifications over time.

**How to use:**

- Right-click a file → `GitPlus: Show File History`
- Or open Command Palette → `GitPlus: Show File History`

**What you get:**

- List of commits affecting that file
- Author & timestamp info
- Ability to view:
  - File content at that commit
  - Diff for that commit
  - Full commit details

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
| `GitPlus: Rename Last Commit Message` | Amend the latest commit message                          |
| `GitPlus: Show File History`          | View the list of commits that modified a particular file |

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

- ✅ Test "Rename Last Commit Message" command
- ✅ Test "Show File History" from file explorer context menu
- ✅ Test "Show File History" from command palette
- ✅ Test "Edit Message" option when viewing HEAD commit in file history
- ✅ Test viewing file content at different commits
- ✅ Test viewing diffs
- ✅ Test viewing commit details

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
