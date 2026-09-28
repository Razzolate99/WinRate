const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('winrate', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  scanGame: () => ipcRenderer.invoke('game:scan'),
  openDeveloperPortal: () =>
    ipcRenderer.invoke('external:open', 'https://developer.riotgames.com/'),
})
