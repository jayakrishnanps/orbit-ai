<div align="center">
  <img src="marketing/public/favicon.svg" alt="Orbit AI Logo" width="120" />
  <h1>Orbit AI</h1>
  <p><b>Lightweight, AI-powered desktop code editor.</b></p>
</div>

<br />

## Overview

Orbit AI is a native desktop application providing a focused, minimal coding environment that pairs a full-featured code editor with an intelligent AI assistant. It eliminates the context-switching between browser chats and editors by embedding the AI directly inside the workspace. 

The AI assistant understands your local project context, reading the current file tree and open files, to apply surgical, precise code edits directly—without requiring manual copy-pasting.

## Key Capabilities

*   **Integrated AI Assistant:** Chat panel embedded directly in the editor, powered by Groq's LLM API (`llama-3.3-70b-versatile`).
*   **Context-Aware Edits:** The AI analyzes the active file, project structure, and user-attached files to provide highly relevant assistance.
*   **Direct Code Application:** AI-generated edits are automatically applied to the active file.
*   **Full-Featured Editor:** Powered by Monaco Editor, offering a VS Code-like editing experience.
*   **Native Terminal:** Fully integrated PowerShell terminal using `xterm.js` and `node-pty`.
*   **Local Processing:** Project files remain on your local disk; no code is uploaded to a centralized server (other than the necessary context sent to the LLM API during chat).

## Technology Stack

Orbit AI is built for performance and native integration using modern web technologies:

*   **Platform:** Electron & Node.js
*   **Frontend:** React, TypeScript, Webpack
*   **Editor Component:** Monaco Editor
*   **Terminal Emulation:** Xterm.js & node-pty
*   **AI Integration:** Groq SDK
*   **Packaging:** electron-builder (Windows NSIS installer)

## Getting Started

### Prerequisites
*   Node.js (>= 22.0.0)
*   A [Groq API Key](https://console.groq.com/keys)

### Development Setup

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

### Building the Installer

To generate a standalone Windows installer (`.exe`):

```bash
npm run app
```
This single command cleans the build directory, compiles the application using Webpack, builds the NSIS installer via `electron-builder`, and automatically launches the setup wizard.
