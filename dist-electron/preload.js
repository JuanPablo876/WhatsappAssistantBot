"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Expose a safe API to the renderer process
 * Accessible via window.electronAPI
 */
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getAppVersion: () => electron_1.ipcRenderer.invoke('get-app-version'),
    getAppPath: () => electron_1.ipcRenderer.invoke('get-app-path'),
    // Native dialogs
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('show-save-dialog', options),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.send('minimize-window'),
    maximizeWindow: () => electron_1.ipcRenderer.send('maximize-window'),
    closeWindow: () => electron_1.ipcRenderer.send('close-window'),
    quitApp: () => electron_1.ipcRenderer.send('quit-app'),
    // Auto-updates
    checkForUpdates: () => electron_1.ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => electron_1.ipcRenderer.send('download-update'),
    installUpdate: () => electron_1.ipcRenderer.send('install-update'),
    // Check if running in Electron
    isElectron: true,
});
