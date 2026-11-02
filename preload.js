const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("api", {
    openExternal: (url) => ipcRenderer.invoke("open:external", url),
    /* ── v4 ── */
    v4: {
        get:  (p)    => ipcRenderer.invoke("v4:request", { method: "GET", path: p }),
        post: (p, b) => ipcRenderer.invoke("v4:request", { method: "POST", path: p, body: b }),
        put:  (p, b) => ipcRenderer.invoke("v4:request", { method: "PUT", path: p, body: b }),
        del:  (p, b) => ipcRenderer.invoke("v4:request", { method: "DELETE", path: p, body: b }),
    },
    session: () => ipcRenderer.invoke("v4:session"),
    onSessionEnded: (cb) => { ipcRenderer.removeAllListeners("session:ended"); ipcRenderer.on("session:ended", (_, d) => cb(d)); },
    splash: {
        ready: () => ipcRenderer.invoke("splash:ready"),
        retry: () => ipcRenderer.invoke("splash:retry"),
        onEvent: (cb) => { ipcRenderer.removeAllListeners("splash:event"); ipcRenderer.on("splash:event", (_, d) => cb(d)); },
    },
    lib: {
        preflight:     (a)  => ipcRenderer.invoke("lib:preflight", a),
        install:       (a)  => ipcRenderer.invoke("lib:install", a),
        installBundle: (id) => ipcRenderer.invoke("lib:installBundle", id),
        installed:     ()   => ipcRenderer.invoke("lib:installed"),
        remove:        (a)  => ipcRenderer.invoke("lib:remove", a),
    },
    diag: {
        run:    () => ipcRenderer.invoke("diag:run"),
        export: () => ipcRenderer.invoke("diag:export"),
    },
    gta: {
        detect:         (force) => ipcRenderer.invoke("gta:detect", !!force),
        select:         () => ipcRenderer.invoke("gta:select"),
        state:          () => ipcRenderer.invoke("gta:state"),
        installLocal:   () => ipcRenderer.invoke("gta:installLocal"),
        installLocalAs: (token, target) => ipcRenderer.invoke("gta:installLocalAs", { token, target }),
        restore:        (a) => ipcRenderer.invoke("gta:restore", a),
    },
    app: { version: () => ipcRenderer.invoke("app:version") },
    saveText: (name, content) => ipcRenderer.invoke("app:saveText", { name, content }),
    minimize:   () => ipcRenderer.invoke("window:minimize"),
    close:      () => ipcRenderer.invoke("window:close"),
    fullscreen: () => ipcRenderer.invoke("window:fullscreen"),
    openPage:   (page) => ipcRenderer.invoke("open:page", page),
    readFile:   (p) => ipcRenderer.invoke("file:read", p),
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
    pauseDownload:     () => ipcRenderer.invoke("download:pause"),
    resumeDownload:    () => ipcRenderer.invoke("download:resume"),
    cancelDownload:    () => ipcRenderer.invoke("download:cancel"),
    presets: {
        list:       () => ipcRenderer.invoke("presets:list"),
        remove:     (names) => ipcRenderer.invoke("presets:remove", names),
        pick:       () => ipcRenderer.invoke("presets:pick"),
        save:       (name, content, overwrite) => ipcRenderer.invoke("presets:save", { name, content, overwrite }),
        install:    (file, url, overwrite) => ipcRenderer.invoke("presets:install", { file, url, overwrite })
    },
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
    backupGraphics:   () => ipcRenderer.invoke("graphics:backup"),
    backupInfo:       () => ipcRenderer.invoke("graphics:backupInfo"),
    restoreGraphics:  () => ipcRenderer.invoke("graphics:restore"),
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
        submit: (packId, rating, comment, username, discordId) =>
            ipcRenderer.invoke("ratings:submit", { packId, rating, comment, username, discordId }),
        deleteComment: (commentId, discordId) =>
            ipcRenderer.invoke("ratings:deleteComment", { commentId, discordId }),
        deleteRating: (ratingId, discordId) =>
            ipcRenderer.invoke("ratings:deleteRating", { ratingId, discordId }),
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
    /* ── Customizations ── */
    customizations: {
        checkInstalled: (customizationId) => ipcRenderer.invoke("customizations:checkInstalled", customizationId),
        install: (customizationId, url) => ipcRenderer.invoke("customizations:install", { customizationId, url }),
        delete: (customizationId) => ipcRenderer.invoke("customizations:delete", customizationId),
    },
});
