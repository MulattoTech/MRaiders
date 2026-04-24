const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  getBootstrap: () => ipcRenderer.invoke('overlay:get-bootstrap'),
  updateSettings: (partial) =>
    ipcRenderer.invoke('overlay:update-settings', partial),
  togglePanel: (nextMode) =>
    ipcRenderer.invoke('overlay:toggle-panel', nextMode),
  resetCalibration: () => ipcRenderer.invoke('overlay:reset-calibration'),
  nudgeCalibration: (delta) =>
    ipcRenderer.invoke('overlay:nudge-calibration', delta),
  cycleMap: () => ipcRenderer.invoke('overlay:cycle-map'),
  reloadData: () => ipcRenderer.invoke('overlay:reload-data'),
  setVisibility: (nextVisible) =>
    ipcRenderer.invoke('overlay:set-visibility', nextVisible),
  onState: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on('overlay:state', listener);

    return () => {
      ipcRenderer.removeListener('overlay:state', listener);
    };
  }
});
