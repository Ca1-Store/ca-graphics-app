const { app, BrowserWindow, ipcMain, dialog } = require("electron");
let userDataPath;
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const https = require("https");
const { exec } = require("child_process");

let unzipper;
try {
    unzipper = require("unzipper");
} catch (e) {
    console.log("⚠ unzipper غير موجود");
    unzipper = null;
}

let mainWindow;
let currentDownload = null;

const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";
const FIVEM_INDICATORS = ["citizen", "plugins", "mods", "logs", "data", "bin"];
const GRAPHICS_FOLDERS = ["citizen", "plugins", "mods"];

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
}    });
    mainWindow.loadFile(path.join(__dirname, "app", "index.html"));
}

app.whenReady().then(() => {
    userDataPath = app.getPath("userData");

    createWindow();
    autoUpdater.checkForUpdatesAndNotify();
});
/* ============================================================
   WINDOW CONTROLS
============================================================ */
ipcMain.handle("window:minimize", () => mainWindow.minimize());
ipcMain.handle("window:close", () => mainWindow.close());
ipcMain.handle("window:fullscreen", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
});

ipcMain.handle("open:page", (e, page) => {
    mainWindow.loadFile(path.join(__dirname, "app", page));
});

/* ============================================================
   VALIDATE FIVEM PATH
============================================================ */
function isValidFiveMPath(fivemPath) {
    try {
        const contents = fs.readdirSync(fivemPath);
        return FIVEM_INDICATORS.some(folder => contents.includes(folder));
    } catch { return false; }
}

ipcMain.handle("path:validate", (e, fivemPath) => {
    return { valid: isValidFiveMPath(fivemPath) };
});

ipcMain.handle("path:select", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    if (result.canceled) return { success: false };
    return { success: true, path: result.filePaths[0] };
});

ipcMain.handle("path:save", (e, fivemPath) => {
    try {
        fs.writeFileSync(path.join(userDataPath, "fivem_path.txt"), fivemPath);
        return { success: true };
    } catch { return { success: false }; }
});

ipcMain.handle("path:get", () => {
    try {
        const file = path.join(userDataPath, "fivem_path.txt");
        if (!fs.existsSync(file)) return { success: false };
        return { success: true, path: fs.readFileSync(file, "utf8") };
    } catch { return { success: false }; }
});

/* ============================================================
   HIDE / UNHIDE
============================================================ */
function hideItemWindows(itemPath) {
    return new Promise((resolve) => {
        exec(`attrib +h "${itemPath}"`, () => resolve());
    });
}

async function hideFolderAndContents(folderPath) {
    try {
        await hideItemWindows(folderPath);
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            await hideItemWindows(fullPath);
            if (entry.isDirectory()) await hideFolderAndContents(fullPath);
        }
    } catch {}
}

function unhideItemWindows(itemPath) {
    return new Promise((resolve) => {
        exec(`attrib -h -s "${itemPath}"`, () => resolve());
    });
}

async function unhideFolderAndContents(folderPath) {
    try {
        await unhideItemWindows(folderPath);
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            await unhideItemWindows(fullPath);
            if (entry.isDirectory()) await unhideFolderAndContents(fullPath);
        }
    } catch {}
}

/* ============================================================
   DELETE DIR - سريع بـ PowerShell
============================================================ */
async function deleteFolder(folderPath) {
    try {
        if (!fs.existsSync(folderPath)) return;
        await new Promise((resolve) => {
            exec(
                `powershell -command "Get-ChildItem -Path '${folderPath}' -Recurse -Force | ForEach-Object { $_.Attributes = 'Normal' }; (Get-Item '${folderPath}').Attributes = 'Normal'"`,
                () => resolve()
            );
        });
        fs.rmSync(folderPath, { recursive: true, force: true });
    } catch (err) {
        try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}
    }
}

/* ============================================================
   COPY DIR RECURSIVE
============================================================ */
function copyDirRecursive(src, dest) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
        else fs.copyFileSync(srcPath, destPath);
    }
}

/* ============================================================
   FIND PACK FOLDER
============================================================ */
function findPackFolder(extractPath) {
    const stack = [extractPath];

    while (stack.length) {
        const current = stack.pop();

        if (GRAPHICS_FOLDERS.some(f =>
            fs.existsSync(path.join(current, f))
        )) {
            return current;
        }

        try {
            const items = fs.readdirSync(current, { withFileTypes: true });
            for (const item of items) {
                if (item.isDirectory()) {
                    stack.push(path.join(current, item.name));
                }
            }
        } catch {}
    }

    return extractPath;
}
/* ============================================================
   GOOGLE DRIVE HELPER
============================================================ */
function resolveGoogleDriveUrl(url) {
    let fileId = null;
    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m1) fileId = m1[1];
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!fileId && m2) fileId = m2[1];
    if (fileId) return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
    return url;
}

function httpsGetWithRedirects(url, headers, maxRedirects = 10) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: "GET",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", ...headers }
        };
        const req = https.request(options, (res) => {
            if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
                if (maxRedirects <= 0) return reject(new Error("Too many redirects"));
                let redirectUrl = res.headers.location;
                if (redirectUrl.startsWith("/")) redirectUrl = `https://${parsedUrl.hostname}${redirectUrl}`;
                const cookies = res.headers["set-cookie"]?.map(c => c.split(";")[0]).join("; ") || "";
                const newHeaders = cookies ? { ...headers, Cookie: cookies } : headers;
                try {
                    const loc = new URL(redirectUrl.startsWith("http") ? redirectUrl : `https://drive.google.com${redirectUrl}`);
                    if (!loc.searchParams.get("confirm")) { loc.searchParams.set("confirm", "t"); redirectUrl = loc.toString(); }
                } catch {}
                return httpsGetWithRedirects(redirectUrl, newHeaders, maxRedirects - 1).then(resolve).catch(reject);
            }
            resolve(res);
        });
        req.on("error", reject);
        req.end();
    });
}

/* ============================================================
   DOWNLOAD START (جرافيكس / مودات)
============================================================ */
ipcMain.handle("download:start", async (e, { url, product }) => {
    if (currentDownload) return { success: false, message: "Download already in progress" };
    return new Promise(async (resolve) => {
        try {
            const zipPath = path.join(app.getPath("temp"), `${product}_${Date.now()}.zip`);
            const directUrl = resolveGoogleDriveUrl(url);
            const response = await httpsGetWithRedirects(directUrl, {});
            const contentType = response.headers["content-type"] || "";
            if (contentType.includes("text/html")) { currentDownload = null; resolve({ success: false }); return; }
            const total = parseInt(response.headers["content-length"] || "0");
            let downloaded = 0;
            currentDownload = response;
            const file = fs.createWriteStream(zipPath);
            response.on("data", (chunk) => {
                downloaded += chunk.length;
                const percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
                mainWindow.webContents.send("download:progress", { percent, speed: (chunk.length / 1024 / 1024).toFixed(2) });
            });
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                currentDownload = null;
                mainWindow.webContents.send("download:done", { product, zipPath });
                resolve({ success: true, zipPath });
            });
            file.on("error", () => { currentDownload = null; resolve({ success: false }); });
        } catch { currentDownload = null; resolve({ success: false }); }
    });
});

/* ============================================================
   DOWNLOAD LAUNCHERS
   - يحمّل الاثنين على سطح المكتب
   - يرسل progress لصفحة Downloads
============================================================ */
ipcMain.handle("download:launchers", async () => {
    const desktopPath = app.getPath("desktop");

    for (let i = 0; i < LAUNCHERS.length; i++) {
        const launcher = LAUNCHERS[i];
        try {
            const destPath = path.join(desktopPath, launcher.fileName);
            const response = await httpsGetWithRedirects(launcher.url, {});

            const total = parseInt(response.headers["content-length"] || "0");
            let downloaded = 0;

            // أرسل اسم الملف الحالي
            mainWindow.webContents.send("install:status", {
                stage: "copying",
                msg: `جاري تحميل ${launcher.fileName}...`
            });

            await new Promise((resolve, reject) => {
                const file = fs.createWriteStream(destPath);
                response.on("data", (chunk) => {
                    downloaded += chunk.length;
                    const percent = total > 0 ? Math.floor((downloaded / total) * 100) : 0;
                    // نرسل progress لكل launcher على حدة (0-50% للأول، 50-100% للثاني)
                    const basePercent = i * 50;
                    const scaledPercent = basePercent + Math.floor(percent / 2);
                    mainWindow.webContents.send("download:progress", {
                        percent: scaledPercent,
                        speed: (chunk.length / 1024 / 1024).toFixed(2)
                    });
                });
                response.pipe(file);
                file.on("finish", () => { file.close(); resolve(); });
                file.on("error", reject);
            });

        } catch (err) {
            console.error(`❌ Launcher download error (${launcher.fileName}):`, err.message);
        }
    }

    mainWindow.webContents.send("download:progress", { percent: 100, speed: "0" });
    mainWindow.webContents.send("install:status", { stage: "done", msg: "✅ تم تحميل الـ Launchers على سطح المكتب" });
    mainWindow.webContents.send("download:done", { product: "launchers", zipPath: "" });

    return { success: true };
});

/* ============================================================
   ATTRIB HELPER - يطبق الإخفاء على مجلد كامل بأمر واحد
============================================================ */
function attribHideFolder(folderPath) {
    return new Promise((resolve) => {
        // أخفِ المجلد نفسه
        exec(`attrib +h "${folderPath}"`, () => {
            // أخفِ كل ما بداخله بأمر واحد
            exec(`attrib +h "${folderPath}\\*" /s /d`, () => resolve());
        });
    });
}

// إزالة الإخفاء لأجل الاستبدال
function attribUnhideFolder(folderPath) {
    return new Promise((resolve) => {
        exec(`attrib -h -s "${folderPath}"`, () => {
            exec(`attrib -h -s "${folderPath}\\*" /s /d`, () => resolve());
        });
    });
}

/* ============================================================
   INSTALL PACK
   1. إزالة الإخفاء عن المجلدات القديمة (attrib -h)
   2. فك الضغط
   3. نسخ المجلدات (يستبدل القديمة)
   4. تطبيق الإخفاء (attrib +h)
============================================================ */
ipcMain.handle("install:run", async (e, { zipPath, product }) => {
    try {
        const fivemPathFile = path.join(userDataPath, "fivem_path.txt");
        if (!fs.existsSync(fivemPathFile)) return { success: false };
        const fivemPath = fs.readFileSync(fivemPathFile, "utf8").trim();
        if (!isValidFiveMPath(fivemPath)) return { success: false };

        // ── مرحلة 1: إزالة الإخفاء عن المجلدات الموجودة ──
        mainWindow.webContents.send("install:status", { stage: "preparing", msg: "جاري التحضير..." });

        for (const folder of GRAPHICS_FOLDERS) {
            const destFolder = path.join(fivemPath, folder);
            if (fs.existsSync(destFolder)) {
                await attribUnhideFolder(destFolder);
            }
        }

        // ── مرحلة 2: فك الضغط ──
        mainWindow.webContents.send("install:status", { stage: "extracting", msg: "جاري فك الضغط..." });
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

        // ── مرحلة 3: نسخ المجلدات (يستبدل القديمة) ──
        mainWindow.webContents.send("install:status", { stage: "copying", msg: "جاري نسخ الملفات..." });
        let copiedAny = false;

        for (const folder of GRAPHICS_FOLDERS) {
            const srcFolder = path.join(packFolder, folder);
            const destFolder = path.join(fivemPath, folder);
            if (fs.existsSync(srcFolder)) {
                copyDirRecursive(srcFolder, destFolder);
                copiedAny = true;
            }
        }

        // تنظيف الملفات المؤقتة
        try { fs.unlinkSync(zipPath); } catch {}
        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}

if (!copiedAny) {
    console.log("❌ No valid folders found in pack:", packFolder);
    return { success: false, message: "Invalid pack structure" };
}
        // ── مرحلة 4: إخفاء المجلدات بـ attrib +h ──
        mainWindow.webContents.send("install:status", { stage: "hiding", msg: "جاري حماية الملفات..." });

        for (const folder of GRAPHICS_FOLDERS) {
            const destFolder = path.join(fivemPath, folder);
            if (fs.existsSync(destFolder)) {
                await attribHideFolder(destFolder);
            }
        }

        mainWindow.webContents.send("install:status", { stage: "done", msg: "تم التثبيت بنجاح ✅" });
        return { success: true };

    } catch (err) {
        console.error("❌ Install error:", err);
        try { fs.unlinkSync(zipPath); } catch {}
        return { success: false };
    }
});

/* ============================================================
   DELETE GRAPHICS
============================================================ */
ipcMain.handle("graphics:delete", async () => {
    try {
        const fivemPathFile = path.join(userDataPath, "fivem_path.txt");
        if (!fs.existsSync(fivemPathFile)) return { success: false };
        const fivemPath = fs.readFileSync(fivemPathFile, "utf8").trim();
        for (const folder of GRAPHICS_FOLDERS) {
            await deleteFolder(path.join(fivemPath, folder));
        }
        return { success: true };
    } catch { return { success: false }; }
});

/* ============================================================
   RESHADE - بدون إخفاء CitizenFX.ini
============================================================ */
ipcMain.handle("reshade:enable", async () => {
    try {
        const fivemPathFile = path.join(userDataPath, "fivem_path.txt");
        if (!fs.existsSync(fivemPathFile)) return { success: false, message: "مسار FiveM غير محدد" };
        const fivemPath = fs.readFileSync(fivemPathFile, "utf8").trim();
        const iniPath = path.join(fivemPath, "CitizenFX.ini");
        if (!fs.existsSync(iniPath)) return { success: false, message: "ملف CitizenFX.ini غير موجود" };

        await unhideItemWindows(iniPath);
        let content = fs.readFileSync(iniPath, "utf8");

        if (content.includes("ReShade5=ID:")) {
            return { success: false, alreadyEnabled: true, message: "ReShade مفعّل مسبقاً" };
        }

        const reshadeId = "9943938c";
        const reshadeText = `ReShade5=ID:${reshadeId} acknowledged that ReShade 5.x has a bug that will lead to game crashes`;

        if (content.includes("[Addons]")) {
            content = content.replace("[Addons]", `[Addons]\n${reshadeText}`);
        } else {
            content += `\n[Addons]\n${reshadeText}\n`;
        }

        fs.writeFileSync(iniPath, content, "utf8");
        // ✅ لا نخفي CitizenFX.ini

        return { success: true, message: "تم تفعيل ReShade بنجاح ✅" };
    } catch (err) {
        return { success: false, message: "حدث خطأ أثناء التفعيل" };
    }
});

/* ============================================================
   MODS
============================================================ */
ipcMain.handle("mods:list", () => {
    try {
        const fivemPath = fs.readFileSync(path.join(userDataPath, "fivem_path.txt"), "utf8").trim();
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
        const fivemPath = fs.readFileSync(path.join(userDataPath, "fivem_path.txt"), "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) fs.mkdirSync(modsFolder, { recursive: true });
        const keepNames = new Set(files.map(f => path.basename(f)));
        fs.readdirSync(modsFolder).filter(f => f.endsWith(".rpf")).forEach(f => {
            if (!keepNames.has(f)) fs.unlinkSync(path.join(modsFolder, f));
        });
        files.forEach(file => {
            const isFullPath = file.includes("\\") || (file.includes("/") && !file.startsWith("./"));
            if (!isFullPath) return;
            const fileName = path.basename(file);
            const destPath = path.join(modsFolder, fileName);
            if (fs.existsSync(file) && file !== destPath) fs.copyFileSync(file, destPath);
        });
        return { success: true };
    } catch { return { success: false }; }
});

ipcMain.handle("mods:download", async (e, { url, fileName }) => {
    try {
        const directUrl = resolveGoogleDriveUrl(url);
        const fivemPath = fs.readFileSync(path.join(userDataPath, "fivem_path.txt"), "utf8").trim();
        const modsFolder = path.join(fivemPath, "mods");
        if (!fs.existsSync(modsFolder)) fs.mkdirSync(modsFolder, { recursive: true });
        const targetPath = path.join(modsFolder, fileName);
        const response = await httpsGetWithRedirects(directUrl, {});
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
            if (!code) return;
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
                fs.writeFileSync(path.join(userDataPath, "session.json"), JSON.stringify({
                    token: result.token, plans: result.plans, username: result.username
                }));
            }
            resolve(result);
}).listen(7842, () => {
    console.log("Auth server running on port 7842");
});    });
});

ipcMain.handle("auth:check", async () => {
    try {
        const sessionFile = path.join(userDataPath, "session.json");
        if (!fs.existsSync(sessionFile)) return { success: false };
        const session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
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
    const sessionFile = path.join(userDataPath, "session.json");
    if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
    return { success: true };
});
autoUpdater.on("update-available", () => {
    if (mainWindow) {
        mainWindow.webContents.send("update:status", "update-available");
    }
});

autoUpdater.on("update-downloaded", () => {
    if (mainWindow) {
        mainWindow.webContents.send("update:status", "update-downloaded");
    }
    autoUpdater.quitAndInstall();
});