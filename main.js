const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec } = require("child_process");

let unzipper;
try { unzipper = require("unzipper"); } catch { unzipper = null; }

let mainWindow;

/* ============================================================
   حالة التحميل - تبقى محفوظة طول عمر البرنامج
============================================================ */
const dlState = {
    running: false,
    percent: 0,
    speed: "0",
    product: null,
    zipPath: null,
    stage: null,
    stageMsg: "",
    pendingName: ""
};

const BACKEND_URL      = "https://ca-backend-app-production.up.railway.app";
const FIVEM_INDICATORS = ["citizen", "plugins", "mods", "logs", "data", "bin"];
const GRAPHICS_FOLDERS = ["citizen", "plugins", "mods"];
const SESSION_PATH     = path.join(app.getPath("userData"), "session.json");
const FIVEM_PATH_FILE  = path.join(app.getPath("userData"), "fivem_path.txt");

const LAUNCHERS = [
    { url: "https://drive.google.com/uc?export=download&confirm=t&id=1wmpQhGxRN8y6s5kDPFfKO-Vb32p8AbYS", fileName: "CA - L1.exe" },
    { url: "https://drive.google.com/uc?export=download&confirm=t&id=1-WnvUNCVATIOcp8tjiBw5DHssMx_85Ax", fileName: "CA - L2.exe" }
];

function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

/* ============================================================
   AUTO DETECT FIVEM PATH
============================================================ */
function detectFiveMPath() {
    const candidates = [
        path.join(process.env.LOCALAPPDATA || "", "FiveM", "FiveM.app"),
        path.join(process.env.LOCALAPPDATA || "", "FiveM"),
        path.join(process.env.APPDATA || "", "CitizenFX"),
    ];
    for (const p of candidates) {
        try {
            if (fs.existsSync(p) && FIVEM_INDICATORS.some(f => fs.readdirSync(p).includes(f)))
                return p;
        } catch {}
    }
    return null;
}

/* ============================================================
   CREATE WINDOW
============================================================ */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1100, height: 700,
        frame: false, transparent: true, resizable: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: false
        }
    });
    mainWindow.loadFile(path.join(__dirname, "app", "index.html"));

    // ✅ لما تتحمّل صفحة جديدة، أعد إرسال الحالة للـ renderer
    mainWindow.webContents.on("did-finish-load", () => {
        if (dlState.running || dlState.stage === "installing") {
            // أرسل الحالة الحالية للصفحة الجديدة
            sendToRenderer("download:progress", {
                percent: dlState.percent,
                speed: dlState.speed
            });
            if (dlState.stage) {
                sendToRenderer("install:status", {
                    stage: dlState.stage,
                    msg: dlState.stageMsg
                });
            }
        }
    });
}

app.whenReady().then(() => {
    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
});

/* ============================================================
   WINDOW CONTROLS
============================================================ */
ipcMain.handle("window:minimize",   () => mainWindow.minimize());
ipcMain.handle("window:close",      () => mainWindow.close());
ipcMain.handle("window:fullscreen", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});
ipcMain.handle("open:page", (e, page) => {
    mainWindow.loadFile(path.join(__dirname, "app", page));
});

/* ============================================================
   DOWNLOAD STATE - الـ renderer يطلبه عند فتح الصفحة
============================================================ */
ipcMain.handle("download:getState", () => ({ ...dlState }));

/* ============================================================
   FIVEM PATH
============================================================ */
function isValidFiveMPath(p) {
    try { return FIVEM_INDICATORS.some(f => fs.readdirSync(p).includes(f)); }
    catch { return false; }
}

ipcMain.handle("path:validate", (e, p) => ({ valid: isValidFiveMPath(p) }));

ipcMain.handle("path:select", async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    return r.canceled ? { success: false } : { success: true, path: r.filePaths[0] };
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
        if (fs.existsSync(FIVEM_PATH_FILE)) {
            const saved = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
            if (saved && fs.existsSync(saved)) return { success: true, path: saved };
        }
        const auto = detectFiveMPath();
        if (auto) { fs.writeFileSync(FIVEM_PATH_FILE, auto, "utf8"); return { success: true, path: auto, auto: true }; }
        return { success: false };
    } catch { return { success: false }; }
});

/* ============================================================
   HIDE / UNHIDE
   ✅ الإخفاء القوي بـ +h +s على المجلد فقط
============================================================ */
function attribHideFolder(folderPath) {
    return new Promise(resolve => {
        exec(`attrib +h +s "${folderPath}"`, () => resolve());
    });
}

function attribUnhideFolder(folderPath) {
    return new Promise(resolve => {
        exec(`attrib -h -s "${folderPath}"`, () => {
            exec(`attrib -h -s "${folderPath}\\*" /s /d`, () => resolve());
        });
    });
}

function unhideItem(itemPath) {
    return new Promise(resolve => exec(`attrib -h -s "${itemPath}"`, () => resolve()));
}

/* ============================================================
   DELETE FOLDER
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
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dest, e.name);
        e.isDirectory() ? copyDirRecursive(s, d) : fs.copyFileSync(s, d);
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
function resolveGDriveUrl(url) {
    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) return `https://drive.google.com/uc?export=download&confirm=t&id=${m1[1]}`;
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return `https://drive.google.com/uc?export=download&confirm=t&id=${m2[1]}`;
    return url;
}

function httpsGet(url, headers = {}, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname, path: u.pathname + u.search, method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ...headers }
        }, res => {
            if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
                if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
                let loc = res.headers.location;
                if (loc.startsWith("/")) loc = `https://${u.hostname}${loc}`;
                const cookies = res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") || "";
                const newH = cookies ? { ...headers, Cookie: cookies } : headers;
                try {
                    const lu = new URL(loc.startsWith("http") ? loc : `https://drive.google.com${loc}`);
                    if (!lu.searchParams.get("confirm")) { lu.searchParams.set("confirm", "t"); loc = lu.toString(); }
                } catch {}
                return httpsGet(loc, newH, maxRedirects - 1).then(resolve).catch(reject);
            }
            resolve(res);
        });
        req.on("error", reject);
        req.end();
    });
}

/* ============================================================
   DOWNLOAD:START
   ✅ التحميل يعمل في main process
   ✅ did-finish-load يعيد إرسال الحالة لأي صفحة تُفتح
============================================================ */
ipcMain.handle("download:start", async (e, { url, product }) => {
    if (dlState.running) return { success: false, message: "Download already in progress" };

    return new Promise(async (resolve) => {
        try {
            const zipPath = path.join(app.getPath("temp"), `${product}_${Date.now()}.zip`);
            const response = await httpsGet(resolveGDriveUrl(url));

            if ((response.headers["content-type"] || "").includes("text/html")) {
                resolve({ success: false });
                return;
            }

            const total = parseInt(response.headers["content-length"] || "0");
            let downloaded = 0;

            dlState.running  = true;
            dlState.percent  = 0;
            dlState.speed    = "0";
            dlState.product  = product;
            dlState.zipPath  = zipPath;
            dlState.stage    = "downloading";
            dlState.stageMsg = "جاري التحميل...";

            const file = fs.createWriteStream(zipPath);

            response.on("data", chunk => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
                const speed   = (chunk.length / 1024 / 1024).toFixed(2);
                dlState.percent = percent;
                dlState.speed   = speed;
                sendToRenderer("download:progress", { percent, speed });
            });

            response.pipe(file);

            file.on("finish", () => {
                file.close();
                dlState.stage    = "installing";
                dlState.stageMsg = "جاري التثبيت...";
                sendToRenderer("download:done", { product, zipPath });
                resolve({ success: true, zipPath });
            });

            file.on("error", () => {
                dlState.running = false;
                dlState.stage   = "error";
                resolve({ success: false });
            });

        } catch {
            dlState.running = false;
            dlState.stage   = "error";
            resolve({ success: false });
        }
    });
});

/* ============================================================
   DOWNLOAD LAUNCHERS
============================================================ */
ipcMain.handle("download:launchers", async () => {
    const desktop = app.getPath("desktop");
    for (let i = 0; i < LAUNCHERS.length; i++) {
        const { url, fileName } = LAUNCHERS[i];
        try {
            const res   = await httpsGet(url);
            const total = parseInt(res.headers["content-length"] || "0");
            let dl = 0;
            sendToRenderer("install:status", { stage: "copying", msg: `جاري تحميل ${fileName}...` });
            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(path.join(desktop, fileName));
                res.on("data", chunk => {
                    dl += chunk.length;
                    const pct = total > 0 ? Math.floor((dl / total) * 100) : 0;
                    sendToRenderer("download:progress", { percent: i * 50 + Math.floor(pct / 2), speed: (chunk.length / 1024 / 1024).toFixed(2) });
                });
                res.pipe(file);
                file.on("finish", () => { file.close(); resolve(); });
                file.on("error", reject);
            });
        } catch (err) { console.error(`Launcher error (${fileName}):`, err.message); }
    }
    sendToRenderer("download:progress", { percent: 100, speed: "0" });
    sendToRenderer("install:status", { stage: "done", msg: "✅ تم تحميل الـ Launchers على سطح المكتب" });
    sendToRenderer("download:done", { product: "launchers", zipPath: "" });
    return { success: true };
});

/* ============================================================
   INSTALL:RUN
============================================================ */
ipcMain.handle("install:run", async (e, { zipPath, product }) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        if (!isValidFiveMPath(fivemPath)) return { success: false };

        const send = (stage, msg) => {
            dlState.stage    = stage;
            dlState.stageMsg = msg;
            sendToRenderer("install:status", { stage, msg });
        };

        send("preparing", "جاري التحضير...");
        for (const folder of GRAPHICS_FOLDERS) {
            const dest = path.join(fivemPath, folder);
            if (fs.existsSync(dest)) await attribUnhideFolder(dest);
        }

        send("extracting", "جاري فك الضغط...");
        const tempExtract = path.join(app.getPath("temp"), `ca_extract_${Date.now()}`);
        fs.mkdirSync(tempExtract, { recursive: true });

        await new Promise((resolve, reject) => {
            if (unzipper) {
                fs.createReadStream(zipPath)
                    .pipe(unzipper.Extract({ path: tempExtract }))
                    .on("close", resolve).on("error", reject);
            } else {
                exec(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtract}' -Force"`,
                    err => err ? reject(err) : resolve());
            }
        });

        const packFolder = findPackFolder(tempExtract);

        send("copying", "جاري نسخ الملفات...");
        let copiedAny = false;
        for (const folder of GRAPHICS_FOLDERS) {
            const src  = path.join(packFolder, folder);
            const dest = path.join(fivemPath, folder);
            if (fs.existsSync(src)) { copyDirRecursive(src, dest); copiedAny = true; }
        }

        try { fs.unlinkSync(zipPath); } catch {}
        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}
        if (!copiedAny) return { success: false };

        // ✅ إخفاء قوي +h +s على المجلد فقط
        send("hiding", "جاري حماية الملفات...");
        for (const folder of GRAPHICS_FOLDERS) {
            const dest = path.join(fivemPath, folder);
            if (fs.existsSync(dest)) await attribHideFolder(dest);
        }

        dlState.running = false;
        send("done", "تم التثبيت بنجاح ✅");
        return { success: true };

    } catch (err) {
        console.error("Install error:", err);
        dlState.running = false;
        dlState.stage   = "error";
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
        for (const folder of GRAPHICS_FOLDERS) await deleteFolder(path.join(fivemPath, folder));
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
        const iniPath   = path.join(fivemPath, "CitizenFX.ini");
        if (!fs.existsSync(iniPath)) return { success: false, message: "ملف CitizenFX.ini غير موجود" };

        await unhideItem(iniPath);
        let content = fs.readFileSync(iniPath, "utf8");
        if (content.includes("ReShade5=ID:"))
            return { success: false, alreadyEnabled: true, message: "ReShade مفعّل مسبقاً" };

        const line = `ReShade5=ID:9943938c acknowledged that ReShade 5.x has a bug that will lead to game crashes`;
        content = content.includes("[Addons]")
            ? content.replace("[Addons]", `[Addons]\n${line}`)
            : content + `\n[Addons]\n${line}\n`;

        fs.writeFileSync(iniPath, content, "utf8");
        return { success: true, message: "تم تفعيل ReShade بنجاح ✅" };
    } catch { return { success: false, message: "حدث خطأ" }; }
});

/* ============================================================
   MODS
============================================================ */
ipcMain.handle("mods:list", () => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: true, files: [] };
        const fivemPath  = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) return { success: true, files: [] };
        return { success: true, files: fs.readdirSync(modsFolder).filter(f => f.endsWith(".rpf")) };
    } catch { return { success: false, files: [] }; }
});

ipcMain.handle("mods:add", async () => {
    const r = await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: "RPF Files", extensions: ["rpf"] }],
        properties: ["openFile", "multiSelections"]
    });
    return (r.canceled || !r.filePaths.length) ? { success: false } : { success: true, files: r.filePaths };
});

ipcMain.handle("mods:save", (e, files) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath  = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) fs.mkdirSync(modsFolder, { recursive: true });
        const keep = new Set(files.map(f => path.basename(f)));
        fs.readdirSync(modsFolder).filter(f => f.endsWith(".rpf") && !keep.has(f))
            .forEach(f => fs.unlinkSync(path.join(modsFolder, f)));
        files.filter(f => f.includes("\\") || (f.includes("/") && !f.startsWith("./")))
            .forEach(f => {
                const dest = path.join(modsFolder, path.basename(f));
                if (fs.existsSync(f) && f !== dest) fs.copyFileSync(f, dest);
            });
        return { success: true };
    } catch { return { success: false }; }
});

ipcMain.handle("mods:download", async (e, { url, fileName }) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };
        const fivemPath  = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) fs.mkdirSync(modsFolder, { recursive: true });
        const response = await httpsGet(resolveGDriveUrl(url));
        return new Promise(resolve => {
            const file = fs.createWriteStream(path.join(modsFolder, fileName));
            response.pipe(file);
            file.on("finish", () => { file.close(); resolve({ success: true }); });
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
    const authWin = new BrowserWindow({ width: 500, height: 700, parent: mainWindow, modal: true });
    authWin.loadURL(url);
    return new Promise(resolve => {
        const server = require("http").createServer(async (req, res) => {
            const code = new URL(req.url, "http://localhost:7842").searchParams.get("code");
            if (!code) { res.writeHead(200); res.end("missing code"); return; }
            res.end("<h2 style='font-family:sans-serif;text-align:center;margin-top:50px'>✅ تم! يمكنك إغلاق هذه النافذة</h2>");
            authWin.close(); server.close();
            const { machineIdSync } = require("node-machine-id");
            const result = await fetch(`${BACKEND_URL}/auth/callback`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, hwid: machineIdSync() })
            }).then(r => r.json());
            if (result.success) fs.writeFileSync(SESSION_PATH, JSON.stringify({
                token: result.token, plans: result.plans, username: result.username
            }));
            resolve(result);
        }).listen(7842, "127.0.0.1");
    });
});

ipcMain.handle("auth:check", async () => {
    try {
        if (!fs.existsSync(SESSION_PATH)) return { success: false };
        const session = JSON.parse(fs.readFileSync(SESSION_PATH, "utf8"));
        const { machineIdSync } = require("node-machine-id");
        const result = await fetch(`${BACKEND_URL}/auth/verify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: session.token, hwid: machineIdSync() })
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
autoUpdater.on("update-available",  () => sendToRenderer("update:status", "update-available"));
autoUpdater.on("update-downloaded", () => { sendToRenderer("update:status", "update-downloaded"); autoUpdater.quitAndInstall(); });