const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {

    minimize:   () => ipcRenderer.invoke("window:minimize"),
    close:      () => ipcRenderer.invoke("window:close"),
    fullscreen: () => ipcRenderer.invoke("window:fullscreen"),
    openPage:   (page) => ipcRenderer.invoke("open:page", page),

    /* ── Path ── */
    selectFolder:      ()  => ipcRenderer.invoke("path:select"),
    saveFiveMPath:     (p) => ipcRenderer.invoke("path:save", p),
    getFiveMPath:      ()  => ipcRenderer.invoke("path:get"),
    validateFiveMPath: (p) => ipcRenderer.invoke("path:validate", p),

    /* ── Download ── */
    startDownload: (url, product, name) =>
        ipcRenderer.invoke("download:start", { url, product, name }),

    downloadLaunchers: () => ipcRenderer.invoke("download:launchers"),
    getDownloadState:  () => ipcRenderer.invoke("download:getState"),

    onDownloadProgress: (cb) => {
        ipcRenderer.removeAllListeners("download:progress");
        ipcRenderer.on("download:progress", (_, d) => cb(d));
    },
    onDownloadDone: (cb) => {
        ipcRenderer.removeAllListeners("download:done");
        ipcRenderer.on("download:done", (_, d) => cb(d));
    },
    // يستقبل الحالة الكاملة لما تُفتح صفحة جديدة
    onDownloadStateSync: (cb) => {
        ipcRenderer.removeAllListeners("download:stateSync");
        ipcRenderer.on("download:stateSync", (_, d) => cb(d));
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
    getModsList:  ()              => ipcRenderer.invoke("mods:list"),
    addModFile:   ()              => ipcRenderer.invoke("mods:add"),
    saveMods:     (files)         => ipcRenderer.invoke("mods:save", files),
    downloadMod:  (url, fileName) => ipcRenderer.invoke("mods:download", { url, fileName }),

    /* ── Auth ── */
    auth: {
        login:  () => ipcRenderer.invoke("auth:login"),
        check:  () => ipcRenderer.invoke("auth:check"),
        logout: () => ipcRenderer.invoke("auth:logout"),
    },

    /* ── Performance ── */
    clearTempFiles:         () => ipcRenderer.invoke("performance:clearTemp"),
    clearCache:             () => ipcRenderer.invoke("performance:clearCache"),
    clearLogs:               () => ipcRenderer.invoke("performance:clearLogs"),
    getSystemInfo:          () => ipcRenderer.invoke("performance:getSystemInfo"),
    optimizeNvidia:         () => ipcRenderer.invoke("performance:optimizeNvidia"),
    enableGameMode:         () => ipcRenderer.invoke("performance:enableGameMode"),
    optimizeFiveMGraphics:  () => ipcRenderer.invoke("performance:optimizeFiveMGraphics"),
    optimizeServices:       () => ipcRenderer.invoke("performance:optimizeServices"),
    optimizeNetwork:        () => ipcRenderer.invoke("performance:optimizeNetwork"),
    optimizeRAM:            () => ipcRenderer.invoke("performance:optimizeRAM"),
    fullOptimization:       () => ipcRenderer.invoke("performance:fullOptimization"),
    restoreNvidia:          () => ipcRenderer.invoke("performance:restoreNvidia"),
    restoreGameMode:        () => ipcRenderer.invoke("performance:restoreGameMode"),
    restoreFiveMGraphics:   () => ipcRenderer.invoke("performance:restoreFiveMGraphics"),
    restoreServices:        () => ipcRenderer.invoke("performance:restoreServices"),
    restoreNetwork:         () => ipcRenderer.invoke("performance:restoreNetwork"),
    restoreRAM:             () => ipcRenderer.invoke("performance:restoreRAM"),
    restoreAll:             () => ipcRenderer.invoke("performance:restoreAll"),

    /* ── Ratings ── */
    ratings: {
        get: () => ipcRenderer.invoke("ratings:get"),
        getPack: (packId) => ipcRenderer.invoke("ratings:getPack", packId),
        submit: (packId, rating, comment, username) =>
            ipcRenderer.invoke("ratings:submit", { packId, rating, comment, username }),
        deleteComment: (packId, commentIndex, username) =>
            ipcRenderer.invoke("ratings:deleteComment", { packId, commentIndex, username }),
        deleteRating: (packId, ratingIndex, username) =>
            ipcRenderer.invoke("ratings:deleteRating", { packId, ratingIndex, username }),
    },

    /* ── Auto Update ── */
    checkUpdate: () => ipcRenderer.invoke("update:check"),
    onUpdateStatus: (cb) => {
        ipcRenderer.removeAllListeners("update:status");
        ipcRenderer.on("update:status", (_, d) => cb(d));
    },
    onUpdateProgress: (cb) => {
        ipcRenderer.removeAllListeners("update:progress");
        ipcRenderer.on("update:progress", (_, d) => cb(d));
    },
});