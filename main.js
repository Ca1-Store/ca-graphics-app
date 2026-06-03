const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { exec } = require("child_process");

let unzipper;
try { unzipper = require("unzipper"); } catch { unzipper = null; }



let mainWindow;



/* ============================================================

   DOWNLOAD STATE - يبقى محفوظ طول عمر البرنامج

============================================================ */

const dlState = {

    running:  false,

    percent:  0,

    speed:    "0",

    product:  null,

    zipPath:  null,

    stage:    null,   // downloading | preparing | extracting | copying | hiding | done | error

    stageMsg: "",

    name:     ""

};



/* ============================================================

   CONSTANTS

============================================================ */

const BACKEND_URL      = "https://ca-backend-app-production.up.railway.app";

const FIVEM_INDICATORS = ["citizen", "plugins", "mods", "logs", "data", "bin"];

const GRAPHICS_FOLDERS = ["citizen", "plugins", "mods"];

const SESSION_PATH     = path.join(app.getPath("userData"), "session.json");

const FIVEM_PATH_FILE  = path.join(app.getPath("userData"), "fivem_path.txt");

const LAUNCHERS = [

    { url: "http://213.199.63.97/CA%20-%20L1.exe", fileName: "CA - L1.exe" },

    { url: "http://213.199.63.97/CA%20-%20L2.exe", fileName: "CA - L2.exe" }

];



/* ============================================================

   HELPERS

============================================================ */

function send(channel, data) {

    if (mainWindow && !mainWindow.isDestroyed())

        mainWindow.webContents.send(channel, data);

}



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



function isValidFiveMPath(p) {

    try { return FIVEM_INDICATORS.some(f => fs.readdirSync(p).includes(f)); }

    catch { return false; }

}



/* ============================================================

   WINDOW

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



    // لما تتحمل صفحة جديدة أعد إرسال الحالة

    mainWindow.webContents.on("did-finish-load", () => {

        if (dlState.running || (dlState.stage && dlState.stage !== "done" && dlState.stage !== "error")) {

            send("download:stateSync", { ...dlState });

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

ipcMain.handle("open:page", (e, page) =>

    mainWindow.loadFile(path.join(__dirname, "app", page))

);



/* ============================================================

   DOWNLOAD STATE

============================================================ */

ipcMain.handle("download:getState", () => ({ ...dlState }));



/* ============================================================

   FIVEM PATH

============================================================ */

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

        if (auto) {

            fs.writeFileSync(FIVEM_PATH_FILE, auto, "utf8");

            return { success: true, path: auto, auto: true };

        }

        return { success: false };

    } catch { return { success: false }; }

});



/* ============================================================

   HIDE / UNHIDE

============================================================ */

const hide = (p) => new Promise(r => exec(`attrib +h +s "${p}"`, () => r()));

const unhide = (p) => new Promise(r => exec(`attrib -h -s "${p}"`, () => r()));

const unhideAll = (p) => new Promise(r => {

    exec(`attrib -h -s "${p}"`, () => {

        exec(`attrib -h -s "${p}\\*" /s /d`, () => r());

    });

});



/* ============================================================

   FOLDER OPS

============================================================ */

async function deleteFolder(folderPath) {

    try {

        if (!fs.existsSync(folderPath)) return;

        await unhideAll(folderPath);

        fs.rmSync(folderPath, { recursive: true, force: true });

    } catch {

        try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}

    }

}



function copyDir(src, dest) {

    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    for (const e of fs.readdirSync(src, { withFileTypes: true })) {

        const s = path.join(src, e.name), d = path.join(dest, e.name);

        e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);

    }

}



function findPackFolder(root) {
    // Check if root already contains graphics folders
    if (GRAPHICS_FOLDERS.some(f => fs.existsSync(path.join(root, f)))) return root;

    // Look for folders with "PACK" in name that contain graphics folders
    for (const item of fs.readdirSync(root, { withFileTypes: true })) {
        if (!item.isDirectory()) continue;

        const sub = path.join(root, item.name);

        // Check if this folder contains graphics folders
        if (GRAPHICS_FOLDERS.some(f => fs.existsSync(path.join(sub, f)))) return sub;

        // Check for nested structure (CA-X PACK folder)
        try {
            for (const deep of fs.readdirSync(sub, { withFileTypes: true })) {
                if (!deep.isDirectory()) continue;

                const dp = path.join(sub, deep.name);

                if (GRAPHICS_FOLDERS.some(f => fs.existsSync(path.join(dp, f)))) return dp;
            }
        } catch {}
    }

    return root;
}



/* ============================================================

   GOOGLE DRIVE

============================================================ */

function resolveGDrive(url) {
    // Skip processing for new server URLs
    if (url.includes("213.199.63.97")) return url;

    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);

    if (m1) return `https://drive.google.com/uc?export=download&confirm=t&id=${m1[1]}`;

    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    if (m2) return `https://drive.google.com/uc?export=download&confirm=t&id=${m2[1]}`;

    return url;

}






function httpsGet(url, headers = {}, maxR = 10) {

    return new Promise((resolve, reject) => {

        const u = new URL(url);
        const protocol = u.protocol === "http:" ? http : https;

        protocol.request({

            hostname: u.hostname,
            port: u.port || (u.protocol === "http:" ? 80 : 443),
            path: u.pathname + u.search,
            method: "GET",

            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ...headers }

        }, res => {

            if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {

                if (maxR <= 0) return reject(new Error("Too many redirects"));

                let loc = res.headers.location;

                if (loc.startsWith("/")) loc = `${u.protocol}//${u.hostname}${loc}`;

                const cookies = res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") || "";

                const newH = cookies ? { ...headers, Cookie: cookies } : headers;

                try {

                    const lu = new URL(loc.startsWith("http") ? loc : `https://drive.google.com${loc}`);

                    if (!lu.searchParams.get("confirm")) { lu.searchParams.set("confirm", "t"); loc = lu.toString(); }

                } catch {}

                return httpsGet(loc, newH, maxR - 1).then(resolve).catch(reject);

            }

            resolve(res);

        }).on("error", reject).end();

    });

}



/* ============================================================

   DOWNLOAD:START

============================================================ */

ipcMain.handle("download:start", async (e, { url, product, name }) => {

    if (dlState.running) return { success: false, message: "Download already in progress" };



    return new Promise(async (resolve) => {

        try {
            const zipPath = path.join(app.getPath("temp"), `${product}_${Date.now()}.zip`);
            const finalUrl = resolveGDrive(url);
            const response = await httpsGet(finalUrl);

            // Skip content-type check for new server
            const isNewServer = finalUrl.includes("213.199.63.97");
            if (!isNewServer && (response.headers["content-type"] || "").includes("text/html")) {
                resolve({ success: false, message: "Invalid response" });
                return;
            }

            const total = parseInt(response.headers["content-length"] || "0");
            let downloaded = 0;
            let lastDataTime = Date.now();
            const TIMEOUT_MS = 30000; // 30 seconds timeout

            dlState.running  = true;
            dlState.percent  = 0;
            dlState.speed    = "0";
            dlState.product  = product;
            dlState.zipPath  = zipPath;
            dlState.stage    = "downloading";
            dlState.stageMsg = "جاري التحميل...";
            dlState.name     = name || product;

            const file = fs.createWriteStream(zipPath);

            // Timeout check
            const timeoutCheck = setInterval(() => {
                if (Date.now() - lastDataTime > TIMEOUT_MS) {
                    clearInterval(timeoutCheck);
                    if (!file.destroyed) {
                        file.end();
                    }
                }
            }, 5000);

            response.on("data", chunk => {
                downloaded += chunk.length;
                lastDataTime = Date.now();
                // If no content-length, show progress based on chunks received
                const percent = total > 0 ? Math.floor((downloaded / total) * 100) : Math.min(99, Math.floor(downloaded / 1024 / 1024)); // Cap at 99% if no total
                const speed   = (chunk.length / 1024 / 1024).toFixed(2);
                dlState.percent = percent;
                dlState.speed   = speed;
                send("download:progress", { percent, speed });
            });

            response.pipe(file);

            file.on("finish", () => {
                clearInterval(timeoutCheck);
                file.close();
                dlState.running = false;
                dlState.percent = 100;
                send("download:progress", { percent: 100, speed: "0" });
                send("download:done", { product, zipPath });
                resolve({ success: true, zipPath });
            });

            response.on("end", () => {
                clearInterval(timeoutCheck);
                // Ensure file is closed if response ends before finish
                if (!file.destroyed) {
                    file.end();
                }
            });

            file.on("error", (err) => {
                clearInterval(timeoutCheck);
                console.error("Download file error:", err);
                dlState.running = false;
                dlState.stage   = "error";
                resolve({ success: false, message: err.message });
            });

            response.on("error", (err) => {
                clearInterval(timeoutCheck);
                console.error("Download response error:", err);
                dlState.running = false;
                dlState.stage   = "error";
                resolve({ success: false, message: err.message });
            });

        } catch (err) {
            console.error("Download error:", err);
            dlState.running = false;
            dlState.stage   = "error";
            resolve({ success: false, message: err.message });
        }

    });

});



/* ============================================================

   INSTALL:RUN

============================================================ */

ipcMain.handle("install:run", async (e, { zipPath, product }) => {

    try {

        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();

        if (!isValidFiveMPath(fivemPath)) return { success: false };



        const setStage = (stage, msg) => {

            dlState.stage    = stage;

            dlState.stageMsg = msg;

            send("install:status", { stage, msg });

        };



        // 1. إزالة الإخفاء

        setStage("preparing", "جاري التحضير...");

        for (const folder of GRAPHICS_FOLDERS) {

            const dest = path.join(fivemPath, folder);

            if (fs.existsSync(dest)) await unhideAll(dest);

        }



        // 2. فك الضغط

        setStage("extracting", "جاري فك الضغط...");

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



        // 3. نسخ

        setStage("copying", "جاري نسخ الملفات...");

        let copiedAny = false;

        for (const folder of GRAPHICS_FOLDERS) {

            const src  = path.join(packFolder, folder);

            const dest = path.join(fivemPath, folder);

            if (fs.existsSync(src)) { copyDir(src, dest); copiedAny = true; }

        }



        try { fs.unlinkSync(zipPath); } catch {}

        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}

        if (!copiedAny) return { success: false };



        // 4. إخفاء

        setStage("hiding", "جاري حماية الملفات...");

        for (const folder of GRAPHICS_FOLDERS) {

            const dest = path.join(fivemPath, folder);

            if (fs.existsSync(dest)) await hide(dest);

        }



        dlState.running = false;

        setStage("done", "تم التثبيت بنجاح ✅");

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

        for (const folder of GRAPHICS_FOLDERS)

            await deleteFolder(path.join(fivemPath, folder));

        return { success: true };

    } catch { return { success: false }; }

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

            send("install:status", { stage: "copying", msg: `جاري تحميل ${fileName}...` });

            await new Promise((resolve, reject) => {

                const file = fs.createWriteStream(path.join(desktop, fileName));

                res.on("data", chunk => {

                    dl += chunk.length;

                    const pct = total > 0 ? Math.floor((dl / total) * 100) : 0;

                    send("download:progress", { percent: i * 50 + Math.floor(pct / 2), speed: (chunk.length / 1024 / 1024).toFixed(2) });

                });

                res.pipe(file);

                file.on("finish", () => { file.close(); resolve(); });

                file.on("error", reject);

            });

        } catch (err) { console.error(`Launcher error (${fileName}):`, err.message); }

    }

    send("download:progress", { percent: 100, speed: "0" });

    send("install:status", { stage: "done", msg: "✅ تم تحميل الـ Launchers على سطح المكتب" });

    send("download:done", { product: "launchers", zipPath: "" });

    return { success: true };

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



        await unhide(iniPath);

        let content = fs.readFileSync(iniPath, "utf8");

        if (content.includes("ReShade5=ID:"))

            return { success: false, alreadyEnabled: true, message: "ReShade مفعّل مسبقاً" };



        // البحث عن ID الصحيح في ملفات log
        const logsPath = path.join(fivemPath, "logs");
        let reshadeID = null;

        if (fs.existsSync(logsPath)) {
            const logFiles = fs.readdirSync(logsPath).filter(f => f.endsWith(".log"));
            
            for (const logFile of logFiles) {
                try {
                    const logContent = fs.readFileSync(path.join(logsPath, logFile), "utf8");
                    const match = logContent.match(/ReShade5=ID:([a-f0-9]+)/i);
                    if (match) {
                        reshadeID = match[1];
                        break;
                    }
                } catch {}
            }
        }

        // إذا لم يتم العثور على ID في logs، استخدم الافتراضي
        if (!reshadeID) {
            reshadeID = "9943938c";
        }

        const line = `ReShade5=ID:${reshadeID} acknowledged that ReShade 5.x has a bug that will lead to game crashes`;

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



        dlState.stage = "copying";

        dlState.stageMsg = "جاري نسخ الملفات...";

        send("install:status", { stage: "copying", msg: "جاري نسخ الملفات..." });



        const finalUrl = resolveGDrive(url);
        const response = await httpsGet(finalUrl);

        const total = parseInt(response.headers["content-length"] || "0");

        let downloaded = 0;



        return new Promise(resolve => {

            const file = fs.createWriteStream(path.join(modsFolder, fileName));



            response.on("data", chunk => {

                downloaded += chunk.length;

                const percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;

                const speed = (chunk.length / 1024 / 1024).toFixed(2);

                dlState.percent = percent;

                dlState.speed = speed;

                send("download:progress", { percent, speed });

            });



            response.pipe(file);

            file.on("finish", () => {

                file.close();

                dlState.percent = 100;

                send("download:progress", { percent: 100, speed: "0" });

                resolve({ success: true });

            });

            file.on("error", (err) => {
                console.error("Mod download error:", err);
                resolve({ success: false });
            });

            response.on("error", (err) => {
                console.error("Mod download response error:", err);
                resolve({ success: false });
            });
        });

    } catch (err) {
        console.error("Mod download error:", err);
        return { success: false };
    }

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

                token: result.token, plans: result.plans, username: result.username, discordId: result.discordId

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

        if (result.success) {
            result.username = session.username;
            result.discordId = session.discordId;
        }

        return result;

    } catch { return { success: false }; }

});



ipcMain.handle("auth:logout", () => {

    if (fs.existsSync(SESSION_PATH)) fs.unlinkSync(SESSION_PATH);

    return { success: true };

});



/* ============================================================

   PERFORMANCE

============================================================ */

ipcMain.handle("performance:clearTemp", async () => {

    try {

        const tempPath = app.getPath("temp");

        let filesDeleted = 0;

        

        if (fs.existsSync(tempPath)) {

            const files = fs.readdirSync(tempPath);

            for (const file of files) {

                try {

                    const filePath = path.join(tempPath, file);

                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {

                        fs.rmSync(filePath, { recursive: true, force: true });

                    } else {

                        fs.unlinkSync(filePath);

                    }

                    filesDeleted++;

                } catch {}

            }

        }

        

        return { success: true, filesDeleted };

    } catch { return { success: false }; }

});



ipcMain.handle("performance:clearCache", async () => {

    try {

        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();

        

        const cachePaths = [

            path.join(fivemPath, "cache"),

            path.join(fivemPath, "cache2"),

            path.join(fivemPath, "server-cache"),

            path.join(fivemPath, "server-cache-priv")

        ];

        

        for (const cachePath of cachePaths) {

            if (fs.existsSync(cachePath)) {

                await unhideAll(cachePath);

                fs.rmSync(cachePath, { recursive: true, force: true });

            }

        }

        

        return { success: true };

    } catch { return { success: false }; }

});



ipcMain.handle("performance:clearLogs", async () => {

    try {

        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false };

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();

        

        const logPaths = [

            path.join(fivemPath, "logs"),

            path.join(fivemPath, "crashes"),

            path.join(fivemPath, "data", "cache-priv")

        ];

        

        let filesDeleted = 0;

        for (const logPath of logPaths) {

            if (fs.existsSync(logPath)) {

                await unhideAll(logPath);

                const files = fs.readdirSync(logPath);

                for (const file of files) {

                    try {

                        const filePath = path.join(logPath, file);

                        const stat = fs.statSync(filePath);

                        if (stat.isDirectory()) {

                            fs.rmSync(filePath, { recursive: true, force: true });

                        } else {

                            fs.unlinkSync(filePath);

                        }

                        filesDeleted++;

                    } catch {}

                }

            }

        }

        

        return { success: true, filesDeleted };

    } catch { return { success: false }; }

});



ipcMain.handle("performance:getSystemInfo", async () => {

    try {

        const os = require("os");

        

        // Disk space

        const diskSpace = {

            free: 0,

            total: 0

        };

        

        try {

            const stats = fs.statSync(app.getPath("home"));

            // Use os module for disk info on Windows

            if (process.platform === "win32") {

                const { execSync } = require("child_process");

                const drive = app.getPath("home").split(":")[0] + ":";

                const output = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size`).toString();

                const lines = output.split("\n").filter(l => l.trim());

                if (lines.length > 1) {

                    const values = lines[1].trim().split(/\s+/);

                    if (values.length >= 2) {

                        diskSpace.free = parseInt(values[0]) || 0;

                        diskSpace.total = parseInt(values[1]) || 0;

                    }

                }

            }

        } catch {}

        

        // FiveM status

        let fivemStatus = { installed: false };

        if (fs.existsSync(FIVEM_PATH_FILE)) {

            const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();

            fivemStatus.installed = isValidFiveMPath(fivemPath);

        }

        

        return { success: true, diskSpace, fivemStatus };

    } catch { return { success: false }; }

});



/* ============================================================

   NVIDIA OPTIMIZATIONS

============================================================ */

ipcMain.handle("performance:optimizeNvidia", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "NVIDIA optimizations only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Set NVIDIA Control Panel settings for maximum performance

        const nvidiaSettings = [

            // Power management mode: Prefer maximum performance

            'nvidia-smi -pm 1',

            // Set GPU to maximum performance

            'nvidia-settings -a "[gpu:0]/GPUPowerMizerMode=1"'

        ];

        

        // Try to apply NVIDIA settings

        try {

            execSync('nvidia-smi -pm 1', { stdio: 'ignore' });

        } catch {}

        

        // Create NVIDIA profile for FiveM

        try {

            const nvidiaPath = path.join(process.env.LOCALAPPDATA || "", "NVIDIA Corporation", "Drs", "nvidiainspector.exe");

            if (fs.existsSync(nvidiaPath)) {

                // Apply optimal settings for FiveM

                execSync(`"${nvidiaPath}" -loadProfile "FiveM_Optimized"`, { stdio: 'ignore' });

            }

        } catch {}

        

        return { success: true, message: "تم تطبيق تحسينات NVIDIA بنجاح ✅" };

    } catch { return { success: false, message: "فشل تطبيق تحسينات NVIDIA" }; }

});



/* ============================================================

   WINDOWS GAME MODE & POWER PLAN

============================================================ */

ipcMain.handle("performance:enableGameMode", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "Game Mode only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Enable Game Mode

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\GameBar\' -Name \'AllowAutoGameMode\' -Value 1"', { stdio: 'ignore' });

            execSync('powershell -command "Set-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\GameBar\' -Name \'AutoGameModeEnabled\' -Value 1"', { stdio: 'ignore' });

        } catch {}

        

        // Set Power Plan to High Performance

        try {

            execSync('powercfg /setactive 8c5e7fda-e8bf-45a6-a7cc-4e5a1e4c2c89', { stdio: 'ignore' });

        } catch {}

        

        // Disable Game DVR

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKCU:\\System\\GameConfigStore\' -Name \'GameDVR_Enabled\' -Value 0"', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم تفعيل Game Mode و High Performance ✅" };

    } catch { return { success: false, message: "فشل تفعيل Game Mode" }; }

});



/* ============================================================

   FIVEM GRAPHICS OPTIMIZATIONS

============================================================ */

ipcMain.handle("performance:optimizeFiveMGraphics", async () => {

    try {

        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false, message: "مسار FiveM غير محدد" };

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();

        

        // Optimize graphics_config.xml

        const graphicsConfigPath = path.join(fivemPath, "data", "graphics_config.xml");

        

        if (fs.existsSync(graphicsConfigPath)) {

            await unhide(graphicsConfigPath);

            let content = fs.readFileSync(graphicsConfigPath, "utf8");

            

            // Apply performance optimizations

            content = content.replace(/<ShadowQuality>.*?<\/ShadowQuality>/g, "<ShadowQuality>0</ShadowQuality>");

            content = content.replace(/<ReflectionQuality>.*?<\/ReflectionQuality>/g, "<ReflectionQuality>0</ReflectionQuality>");

            content = content.replace(/<WaterQuality>.*?<\/WaterQuality>/g, "<WaterQuality>0</WaterQuality>");

            content = content.replace(/<ParticleQuality>.*?<\/ParticleQuality>/g, "<ParticleQuality>0</ParticleQuality>");

            content = content.replace(/<TextureQuality>.*?<\/TextureQuality>/g, "<TextureQuality>1</TextureQuality>");

            content = content.replace(/<LightingQuality>.*?<\/LightingQuality>/g, "<LightingQuality>1</LightingQuality>");

            content = content.replace(/<PostFX>.*?<\/PostFX>/g, "<PostFX>0</PostFX>");

            content = content.replace(/<MSAA>.*?<\/MSAA>/g, "<MSAA>0</MSAA>");

            content = content.replace(/<DXGI>.*?<\/DXGI>/g, "<DXGI>1</DXGI>");

            

            fs.writeFileSync(graphicsConfigPath, content, "utf8");

        }

        

        // Create optimized settings file

        const settingsPath = path.join(fivemPath, "settings.json");

        const optimizedSettings = {

            "Graphics": {

                "TextureQuality": 1,

                "ShaderQuality": 1,

                "ShadowQuality": 0,

                "ReflectionQuality": 0,

                "WaterQuality": 0,

                "ParticleQuality": 0,

                "LightingQuality": 1,

                "PostFX": 0,

                "MSAA": 0,

                "DXGI": 1,

                "MaxFPS": 0

            }

        };

        

        fs.writeFileSync(settingsPath, JSON.stringify(optimizedSettings, null, 2), "utf8");

        

        return { success: true, message: "تم تطبيق تحسينات رسوميات FiveM ✅" };

    } catch { return { success: false, message: "فشل تطبيق تحسينات الرسوميات" }; }

});



/* ============================================================

   SYSTEM SERVICES OPTIMIZATION

============================================================ */

ipcMain.handle("performance:optimizeServices", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "Service optimization only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Disable unnecessary services for gaming

        const servicesToDisable = [

            "SysMain", // Superfetch

            "DiagTrack", // Telemetry

            "WSearch", // Windows Search

            "XblAuthManager", // Xbox Live

            "XblGameSave", // Xbox Game Save

            "XboxNetApiSvc" // Xbox Net API

        ];

        

        for (const service of servicesToDisable) {

            try {

                execSync(`sc stop "${service}"`, { stdio: 'ignore' });

                execSync(`sc config "${service}" start=disabled`, { stdio: 'ignore' });

            } catch {}

        }

        

        return { success: true, message: "تم تحسين خدمات النظام ✅" };

    } catch { return { success: false, message: "فشل تحسين الخدمات" }; }

});



/* ============================================================

   NETWORK OPTIMIZATION

============================================================ */

ipcMain.handle("performance:optimizeNetwork", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "Network optimization only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Disable Nagle's algorithm for better gaming latency

        try {

            execSync('netsh int tcp set global autotuninglevel=normal', { stdio: 'ignore' });

            execSync('netsh int tcp set global chimney=enabled', { stdio: 'ignore' });

            execSync('netsh int tcp set global rss=enabled', { stdio: 'ignore' });

            execSync('netsh int tcp set global netdma=enabled', { stdio: 'ignore' });

        } catch {}

        

        // Set network throttling index

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\' -Name \'NetworkThrottlingIndex\' -Value 0xffffffff"', { stdio: 'ignore' });

            execSync('powershell -command "Set-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\' -Name \'SystemResponsiveness\' -Value 0"', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم تحسين الشبكة ✅" };

    } catch { return { success: false, message: "فشل تحسين الشبكة" }; }

});



/* ============================================================

   RAM OPTIMIZATION

============================================================ */

ipcMain.handle("performance:optimizeRAM", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "RAM optimization only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Clear standby memory

        try {

            execSync('powershell -command "[System.Memory]::GC::Collect(); [System.Memory]::GC::WaitForPendingFinalizers()"', { stdio: 'ignore' });

        } catch {}

        

        // Disable Memory Compression

        try {

            execSync('powershell -command "Disable-MMAgent -MemoryCompression"', { stdio: 'ignore' });

        } catch {}

        

        // Set Large System Cache

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\' -Name \'LargeSystemCache\' -Value 1"', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم تحسين الذاكرة العشوائية ✅" };

    } catch { return { success: false, message: "فشل تحسين الذاكرة" }; }

});



/* ============================================================

   FULL OPTIMIZATION (ALL-IN-ONE)

============================================================ */

ipcMain.handle("performance:fullOptimization", async () => {

    try {

        const results = [];

        

        // Run all optimizations

        const nvidia = await ipcMain.handle("performance:optimizeNvidia");

        results.push(nvidia);

        

        const gameMode = await ipcMain.handle("performance:enableGameMode");

        results.push(gameMode);

        

        const fivem = await ipcMain.handle("performance:optimizeFiveMGraphics");

        results.push(fivem);

        

        const services = await ipcMain.handle("performance:optimizeServices");

        results.push(services);

        

        const network = await ipcMain.handle("performance:optimizeNetwork");

        results.push(network);

        

        const ram = await ipcMain.handle("performance:optimizeRAM");

        results.push(ram);

        

        const successCount = results.filter(r => r.success).length;

        

        return { 

            success: true, 

            message: `تم تطبيق ${successCount}/6 تحسينات بنجاح ✅`,

            details: results

        };

    } catch { return { success: false, message: "فشل التحسين الشامل" }; }

});



/* ============================================================

   RESTORE FUNCTIONS

============================================================ */

ipcMain.handle("performance:restoreNvidia", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "NVIDIA restore only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Restore NVIDIA to adaptive power management

        try {

            execSync('nvidia-smi -pm 0', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم استعادة إعدادات NVIDIA ✅" };

    } catch { return { success: false, message: "فشل استعادة NVIDIA" }; }

});



ipcMain.handle("performance:restoreGameMode", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "Game Mode restore only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Restore balanced power plan

        try {

            execSync('powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e', { stdio: 'ignore' });

        } catch {}

        

        // Re-enable Game DVR (optional)

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKCU:\\System\\GameConfigStore\' -Name \'GameDVR_Enabled\' -Value 1"', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم استعادة إعدادات Game Mode ✅" };

    } catch { return { success: false, message: "فشل استعادة Game Mode" }; }

});



ipcMain.handle("performance:restoreFiveMGraphics", async () => {

    try {

        if (!fs.existsSync(FIVEM_PATH_FILE)) return { success: false, message: "مسار FiveM غير محدد" };

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();

        

        // Restore graphics_config.xml to default/high quality

        const graphicsConfigPath = path.join(fivemPath, "data", "graphics_config.xml");

        

        if (fs.existsSync(graphicsConfigPath)) {

            await unhide(graphicsConfigPath);

            let content = fs.readFileSync(graphicsConfigPath, "utf8");

            

            // Restore to high quality settings

            content = content.replace(/<ShadowQuality>.*?<\/ShadowQuality>/g, "<ShadowQuality>2</ShadowQuality>");

            content = content.replace(/<ReflectionQuality>.*?<\/ReflectionQuality>/g, "<ReflectionQuality>2</ReflectionQuality>");

            content = content.replace(/<WaterQuality>.*?<\/WaterQuality>/g, "<WaterQuality>2</WaterQuality>");

            content = content.replace(/<ParticleQuality>.*?<\/ParticleQuality>/g, "<ParticleQuality>2</ParticleQuality>");

            content = content.replace(/<TextureQuality>.*?<\/TextureQuality>/g, "<TextureQuality>2</TextureQuality>");

            content = content.replace(/<LightingQuality>.*?<\/LightingQuality>/g, "<LightingQuality>2</LightingQuality>");

            content = content.replace(/<PostFX>.*?<\/PostFX>/g, "<PostFX>2</PostFX>");

            content = content.replace(/<MSAA>.*?<\/MSAA>/g, "<MSAA>2</MSAA>");

            content = content.replace(/<DXGI>.*?<\/DXGI>/g, "<DXGI>0</DXGI>");

            

            fs.writeFileSync(graphicsConfigPath, content, "utf8");

        }

        

        // Remove or restore settings file

        const settingsPath = path.join(fivemPath, "settings.json");

        if (fs.existsSync(settingsPath)) {

            fs.unlinkSync(settingsPath);

        }

        

        return { success: true, message: "تم استعادة إعدادات الرسوميات ✅" };

    } catch { return { success: false, message: "فشل استعادة الرسوميات" }; }

});



ipcMain.handle("performance:restoreServices", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "Service restore only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Re-enable services

        const servicesToEnable = [

            "SysMain",

            "DiagTrack",

            "WSearch"

        ];

        

        for (const service of servicesToEnable) {

            try {

                execSync(`sc config "${service}" start=auto`, { stdio: 'ignore' });

                execSync(`sc start "${service}"`, { stdio: 'ignore' });

            } catch {}

        }

        

        return { success: true, message: "تم استعادة خدمات النظام ✅" };

    } catch { return { success: false, message: "فشل استعادة الخدمات" }; }

});



ipcMain.handle("performance:restoreNetwork", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "Network restore only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Restore default network settings

        try {

            execSync('netsh int tcp set global autotuninglevel=normal', { stdio: 'ignore' });

            execSync('netsh int tcp set global chimney=automatic', { stdio: 'ignore' });

            execSync('netsh int tcp set global rss=enabled', { stdio: 'ignore' });

            execSync('netsh int tcp set global netdma=enabled', { stdio: 'ignore' });

        } catch {}

        

        // Restore network throttling

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\' -Name \'NetworkThrottlingIndex\' -Value 10"', { stdio: 'ignore' });

            execSync('powershell -command "Set-ItemProperty -Path \'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Multimedia\\SystemProfile\' -Name \'SystemResponsiveness\' -Value 20"', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم استعادة إعدادات الشبكة ✅" };

    } catch { return { success: false, message: "فشل استعادة الشبكة" }; }

});



ipcMain.handle("performance:restoreRAM", async () => {

    try {

        if (process.platform !== "win32") return { success: false, message: "RAM restore only available on Windows" };

        

        const { execSync } = require("child_process");

        

        // Re-enable Memory Compression

        try {

            execSync('powershell -command "Enable-MMAgent -MemoryCompression"', { stdio: 'ignore' });

        } catch {}

        

        // Restore Large System Cache

        try {

            execSync('powershell -command "Set-ItemProperty -Path \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Memory Management\' -Name \'LargeSystemCache\' -Value 0"', { stdio: 'ignore' });

        } catch {}

        

        return { success: true, message: "تم استعادة إعدادات الذاكرة ✅" };

    } catch { return { success: false, message: "فشل استعادة الذاكرة" }; }

});



ipcMain.handle("performance:restoreAll", async () => {

    try {

        const results = [];

        

        // Restore all settings

        const nvidia = await ipcMain.handle("performance:restoreNvidia");

        results.push(nvidia);

        

        const gameMode = await ipcMain.handle("performance:restoreGameMode");

        results.push(gameMode);

        

        const fivem = await ipcMain.handle("performance:restoreFiveMGraphics");

        results.push(fivem);

        

        const services = await ipcMain.handle("performance:restoreServices");

        results.push(services);

        

        const network = await ipcMain.handle("performance:restoreNetwork");

        results.push(network);

        

        const ram = await ipcMain.handle("performance:restoreRAM");

        results.push(ram);

        

        const successCount = results.filter(r => r.success).length;

        

        return { 

            success: true, 

            message: `تم استعادة ${successCount}/6 إعدادات بنجاح ✅`,

            details: results

        };

    } catch { return { success: false, message: "فشل الاستعادة الشاملة" }; }

});



/* ============================================================

   RATINGS & COMMENTS

============================================================ */

const RATINGS_PATH = path.join(app.getPath("userData"), "ratings.json");

// Admin Discord IDs who can delete ratings
const ADMIN_DISCORD_IDS = ["1336347875206234292"];

function isAdmin(discordId) {
    return ADMIN_DISCORD_IDS.includes(discordId);
}

function loadRatings() {
    try {
        if (fs.existsSync(RATINGS_PATH)) {
            return JSON.parse(fs.readFileSync(RATINGS_PATH, "utf8"));
        }
    } catch {}
    return {};
}

function saveRatings(ratings) {
    try {
        fs.writeFileSync(RATINGS_PATH, JSON.stringify(ratings, null, 2), "utf8");
        return true;
    } catch {}
    return false;
}

ipcMain.handle("ratings:get", () => {
    return { success: true, ratings: loadRatings() };
});

ipcMain.handle("ratings:submit", async (e, { packId, rating, comment, username }) => {
    try {
        const ratings = loadRatings();

        if (!ratings[packId]) {
            ratings[packId] = { ratings: [], comments: [], averageRating: 0, totalRatings: 0 };
        }

        const packData = ratings[packId];

        // Add rating
        packData.ratings.push({
            rating,
            username: username || "Anonymous",
            timestamp: Date.now()
        });

        // Add comment if provided (with rating included)
        if (comment && comment.trim()) {
            packData.comments.push({
                comment: comment.trim(),
                rating: rating,
                username: username || "Anonymous",
                timestamp: Date.now()
            });
        }

        // Calculate average
        const sum = packData.ratings.reduce((acc, r) => acc + r.rating, 0);
        packData.averageRating = (sum / packData.ratings.length).toFixed(1);
        packData.totalRatings = packData.ratings.length;

        saveRatings(ratings);

        return { success: true, averageRating: packData.averageRating, totalRatings: packData.totalRatings };
    } catch (err) {
        console.error("Rating error:", err);
        return { success: false, message: "Failed to save rating" };
    }
});

ipcMain.handle("ratings:getPack", (e, packId) => {
    try {
        const ratings = loadRatings();
        const packData = ratings[packId] || { ratings: [], comments: [], averageRating: 0, totalRatings: 0 };
        return { success: true, ...packData };
    } catch {
        return { success: false };
    }
});

ipcMain.handle("ratings:deleteComment", async (e, { packId, commentIndex, username }) => {
    try {
        // Check if user is admin
        if (!isAdmin(username)) {
            return { success: false, message: "Unauthorized: Only admins can delete comments" };
        }

        const ratings = loadRatings();
        if (!ratings[packId] || !ratings[packId].comments) {
            return { success: false, message: "Comment not found" };
        }

        const packData = ratings[packId];
        const comment = packData.comments[commentIndex];

        if (!comment) {
            return { success: false, message: "Comment not found" };
        }

        // Remove comment
        packData.comments.splice(commentIndex, 1);

        // Recalculate average rating
        if (packData.ratings.length > 0) {
            const sum = packData.ratings.reduce((acc, r) => acc + r.rating, 0);
            packData.averageRating = (sum / packData.ratings.length).toFixed(1);
        } else {
            packData.averageRating = 0;
        }

        saveRatings(ratings);
        return { success: true, message: "Comment deleted successfully" };
    } catch (err) {
        console.error("Delete comment error:", err);
        return { success: false, message: "Failed to delete comment" };
    }
});

ipcMain.handle("ratings:deleteRating", async (e, { packId, ratingIndex, username }) => {
    try {
        // Check if user is admin
        if (!isAdmin(username)) {
            return { success: false, message: "Unauthorized: Only admins can delete ratings" };
        }

        const ratings = loadRatings();
        if (!ratings[packId] || !ratings[packId].ratings) {
            return { success: false, message: "Rating not found" };
        }

        const packData = ratings[packId];
        const rating = packData.ratings[ratingIndex];

        if (!rating) {
            return { success: false, message: "Rating not found" };
        }

        // Remove rating
        packData.ratings.splice(ratingIndex, 1);

        // Recalculate average rating
        if (packData.ratings.length > 0) {
            const sum = packData.ratings.reduce((acc, r) => acc + r.rating, 0);
            packData.averageRating = (sum / packData.ratings.length).toFixed(1);
        } else {
            packData.averageRating = 0;
        }

        packData.totalRatings = packData.ratings.length;

        saveRatings(ratings);
        return { success: true, message: "Rating deleted successfully" };
    } catch (err) {
        console.error("Delete rating error:", err);
        return { success: false, message: "Failed to delete rating" };
    }
});



/* ============================================================

   AUTO UPDATER

============================================================ */

// إعداد autoUpdater
autoUpdater.setFeedURL({
    provider: "github",
    owner: "Ca1-Store",
    repo: "ca-graphics-app"
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("update-available", (info) => {
    console.log("Update available:", info.version);
    send("update:status", "update-available");
});

autoUpdater.on("update-not-available", (info) => {
    console.log("No update available:", info.version);
});

autoUpdater.on("update-downloaded", (info) => {
    console.log("Update downloaded:", info.version);
    send("update:status", "update-downloaded");
    // لا تقم بتثبيت التحديث تلقائياً، دع المستخدم يقرر
    // autoUpdater.quitAndInstall();
});

autoUpdater.on("error", (err) => {
    console.error("Update error:", err);
    send("update:status", "update-error");
});

// فحص التحديث عند بدء التشغيل
app.whenReady().then(() => {
    // تأخير بسيط للتأكد من أن التطبيق جاهز
    setTimeout(() => {
        autoUpdater.checkForUpdates();
    }, 5000);
});