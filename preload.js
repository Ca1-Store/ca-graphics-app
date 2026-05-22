const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

    /* ===============================
        WINDOW CONTROLS
    ================================ */
    minimize: () => ipcRenderer.invoke("window:minimize"),
    close: () => ipcRenderer.invoke("window:close"),
    fullscreen: () => ipcRenderer.invoke("window:fullscreen"),

    /* ===============================
        PAGE NAVIGATION
    ================================ */
    openPage: (page) => ipcRenderer.invoke("open:page", page),

    /* ===============================
        FIVEM PATH
    ================================ */
    selectFolder: () => ipcRenderer.invoke("path:select"),
    saveFiveMPath: (path) => ipcRenderer.invoke("path:save", path),
    getFiveMPath: () => ipcRenderer.invoke("path:get"),
    validateFiveMPath: (path) => ipcRenderer.invoke("path:validate", path),

    /* ===============================
        DOWNLOAD SYSTEM
    ================================ */
    startDownload: (url, product) =>
        ipcRenderer.invoke("download:start", { url, product }),

    onDownloadProgress: (callback) =>
        ipcRenderer.on("download:progress", (e, data) => callback(data)),

    onDownloadDone: (callback) =>
        ipcRenderer.on("download:done", (e, data) => callback(data)),

    /* ===============================
        INSTALL SYSTEM
    ================================ */
    runInstall: (zipPath, product) =>
        ipcRenderer.invoke("install:run", { zipPath, product }),

    onInstallStatus: (callback) =>
        ipcRenderer.on("install:status", (e, data) => callback(data)),

    /* ===============================
        GRAPHICS MANAGEMENT
    ================================ */
    deleteGraphics: () => ipcRenderer.invoke("graphics:delete"),
    enableReshade: () => ipcRenderer.invoke("reshade:enable"),

    /* ===============================
        MODS MANAGEMENT
    ================================ */
    getModsList: () => ipcRenderer.invoke("mods:list"),
    addModFile: () => ipcRenderer.invoke("mods:add"),
    saveMods: (files) => ipcRenderer.invoke("mods:save", files),
    downloadMod: (url, fileName) =>
        ipcRenderer.invoke("mods:download", { url, fileName }),

    /* ===============================
        AUTH - Discord OAuth2
    ================================ */
    auth: {
        login: () => ipcRenderer.invoke("auth:login"),
        check: () => ipcRenderer.invoke("auth:check"),
        logout: () => ipcRenderer.invoke("auth:logout"),
    }

});