# Multi-Bot Deployment Guide for PebbleHost

This guide explains how to deploy multiple Discord bots to a single PebbleHost server using the "Multiple Bots - NodeJS" preinstall and our automated SFTP deployment method.

## 1. Server Architecture

The server is set up with a **Loader** script that manages multiple independent bot processes.

**Directory Structure:**
```
/home/container/
├── loader.js                # Main entry point (starts all bots)
├── package.json             # Dependencies for the loader
├── xivdyetools-discord-bot/ # Bot 1 Folder
│   ├── start.js             # Proxy entry point
│   ├── .env                 # Bot 1 Config
│   ├── dist/                # Bot 1 Code
│   └── package.json         # Bot 1 Dependencies
└── other-bot-name/          # Bot 2 Folder
    ├── start.js             # Proxy entry point
    ├── .env                 # Bot 2 Config
    └── ...
```

## 2. Preparing a New Bot

For any new bot you want to add, follow these steps:

### A. Create the Proxy File (`start.js`)
The `loader.js` script needs a file in the bot's root directory to correctly set the working directory.

1.  Create a file named `start.js` in your bot's project root.
2.  Add the import pointing to your actual main file (usually in `dist/` or `src/`):
    ```javascript
    // start.js
    import './dist/index.js'; 
    // OR if using CommonJS: require('./src/index.js');
    ```

### B. Configure the Deployment Script
1.  Copy `scripts/deploy.ts` from `xivdyetools-discord-bot` to your new bot's `scripts/` folder.
2.  Install the SFTP client:
    ```bash
    npm install --save-dev ssh2-sftp-client @types/ssh2-sftp-client
    ```
3.  Edit `scripts/deploy.ts` and update the `remotePath`:
    ```typescript
    const config = {
        // ...
        remotePath: '/other-bot-name', // Change this to your new bot's folder name
    };
    ```
4.  Add the script to `package.json`:
    ```json
    "scripts": {
        "deploy": "tsx scripts/deploy.ts"
    }
    ```
5.  Add your SFTP credentials to the new bot's `.env` file.

## 3. Configuring the Loader

Once the new bot is deployed (uploaded), you need to tell the server to run it.

1.  Edit `loader.js` in the server root (or `download/loader.js` locally).
2.  Add the path to the new bot's `start.js` file:
    ```javascript
    const start_files = [
        "./xivdyetools-discord-bot/start.js",
        "./other-bot-name/start.js" // Add your new bot here
    ];
    ```
3.  **Restart the Server** in the PebbleHost panel.

## 4. How it Works

1.  **Deployment**: Running `npm run deploy` builds your bot locally and uploads it to its specific subfolder on the server via SFTP.
2.  **Startup**: When PebbleHost starts, it runs `loader.js`.
3.  **Execution**: `loader.js` loops through `start_files`. For each file:
    *   It determines the folder (e.g., `other-bot-name/`).
    *   It runs `npm install` **inside that folder** (installing that bot's specific dependencies).
    *   It launches `start.js` **inside that folder** (so `process.cwd()` is correct).
    *   The bot loads its own `.env` and runs independently.
