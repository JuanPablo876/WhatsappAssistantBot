import { app, BrowserWindow, ipcMain, dialog, globalShortcut, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let nextServer: ChildProcess | null = null;
let serverPid: number | null = null;
const isDev = process.env.NODE_ENV === 'development';
const PORT = 3005;

// Log file for debugging
let logPath: string;
function writeLog(message: string): void {
  if (!logPath && app.isReady()) {
    logPath = path.join(app.getPath('userData'), 'server.log');
  }
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  if (logPath) {
    try {
      fs.appendFileSync(logPath, logMessage);
    } catch {
      // Ignore write errors
    }
  }
}

/**
 * Parse .env file and return key-value pairs
 */
function parseEnvFile(envPath: string): Record<string, string> {
  const vars: Record<string, string> = {};
  
  if (!fs.existsSync(envPath)) {
    writeLog(`.env file not found at ${envPath}`);
    return vars;
  }
  
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Parse KEY=VALUE
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      vars[key] = value;
    }
    
    writeLog(`Loaded ${Object.keys(vars).length} variables from .env`);
  } catch (err: any) {
    writeLog(`Failed to parse .env: ${err.message}`);
  }
  
  return vars;
}

/**
 * Kill the Next.js server process tree (Windows-specific)
 */
function killServerProcess(): void {
  if (nextServer) {
    try {
      // On Windows, kill the entire process tree
      if (process.platform === 'win32' && nextServer.pid) {
        try {
          execSync(`taskkill /pid ${nextServer.pid} /T /F`, { stdio: 'ignore' });
        } catch {
          // Process may already be dead
        }
      } else {
        nextServer.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error killing server:', e);
    }
    nextServer = null;
    serverPid = null;
  }

  // In development mode, don't kill orphaned processes - the dev server is managed externally
  if (isDev) {
    return;
  }

  // Also try to kill any orphaned process on the port (production only)
  if (process.platform === 'win32') {
    try {
      // Find and kill process using port 3000
      const result = execSync(`netstat -ano | findstr :${PORT} | findstr LISTEN`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(Number(pid))) {
          try {
            execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
            console.log(`Killed orphan process on port ${PORT}: PID ${pid}`);
          } catch {
            // Process may already be dead
          }
        }
      }
    } catch {
      // No process on port, which is fine
    }
  }
}

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'WhatsApp Assistant Bot',
    icon: path.join(__dirname, '../public/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true, // Enable DevTools
    },
    autoHideMenuBar: false, // Show menu for DevTools access
    backgroundColor: '#0f0f0f',
    show: false,
  });

  // Create application menu with DevTools
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { 
          label: 'Toggle DevTools', 
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { 
          label: 'Toggle DevTools (Alt)', 
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => {
          const zoom = mainWindow?.webContents.getZoomFactor() || 1;
          mainWindow?.webContents.setZoomFactor(zoom + 0.1);
        }},
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => {
          const zoom = mainWindow?.webContents.getZoomFactor() || 1;
          mainWindow?.webContents.setZoomFactor(Math.max(0.5, zoom - 0.1));
        }},
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => {
          mainWindow?.webContents.setZoomFactor(1);
        }},
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Back', accelerator: 'Alt+Left', click: () => {
          if (mainWindow?.webContents.canGoBack()) mainWindow.webContents.goBack();
        }},
        { label: 'Forward', accelerator: 'Alt+Right', click: () => {
          if (mainWindow?.webContents.canGoForward()) mainWindow.webContents.goForward();
        }},
        { type: 'separator' },
        { label: 'Go to Dashboard', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/dashboard`) },
        { label: 'Go to Admin', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/admin`) },
        { label: 'Go to Login', click: () => mainWindow?.loadURL(`http://localhost:${PORT}/login`) },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for Updates...', click: () => {
          if (isDev) {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'Updates',
              message: 'Updates are not available in development mode.',
            });
            return;
          }
          writeLog('Manual update check requested');
          autoUpdater.checkForUpdates().then((result) => {
            if (!result || !result.updateInfo) {
              dialog.showMessageBox(mainWindow!, {
                type: 'info',
                title: 'No Updates',
                message: 'You are running the latest version.',
              });
            }
          }).catch((err) => {
            dialog.showMessageBox(mainWindow!, {
              type: 'error',
              title: 'Update Check Failed',
              message: `Could not check for updates: ${err.message}`,
            });
          });
        }},
        { type: 'separator' },
        { label: 'About', click: () => {
          dialog.showMessageBox(mainWindow!, {
            type: 'info',
            title: 'About',
            message: 'WhatsApp Assistant Bot',
            detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChrome: ${process.versions.chrome}`,
          });
        }},
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    // Open DevTools in development or if DEBUG env is set
    if (isDev || process.env.DEBUG) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Load the app
  const startURL = `http://localhost:${PORT}`;
  
  // Wait for server to be ready, then load
  waitForServer(startURL).then(() => {
    mainWindow?.loadURL(startURL);
  }).catch((err) => {
    dialog.showErrorBox('Server Error', `Could not start the application server.\n\n${err.message}`);
    app.quit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // On Windows, explicitly quit when the main window is closed
    if (process.platform !== 'darwin') {
      killServerProcess();
      app.quit();
    }
  });
}

/**
 * Wait for the Next.js server to be ready
 */
async function waitForServer(url: string, maxAttempts = 30): Promise<void> {
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 404) {
        return; // Server is ready
      }
    } catch {
      // Server not ready yet
    }
    await sleep(500);
  }
  throw new Error('Server did not start in time');
}

/**
 * Start the Next.js server in production mode
 */
function startNextServer(): void {
  if (isDev) {
    // In dev, Next.js is started separately via npm run dev
    return;
  }

  const isPackaged = app.isPackaged;
  
  // Use the standalone server built by Next.js
  const standaloneDir = isPackaged
    ? path.join(process.resourcesPath, 'standalone')
    : path.join(__dirname, '../.next/standalone');
  
  const serverScript = path.join(standaloneDir, 'server.js');
  
  // Check if server.js exists
  if (!fs.existsSync(serverScript)) {
    dialog.showErrorBox('Server Error', `Server not found at: ${serverScript}\n\nMake sure to build with 'npm run build' first.`);
    app.quit();
    return;
  }

  // Find Node.js executable - check multiple locations
  let nodePath: string | null = null;
  
  // Common Node.js installation paths on Windows
  const possiblePaths = [
    // Bundled node (if we ever add it)
    isPackaged ? path.join(process.resourcesPath, 'node', 'node.exe') : null,
    // Standard installations
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    // User-specific installations (nvm, volta, etc.)
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs', 'node.exe') : null,
    process.env.APPDATA ? path.join(process.env.APPDATA, 'nvm', 'current', 'node.exe') : null,
    // NVM for Windows default locations
    process.env.NVM_HOME ? path.join(process.env.NVM_HOME, 'current', 'node.exe') : null,
    // Volta
    process.env.VOLTA_HOME ? path.join(process.env.VOLTA_HOME, 'tools', 'image', 'node', 'current', 'node.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Volta', 'tools', 'image', 'node', 'current', 'node.exe') : null,
  ].filter((p): p is string => p !== null);

  // Find first existing path
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      nodePath = p;
      console.log(`Found Node.js at: ${p}`);
      break;
    }
  }

  // If still not found, try using PATH (will need shell)
  const useShell = !nodePath;
  if (!nodePath) {
    nodePath = 'node';
    writeLog('Node.js not found in standard paths, using PATH');
  }

  writeLog(`Starting server with Node: ${nodePath}`);
  writeLog(`Server script: ${serverScript}`);
  writeLog(`Working directory: ${standaloneDir}`);
  writeLog(`Using shell: ${useShell}`);

  // Setup database path in app userData for persistence
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'data.db');
  
  // Copy template database on first launch if it doesn't exist
  if (!fs.existsSync(dbPath)) {
    writeLog('Database not found, copying template...');
    const templateDbPath = path.join(standaloneDir, 'prisma', 'template.db');
    if (fs.existsSync(templateDbPath)) {
      fs.copyFileSync(templateDbPath, dbPath);
      writeLog(`Template database copied to: ${dbPath}`);
    } else {
      writeLog(`WARNING: Template database not found at ${templateDbPath}`);
    }
  } else {
    // Run migrations on existing database to sync schema
    writeLog('Running database migrations...');
    const migrateScript = path.join(standaloneDir, 'scripts', 'migrate.js');
    if (fs.existsSync(migrateScript)) {
      try {
        const migrateResult = execSync(`"${nodePath}" "${migrateScript}" "${dbPath}"`, {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 30000,
        });
        writeLog(`Migration output:\n${migrateResult}`);
      } catch (err: any) {
        writeLog(`Migration warning: ${err.message}`);
        // Don't fail startup on migration issues - the app may still work
      }
    } else {
      writeLog(`Migration script not found at ${migrateScript}`);
    }
  }
  
  const databaseUrl = `file:${dbPath}`;
  
  writeLog(`Database path: ${dbPath}`);
  writeLog(`DATABASE_URL: ${databaseUrl}`);

  // Load .env file from standalone directory
  const envFilePath = path.join(standaloneDir, '.env');
  const envVars = parseEnvFile(envFilePath);

  nextServer = spawn(nodePath, [serverScript], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ...envVars, // Load .env file variables first
      // Override with required runtime values
      NODE_ENV: 'production',
      PORT: PORT.toString(),
      HOSTNAME: 'localhost',
      ELECTRON_APP: 'true',
      DATABASE_URL: databaseUrl,
    },
    stdio: 'pipe',
    shell: useShell, // Only use shell if falling back to PATH lookup
    windowsHide: true,
  });

  nextServer.stdout?.on('data', (data) => {
    writeLog(`[Next.js stdout] ${data}`);
  });

  nextServer.stderr?.on('data', (data) => {
    writeLog(`[Next.js stderr] ${data}`);
  });

  nextServer.on('error', (err) => {
    writeLog(`Failed to start Next.js server: ${err.message}`);
    const nodeNotFoundMsg = `Node.js is required but was not found.\n\nPlease install Node.js from https://nodejs.org\n\nTechnical details: ${err.message}`;
    dialog.showErrorBox('Node.js Not Found', nodeNotFoundMsg);
    app.quit();
  });

  nextServer.on('exit', (code, signal) => {
    writeLog(`Server exited with code ${code}, signal ${signal}`);
    if (code !== 0 && code !== null) {
      const logFilePath = path.join(app.getPath('userData'), 'server.log');
      dialog.showErrorBox('Server Error', `The server stopped unexpectedly.\n\nExit code: ${code}\n\nCheck the log file for details:\n${logFilePath}`);
    }
  });
}

/**
 * IPC handlers for communication with renderer
 */
function setupIPC(): void {
  // Get app version
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Get app path for data storage
  ipcMain.handle('get-app-path', () => {
    return app.getPath('userData');
  });

  // Show native file dialog
  ipcMain.handle('show-open-dialog', async (_, options) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return dialog.showOpenDialog(mainWindow, options);
  });

  // Show native save dialog
  ipcMain.handle('show-save-dialog', async (_, options) => {
    if (!mainWindow) return { canceled: true, filePath: undefined };
    return dialog.showSaveDialog(mainWindow, options);
  });

  // Quit app
  ipcMain.on('quit-app', () => {
    app.quit();
  });

  // Minimize/Maximize/Close
  ipcMain.on('minimize-window', () => mainWindow?.minimize());
  ipcMain.on('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('close-window', () => mainWindow?.close());

  // Check for updates (can be called from renderer)
  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      return { available: false, message: 'Updates not available in dev mode' };
    }
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result && result.updateInfo) {
        return {
          available: true,
          version: result.updateInfo.version,
          releaseNotes: result.updateInfo.releaseNotes,
        };
      }
      return { available: false };
    } catch (err: any) {
      return { available: false, error: err.message };
    }
  });

  // Download update (can be called from renderer)
  ipcMain.on('download-update', () => {
    if (!isDev) {
      autoUpdater.downloadUpdate();
    }
  });

  // Install update (can be called from renderer)
  ipcMain.on('install-update', () => {
    if (!isDev) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
}

// ─── Auto-Updater ───────────────────────────────────────────

function setupAutoUpdater(): void {
  // Don't check for updates in development
  if (isDev) {
    writeLog('Skipping auto-updater in dev mode');
    return;
  }

  // Skip if publish URL is still the placeholder
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const publishUrl = pkg?.build?.publish?.url;
      if (!publishUrl || publishUrl.includes('your-update-server.com')) {
        writeLog('Auto-updater skipped: publish URL not configured');
        return;
      }
    }
  } catch {
    // Continue with updater if we can't read package.json
  }

  // Configure logging
  autoUpdater.logger = {
    info: (msg: string) => writeLog(`[AutoUpdater] INFO: ${msg}`),
    warn: (msg: string) => writeLog(`[AutoUpdater] WARN: ${msg}`),
    error: (msg: string) => writeLog(`[AutoUpdater] ERROR: ${msg}`),
    debug: (msg: string) => writeLog(`[AutoUpdater] DEBUG: ${msg}`),
  };

  // Don't auto-download; let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    writeLog('Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    writeLog(`Update available: ${info.version}`);
    // Notify the user
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `Version ${info.version} is available!`,
      detail: 'Would you like to download and install it now? The app will restart after installation.',
      buttons: ['Download & Install', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        writeLog('User chose to download update');
        autoUpdater.downloadUpdate();
      } else {
        writeLog('User deferred update');
      }
    });
  });

  autoUpdater.on('update-not-available', () => {
    writeLog('No updates available');
  });

  autoUpdater.on('error', (err) => {
    writeLog(`Update error: ${err.message}`);
  });

  autoUpdater.on('download-progress', (progress) => {
    writeLog(`Download progress: ${progress.percent.toFixed(1)}%`);
    mainWindow?.setProgressBar(progress.percent / 100);
  });

  autoUpdater.on('update-downloaded', (info) => {
    writeLog(`Update downloaded: ${info.version}`);
    mainWindow?.setProgressBar(-1); // Remove progress bar
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded!',
      detail: 'The update will be installed when you close the app. Restart now?',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        writeLog('User chose to restart for update');
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // Check for updates after a short delay (let the app fully load)
  setTimeout(() => {
    writeLog('Initiating update check');
    autoUpdater.checkForUpdates().catch((err) => {
      writeLog(`Failed to check for updates: ${err.message}`);
    });
  }, 5000);
}

// ─── App Lifecycle ──────────────────────────────────────────

app.whenReady().then(() => {
  setupIPC();
  startNextServer();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Kill Next.js server
  killServerProcess();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killServerProcess();
});

// Prevent multiple instances
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}
