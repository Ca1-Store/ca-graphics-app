const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

    minimize:   () => ipcRenderer.invoke("window:minimize"),
    close:      () => ipcRenderer.invoke("window:close"),
    fullscreen: () => ipcRenderer.invoke("window:fullscreen"),

    openPage: (page) => ipcRenderer.invoke("open:page", page),

    selectFolder:       ()  => ipcRenderer.invoke("path:select"),
    saveFiveMPath: (p)      => ipcRenderer.invoke("path:save", p),
    getFiveMPath:       ()  => ipcRenderer.invoke("path:get"),
    validateFiveMPath:  (p) => ipcRenderer.invoke("path:validate", p),

    /* ── Download ── */
    startDownload: (url, product) =>
        ipcRenderer.invoke("download:start", { url, product }),

    downloadLaunchers: () =>
        ipcRenderer.invoke("download:launchers"),

    getDownloadState: () =>
        ipcRenderer.invoke("download:getState"),

    // ✅ يمسح الـ listeners القديمة قبل ما يسجّل جديدة
    onDownloadProgress: (cb) => {
        ipcRenderer.removeAllListeners("download:progress");
        ipcRenderer.on("download:progress", (_, d) => cb(d));
    },

    onDownloadDone: (cb) => {
        ipcRenderer.removeAllListeners("download:done");
        ipcRenderer.on("download:done", (_, d) => cb(d));
    },

    /* ── Install ── */
    runInstall: (zipPath, product) =>
        ipcRenderer.invoke("install:run", { zipPath, product }),

    onInstallStatus: (cb) => {
        ipcRenderer.removeAllListeners("install:status");
        ipcRenderer.on("install:status", (_, d) => cb(d));
    },

    /* ── Graphics ── */
    deleteGraphics: () => ipcRenderer.invoke("graphics:delete"),
    enableReshade:  () => ipcRenderer.invoke("reshade:enable"),

    /* ── Mods ── */
    getModsList:  ()           => ipcRenderer.invoke("mods:list"),
    addModFile:   ()           => ipcRenderer.invoke("mods:add"),
    saveMods:     (files)      => ipcRenderer.invoke("mods:save", files),
    downloadMod:  (url, fileName) =>
        ipcRenderer.invoke("mods:download", { url, fileName }),

    /* ── Auth ── */
    auth: {
        login:  () => ipcRenderer.invoke("auth:login"),
        check:  () => ipcRenderer.invoke("auth:check"),
        logout: () => ipcRenderer.invoke("auth:logout"),
    }
});