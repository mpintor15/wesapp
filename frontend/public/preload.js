const { contextBridge } = require('electron');

// Keep the preload bridge minimal. Expand intentionally when a renderer API is required.
contextBridge.exposeInMainWorld('wesapp', {
  appName: 'WESApp'
});
