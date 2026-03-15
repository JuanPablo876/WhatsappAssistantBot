import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose a safe API to the renderer process
 * Accessible via window.electronAPI
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  
  // Native dialogs
  showOpenDialog: (options: Electron.OpenDialogOptions) => 
    ipcRenderer.invoke('show-open-dialog', options),
  showSaveDialog: (options: Electron.SaveDialogOptions) => 
    ipcRenderer.invoke('show-save-dialog', options),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  quitApp: () => ipcRenderer.send('quit-app'),
  
  // Auto-updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  installUpdate: () => ipcRenderer.send('install-update'),
  
  // Check if running in Electron
  isElectron: true,
});

// Type definitions for window.electronAPI
declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>;
      getAppPath: () => Promise<string>;
      showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
      showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      quitApp: () => void;
      checkForUpdates: () => Promise<{ available: boolean; version?: string; releaseNotes?: string; error?: string; message?: string }>;
      downloadUpdate: () => void;
      installUpdate: () => void;
      isElectron: boolean;
    };
  }
}
