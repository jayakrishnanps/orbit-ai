# Orbit AI
Orbit AI is a minimalistic desktop code editor with an integrated AI assistant. It provides a standard file explorer, a code editing interface, a built-in terminal, and an AI chat panel that can read your context and apply targeted code edits directly to your files.

![Orbit AI Interface](./marketing/src/readmeimg/Screenshot%202026-06-03%20125218.png)

## Tech Stack

The application is built using the following core technologies:
* **Framework:** Electron
* **Frontend:** React, TypeScript, Webpack
* **Editor:** Monaco Editor
* **Terminal:** Xterm.js
* **AI Integration:** Groq SDK

## Getting Started

To run the application locally, ensure you have Node.js installed, then follow these steps:

1. Clone the repository and navigate to the project directory.
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. Start the application in development mode:
   ```bash
   npm start
   ```

## Configuration

To use the AI chat features, you will need a Groq API key. You can provide this key directly through the settings panel within the application interface.

