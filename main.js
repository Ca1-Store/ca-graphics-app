const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec } = require("child_process");

let unzipper;
try {
    unzipper = require("unzipper");
} catch (e) {
    unzipper = null;
}

let mainWindow;

// ✅ التحميل يشتغل في الخلفية ومستقل عن الصفحات
let activeDownload = {
    response: null,
    file: null,
    zipPath: null,
    running: false,
    resolve: null
};

const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";
const FIVEM_INDICATORS = ["citizen", "plugins", "mods", "logs", "data", "bin"];
const GRAPHICS_FOLDERS = ["citizen", "plugins", "mods"];

// ✅ كل الملفات في userData عشان تشتغل بعد البناء
const SESSION_PATH   = path.join(app.getPath("userData"), "session.json");
const FIVEM_PATH_FILE = path.join(app.getPath("userData"), "fivem_path.txt");

const LAUNCHERS = [
    {
        url: "https://drive.google.com/uc?export=download&confirm=t&id=1wmpQhGxRN8y6s5kDPFfKO-Vb32p8AbYS",
        fileName: "CA - L1.exe"
    },
    {
        url: "https://drive.google.com/uc?export=download&confirm=t&id=1-WnvUNCVATIOcp8tjiBw5DHssMx_85Ax",
        fileName: "CA - L2.exe"
    }
];

/* ============================================================
   AUTO DETECT FIVEM PATH
============================================================ */
function detectFiveMPath() {
    const possiblePaths = [
        path.join(process.env.LOCALAPPDATA || "", "FiveM", "FiveM.app"),
        path.join(process.env.LOCALAPPDATA || "", "FiveM"),
        path.join(process.env.APPDATA || "", "CitizenFX"),
    ];
    for (const p of possiblePaths) {
        try {
            if (fs.existsSync(p)) {
                const files = fs.readdirSync(p);
                if (FIVEM_INDICATORS.some(f => files.includes(f))) return p;
            }
        } catch {}
    }
    return null;
}

/* ============================================================
   CREATE WINDOW
============================================================ */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100,
        height: 700,
        frame: false,
        transparent: true,
        resizable: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, "app", "index.html"));
}

app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
});

/* ============================================================
   WINDOW CONTROLS
============================================================ */
ipcMain.handle("window:minimize", () => mainWindow.minimize());
ipcMain.handle("window:close",    () => mainWindow.close());
ipcMain.handle("window:fullscreen", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});

ipcMain.handle("open:page", (e, page) => {
    mainWindow.loadFile(path.join(__dirname, "app", page));
});

/* ============================================================
   FIVEM PATH
============================================================ */
function isValidFiveMPath(fivemPath) {
    try {
        const contents = fs.readdirSync(fivemPath);
        return FIVEM_INDICATORS.some(f => contents.includes(f));
    } catch { return false; }
}

ipcMain.handle("path:validate", (e, fivemPath) => ({ valid: isValidFiveMPath(fivemPath) }));

ipcMain.handle("path:select", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    if (result.canceled) return { success: false };
    return { success: true, path: result.filePaths[0] };
});

ipcMain.handle("path:save", (e, fivemPath) => {
    try {
        const clean = (fivemPath || "").trim();
        if (!clean || !fs.existsSync(clean)) return { success: false };
        fs.writeFileSync(FIVEM_PATH_FILE, clean, "utf8");
        return { success: true };
    } catch { return { success: false }; }
});

ipcMain.handle("path:get", () => {
    try {
        // ✅ يحاول يقرأ المحفوظ أولاً
        if (fs.existsSync(FIVEM_PATH_FILE)) {
            const saved = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
            if (saved && fs.existsSync(saved)) {
                return { success: true, path: saved };
            }
        }
        // ✅ يكتشف تلقائياً إذا ما فيه محفوظ
        const auto = detectFiveMPath();
        if (auto) {
            fs.writeFileSync(FIVEM_PATH_FILE, auto, "utf8");
            return { success: true, path: auto, auto: true };
        }
        return { success: false };
    } catch { return { success: false }; }
});

/* ============================================================
   HIDE / UNHIDE HELPERS
============================================================ */
function attribHideFolder(folderPath) {
    return new Promise((resolve) => {
        exec(`attrib +h "${folderPath}"`, () => {
            exec(`attrib +h "${folderPath}\\*" /s /d`, () => resolve());
        });
    });
}

function attribUnhideFolder(folderPath) {
    return new Promise((resolve) => {
        exec(`attrib -h -s "${folderPath}"`, () => {
            exec(`attrib -h -s "${folderPath}\\*" /s /d`, () => resolve());
        });
    });
}

function unhideItemWindows(itemPath) {
    return new Promise((resolve) => {
        exec(`attrib -h -s "${itemPath}"`, () => resolve());
    });
}

/* ============================================================
   DELETE FOLDER (حتى لو مخفي)
============================================================ */
async function deleteFolder(folderPath) {
    try {
        if (!fs.existsSync(folderPath)) return;
        await attribUnhideFolder(folderPath);
        fs.rmSync(folderPath, { recursive: true, force: true });
    } catch {
        try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}
    }
}

/* ============================================================
   COPY DIR RECURSIVE
============================================================ */
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDirRecursive(s, d);
        else fs.copyFileSync(s, d);
    }
}

/* ============================================================
   FIND PACK FOLDER
============================================================ */
function findPackFolder(extractPath) {
    if (GRAPHICS_FOLDERS.some(f => fs.existsSync(path.join(extractPath, f)))) return extractPath;
    for (const item of fs.readdirSync(extractPath, { withFileTypes: true })) {
        if (!item.isDirectory()) continue;
        const sub = path.join(extractPath, item.name);
        if (GRAPHICS_FOLDERS.some(f => fs.existsSync(path.join(sub, f)))) return sub;
        try {
            for (const deep of fs.readdirSync(sub, { withFileTypes: true })) {
                if (!deep.isDirectory()) continue;
                const dp = path.join(sub, deep.name);
                if (GRAPHICS_FOLDERS.some(f => fs.existsSync(path.join(dp, f)))) return dp;
            }
        } catch {}
    }
    return extractPath;
}

/* ============================================================
   GOOGLE DRIVE HELPER
============================================================ */
function resolveGoogleDriveUrl(url) {
    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) return `https://drive.google.com/uc?export=download&confirm=t&id=${m1[1]}`;
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return `https://drive.google.com/uc?export=download&confirm=t&id=${m2[1]}`;
    return url;
}

function httpsGetWithRedirects(url, headers = {}, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = https.request({
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ...headers }
        }, (res) => {
            if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
                if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
                let loc = res.headers.location;
                if (loc.startsWith("/")) loc = `https://${parsedUrl.hostname}${loc}`;
                const cookies = res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") || "";
                const newH = cookies ? { ...headers, Cookie: cookies } : headers;
                try {
                    const u = new URL(loc.startsWith("http") ? loc : `https://drive.google.com${loc}`);
                    if (!u.searchParams.get("confirm")) { u.searchParams.set("confirm", "t"); loc = u.toString(); }
                } catch {}
                return httpsGetWithRedirects(loc, newH, maxRedirects - 1).then(resolve).catch(reject);
            }
            resolve(res);
        });
        req.on("error", reject);
        req.end();
    });
}

/* ============================================================
   DOWNLOAD START
   ✅ التحميل يستمر حتى لو المستخدم انتقل بين الصفحات
   لأن العملية كلها في main process وليست مرتبطة بـ renderer
============================================================ */
ipcMain.handle("download:start", async (e, { url, product }) => {
    // إذا فيه تحميل شغّال، أرجع zipPath الموجود
    if (activeDownload.running) {
        return { success: false, message: "Download already in progress" };
    }

    return new Promise(async (resolve) => {
        try {
            const zipPath = path.join(app.getPath("temp"), `${product}_${Date.now()}.zip`);
            const directUrl = resolveGoogleDriveUrl(url);
            const response = await httpsGetWithRedirects(directUrl);

            const contentType = response.headers["content-type"] || "";
            if (contentType.includes("text/html")) {
                resolve({ success: false });
                return;
            }

            const total = parseInt(response.headers["content-length"] || "0");
            let downloaded = 0;

            activeDownload.running = true;
            activeDownload.response = response;
            activeDownload.zipPath = zipPath;

            const file = fs.createWriteStream(zipPath);
            activeDownload.file = file;

            response.on("data", (chunk) => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
                // ✅ يرسل للـ mainWindow حتى لو تغيّرت الصفحة
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("download:progress", {
                        percent,
                        speed: (chunk.length / 1024 / 1024).toFixed(2)
                    });
                }
            });

            response.pipe(file);

            file.on("finish", () => {
                file.close();
                activeDownload.running = false;
                activeDownload.response = null;
                activeDownload.file = null;

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send("download:done", { product, zipPath });
                }
                resolve({ success: true, zipPath });
            });

            file.on("error", () => {
                activeDownload.running = false;
                resolve({ success: false });
            });

        } catch {
            activeDownload.running = false;
            resolve({ success: false });
        }
    });
});

/* ============================================================
   DOWNLOAD LAUNCHERS على سطح المكتب
============================================================ */
ipcMain.handle("download:launchers", async () => {
    const desktopPath = app.getPath("desktop");

    for (let i = 0; i < LAUNCHERS.length; i++) {
        const launcher = LAUNCHERS[i];
        try {
            const destPath = path.join(desktopPath, launcher.fileName);
            const response = await httpsGetWithRedirects(launcher.url);
            const total = parseInt(response.headers["content-length"] || "0");
            let downloaded = 0;

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("install:status", {
                    stage: "copying",
                    msg: `جاري تحميل ${launcher.fileName}...`
                });
            }

            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(destPath);
                response.on("data", (chunk) => {
                    downloaded += chunk.length;
                    const percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
                    const scaled = (i * 50) + Math.floor(percent / 2);
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send("download:progress", {
                            percent: scaled,
                            speed: (chunk.length / 1024 / 1024).toFixed(2)
                        });
                    }
                });
                response.pipe(file);
                file.on("finish", () => { file.close(); resolve(); });
                file.on("error", reject);
            });

        } catch (err) {
            console.error(`Launcher error (${launcher.fileName}):`, err.message);
        }
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("download:progress", { percent: 100, speed: "0" });
        mainWindow.webContents.send("install:status", { stage: "done", msg: "✅ تم تحميل الـ Launchers على سطح المكتب" });
        mainWindow.webContents.send("download:done", { product: "launchers", zipPath: "" });
    }

    return { success: true };
});

/* ============================================================
   INSTALL PACK
============================================================ */
ipcMain.handle("install:run", async (e, { zipPath, product }) => {
    try {
        // ✅ يقرأ من FIVEM_PATH_FILE (userData) وليس __dirname
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        if (!isValidFiveMPath(fivemPath)) return { success: false };

        const send = (stage, msg) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("install:status", { stage, msg });
            }
        };

        // مرحلة 1: إزالة الإخفاء
        send("preparing", "جاري التحضير...");
        for (const folder of GRAPHICS_FOLDERS) {
            const dest = path.join(fivemPath, folder);
            if (fs.existsSync(dest)) await attribUnhideFolder(dest);
        }

        // مرحلة 2: فك الضغط
        send("extracting", "جاري فك الضغط...");
        const tempExtract = path.join(app.getPath("temp"), `ca_extract_${Date.now()}`);
        fs.mkdirSync(tempExtract, { recursive: true });

        await new Promise((resolve, reject) => {
            if (unzipper) {
                fs.createReadStream(zipPath)
                    .pipe(unzipper.Extract({ path: tempExtract }))
                    .on("close", resolve)
                    .on("error", reject);
            } else {
                exec(
                    `powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtract}' -Force"`,
                    (err) => err ? reject(err) : resolve()
                );
            }
        });

        const packFolder = findPackFolder(tempExtract);

        // مرحلة 3: نسخ
        send("copying", "جاري نسخ الملفات...");
        let copiedAny = false;
        for (const folder of GRAPHICS_FOLDERS) {
            const src  = path.join(packFolder, folder);
            const dest = path.join(fivemPath, folder);
            if (fs.existsSync(src)) { copyDirRecursive(src, dest); copiedAny = true; }
        }

        // تنظيف temp
        try { fs.unlinkSync(zipPath); } catch {}
        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}

        if (!copiedAny) return { success: false };

        // مرحلة 4: إخفاء
        send("hiding", "جاري حماية الملفات...");
        for (const folder of GRAPHICS_FOLDERS) {
            const dest = path.join(fivemPath, folder);
            if (fs.existsSync(dest)) await attribHideFolder(dest);
        }

        send("done", "تم التثبيت بنجاح ✅");
        return { success: true };

    } catch (err) {
        console.error("Install error:", err);
        try { fs.unlinkSync(zipPath); } catch {}
        return { success: false };
    }
});

/* ============================================================
   DELETE GRAPHICS
============================================================ */
ipcMain.handle("graphics:delete", async () => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        for (const folder of GRAPHICS_FOLDERS) {
            await deleteFolder(path.join(fivemPath, folder));
        }
        return { success: true };
    } catch { return { success: false }; }
});

/* ============================================================
   RESHADE
============================================================ */
ipcMain.handle("reshade:enable", async () => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false, message: "مسار FiveM غير محدد" };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const iniPath = path.join(fivemPath, "CitizenFX.ini");
        if (!fs.existsSync(iniPath)) return { success: false, message: "ملف CitizenFX.ini غير موجود" };

        await unhideItemWindows(iniPath);
        let content = fs.readFileSync(iniPath, "utf8");

        if (content.includes("ReShade5=ID:")) {
            return { success: false, alreadyEnabled: true, message: "ReShade مفعّل مسبقاً" };
        }

        const line = `ReShade5=ID:9943938c acknowledged that ReShade 5.x has a bug that will lead to game crashes`;
        content = content.includes("[Addons]")
            ? content.replace("[Addons]", `[Addons]\n${line}`)
            : content + `\n[Addons]\n${line}\n`;

        fs.writeFileSync(iniPath, content, "utf8");
        // ✅ لا نخفي CitizenFX.ini
        return { success: true, message: "تم تفعيل ReShade بنجاح ✅" };
    } catch { return { success: false, message: "حدث خطأ" }; }
});

/* ============================================================
   MODS - يقرأ من FIVEM_PATH_FILE
============================================================ */
ipcMain.handle("mods:list", () => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: true, files: [] };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) return { success: true, files: [] };
        const files = fs.readdirSync(modsFolder).filter(f => f.endsWith(".rpf"));
        return { success: true, files };
    } catch { return { success: false, files: [] }; }
});

ipcMain.handle("mods:add", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: "RPF Files", extensions: ["rpf"] }],
        properties: ["openFile", "multiSelections"]
    });
    if (result.canceled || !result.filePaths.length) return { success: false };
    return { success: true, files: result.filePaths };
});

ipcMain.handle("mods:save", (e, files) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) fs.mkdirSync(modsFolder, { recursive: true });

        const keepNames = new Set(files.map(f => path.basename(f)));
        fs.readdirSync(modsFolder).filter(f => f.endsWith(".rpf")).forEach(f => {
            if (!keepNames.has(f)) fs.unlinkSync(path.join(modsFolder, f));
        });
        files.forEach(file => {
            const isFullPath = file.includes("\\") || (file.includes("/") && !file.startsWith("./"));
            if (!isFullPath) return;
            const dest = path.join(modsFolder, path.basename(file));
            if (fs.existsSync(file) && file !== dest) fs.copyFileSync(file, dest);
        });
        return { success: true };
    } catch { return { success: false }; }
});

ipcMain.handle("mods:download", async (e, { url, fileName }) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) fs.mkdirSync(modsFolder, { recursive: true });

        const targetPath = path.join(modsFolder, fileName);
        const response = await httpsGetWithRedirects(resolveGoogleDriveUrl(url));

        return new Promise((resolve) => {
            const file = fs.createWriteStream(targetPath);
            response.pipe(file);
            file.on("finish", () => { file.close(); resolve({ success: true, path: targetPath }); });
            file.on("error", () => resolve({ success: false }));
        });
    } catch { return { success: false }; }
});

/* ============================================================
   AUTH
============================================================ */
ipcMain.handle("auth:login", async () => {
    const res = await fetch(`${BACKEND_URL}/auth/url`);
    const { url } = await res.json();
    const authWindow = new BrowserWindow({ width: 500, height: 700, parent: mainWindow, modal: true });
    authWindow.loadURL(url);

    return new Promise((resolve) => {
        const server = require("http").createServer(async (req, res) => {
            const code = new URL(req.url, "http://localhost:7842").searchParams.get("code");
            if (!code) { res.writeHead(200); res.end("missing code"); return; }

            res.end("<h2 style='font-family:sans-serif;text-align:center;margin-top:50px'>✅ تم! يمكنك إغلاق هذه النافذة</h2>");
            authWindow.close();
            server.close();

            const { machineIdSync } = require("node-machine-id");
            const hwid = machineIdSync();
            const result = await fetch(`${BACKEND_URL}/auth/callback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, hwid })
            }).then(r => r.json());

            if (result.success) {
                fs.writeFileSync(SESSION_PATH, JSON.stringify({
                    token: result.token,
                    plans: result.plans,
                    username: result.username
                }));
            }
            resolve(result);
        }).listen(7842, "127.0.0.1");
    });
});

ipcMain.handle("auth:check", async () => {
    try {
        if (!fs.existsSync(SESSION_PATH)) return { success: false };
        const session = JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
        const { machineIdSync } = require("node-machine-id");
        const hwid = machineIdSync();
        const result = await fetch(`${BACKEND_URL}/auth/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: session.token, hwid })
        }).then(r => r.json());
        if (result.success) result.username = session.username;
        return result;
    } catch { return { success: false }; }
});

ipcMain.handle("auth:logout", () => {
    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);
    return { success: true };
});

/* ============================================================
   AUTO UPDATER
============================================================ */
autoUpdater.on("update-available", () => {
    if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send("update:status", "update-available");
});

autoUpdater.on("update-downloaded", () => {
    if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send("update:status", "update-downloaded");
    autoUpdater.quitAndInstall();
});