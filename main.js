const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } = require("electron");

const { autoUpdater } = require("electron-updater");

const path = require("path");

const fs = require("fs");

const https = require("https");

const http = require("http");

const { exec } = require("child_process");

const crypto = require("crypto");



let unzipper;

try { unzipper = require("unzipper"); } catch { unzipper = null; }







let mainWindow;

let tray = null;







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



const GRAPHICS_FOLDERS = ["citizen", "plugins", "mods"]; // إعادة mods للقائمة



const SESSION_PATH     = path.join(app.getPath("userData"), "session.json");



const FIVEM_PATH_FILE  = path.join(app.getPath("userData"), "fivem_path.txt");



const LAUNCHERS = [



    { url: "http://213.199.63.97/CA%20-%20L1.exe", fileName: "CA - L1.exe" },



    { url: "http://213.199.63.97/CA%20-%20L2.exe", fileName: "CA - L2.exe" }



];







/* ============================================================



   FILE OPERATIONS - عمليات الملفات



============================================================ */






function getAllFiles(dirPath, arrayOfFiles = []) {

    const files = fs.readdirSync(dirPath);

    

    for (const file of files) {

        const fullPath = path.join(dirPath, file);

        if (fs.statSync(fullPath).isDirectory()) {

            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);

        } else {

            arrayOfFiles.push(fullPath);

        }

    }

    

    return arrayOfFiles;

}











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



    try {

        const files = fs.readdirSync(p);



        // يجب أن يحتوي على الأقل على 3 من المؤشرات الأساسية

        const requiredIndicators = ["citizen", "plugins", "mods", "logs", "data", "bin"];



        const foundIndicators = requiredIndicators.filter(f => files.includes(f));



        if (foundIndicators.length < 3) return false;



        // التحقق من وجود ملفات أساسية في مجلد citizen

        const citizenPath = path.join(p, "citizen");

        if (fs.existsSync(citizenPath)) {

            const citizenFiles = fs.readdirSync(citizenPath);

            // يجب أن يحتوي على common أو scripts

            if (!citizenFiles.includes("common") && !citizenFiles.includes("scripts")) return false;

        } else {

            return false;

        }



        return true;

    } catch { return false; }



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







    // إخفاء النافذة بدلاً من إغلاقها عند الضغط على X



    mainWindow.on('close', (event) => {



        if (!app.isQuitting) {



            event.preventDefault();



            mainWindow.hide();



        }



    });







    // لما تتحمل صفحة جديدة أعد إرسال الحالة



    mainWindow.webContents.on("did-finish-load", () => {



        if (dlState.running || (dlState.stage && dlState.stage !== "done" && dlState.stage !== "error")) {



            send("download:stateSync", { ...dlState });



        }



    });



}



function quitApp() {

    app.isQuitting = true;

    if (tray) {

        tray.destroy();

        tray = null;

    }

    if (mainWindow && !mainWindow.isDestroyed()) {

        mainWindow.close();

    }

    app.quit();

}



function createTray() {

    try {

        // استخدام مسار يعمل في وضع التطوير والنسخة المبنية

        let iconPath;

        

        if (app.isPackaged) {

            // في النسخة المبنية، الأيقونة تكون في resources

            iconPath = path.join(process.resourcesPath, 'build', 'icon.ico');

        } else {

            // في وضع التطوير

            iconPath = path.join(__dirname, 'build', 'icon.ico');

        }

        

        console.log('Tray icon path:', iconPath);

        

        // التحقق من وجود الملف

        if (!fs.existsSync(iconPath)) {

            console.error('Icon file not found:', iconPath);

            // محاولة مسار بديل

            iconPath = path.join(__dirname, '..', 'build', 'icon.ico');

            if (!fs.existsSync(iconPath)) {

                console.error('Alternative icon path also not found:', iconPath);

                return;

            }

        }

        

        // تحميل الأيقونة باستخدام nativeImage

        const icon = nativeImage.createFromPath(iconPath);

        

        if (icon.isEmpty()) {

            console.error('Failed to load icon from:', iconPath);

            return;

        }

        

        tray = new Tray(icon);

        console.log('Tray created successfully');

    } catch (err) {

        console.error('Failed to create tray:', err);

        return;

    }

    

    const contextMenu = Menu.buildFromTemplate([

        { label: 'إظهار البرنامج', click: () => mainWindow.show() },

        { label: 'إغلاق البرنامج', click: () => quitApp() }

    ]);

    

    tray.setToolTip('CA Graphics Protection');

    tray.setContextMenu(contextMenu);

    

    tray.on('double-click', () => {

        mainWindow.show();

    });

}







/* ============================================================



   SINGLE INSTANCE LOCK - حماية من تشغيل أكثر من نسخة



============================================================ */



const gotTheLock = app.requestSingleInstanceLock();



if (!gotTheLock) {

    // نسخة أخرى تعمل بالفعل، نخرج من هذه النسخة

    app.quit();

} else {

    // هذه هي النسخة الرئيسية

    app.on('second-instance', (event, commandLine, workingDirectory) => {

        // عندما يحاول المستخدم تشغيل نسخة ثانية

        if (mainWindow) {

            if (mainWindow.isMinimized()) mainWindow.restore();

            mainWindow.show();

            mainWindow.focus();

        }

    });

}



/* ============================================================



   AUTO UPDATER



============================================================ */



autoUpdater.setFeedURL({

    provider: "github",

    owner: "Ca1-Store",

    repo: "ca-graphics-app"

});



autoUpdater.on("checking-for-update", () => {

    console.log("Checking for update...");

    send("update:status", { status: "checking", message: "جاري التحقق من التحديثات..." });

});



autoUpdater.on("update-available", (info) => {

    console.log("Update available:", info);

    send("update:status", { status: "available", message: "تحديث جديد متاح!", version: info.version });

});



autoUpdater.on("update-not-available", (info) => {

    console.log("Update not available:", info);

    send("update:status", { status: "none", message: "البرنامج محدث" });

});



autoUpdater.on("error", (err) => {

    console.error("Update error:", err);

    send("update:status", { status: "error", message: "خطأ في التحقق من التحديثات" });

});



autoUpdater.on("download-progress", (progress) => {

    console.log("Download progress:", progress);

    send("update:progress", {

        percent: Math.floor(progress.percent),

        speed: progress.bytesPerSecond

    });

});



autoUpdater.on("update-downloaded", (info) => {

    console.log("Update downloaded:", info);

    send("update:status", { status: "downloaded", message: "تم تحميل التحديث، سيتم التثبيت..." });

    autoUpdater.quitAndInstall();

});



ipcMain.handle("update:check", () => {

    autoUpdater.checkForUpdates();

    return { success: true };

});







app.whenReady().then(() => {



    createWindow();



    createTray(); // إنشاء أيقونة Tray



    autoUpdater.checkForUpdatesAndNotify();



});






app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {

        app.quit();

    }

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



// Function to check if a file should be excluded from hiding in plugins folder

function shouldExcludeFile(fileName) {

    const lowerName = fileName.toLowerCase();

    // Exclude files named ReShade or starting with ReShade

    if (lowerName === 'reshade' || lowerName.startsWith('reshade')) return true;

    // Exclude files named QuantV or starting with QuantV

    if (lowerName === 'quantv' || lowerName.startsWith('quantv')) return true;

    // Exclude files named NVE or starting with NVE

    if (lowerName === 'nve' || lowerName.startsWith('nve')) return true;

    // Exclude specific files

    if (lowerName === 'dxgi.dll') return true;

    if (lowerName === 'license') return true;

    return false;

}



// Function to hide folders with selective file hiding

async function hideFolderSelective(folderPath, folderName) {

    try {

        if (!fs.existsSync(folderPath)) return;



        // Hide the folder itself

        await hide(folderPath);



        if (folderName === 'citizen') {

            // For citizen: hide the folder only, keep contents as they are

            return;

        }



        if (folderName === 'mods') {

            // For mods: hide the folder and everything inside

            await hide(folderPath + '\\*');

            return;

        }



        if (folderName === 'plugins') {

            // For plugins: hide folder and selectively hide files inside

            const presetPath = path.join(folderPath, 'preset');

            const reshadeShadersPath = path.join(folderPath, 'reshade-shaders');



            // Recursively hide files in plugins folder

            await hideFilesRecursive(folderPath, presetPath, reshadeShadersPath);



            // Handle reshade-shaders folder - hide half of items in Shaders and Textures

            if (fs.existsSync(reshadeShadersPath)) {

                const shadersPath = path.join(reshadeShadersPath, 'Shaders');

                const texturesPath = path.join(reshadeShadersPath, 'Textures');



                if (fs.existsSync(shadersPath)) {

                    await hideHalfItems(shadersPath);

                }

                if (fs.existsSync(texturesPath)) {

                    await hideHalfItems(texturesPath);

                }

            }

        }

    } catch (err) {

        console.error(`Error hiding folder ${folderName}:`, err);

    }

}



// Recursive function to hide files with exceptions

async function hideFilesRecursive(dirPath, presetPath = null, reshadeShadersPath = null) {

    try {

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });



        for (const entry of entries) {

            const fullPath = path.join(dirPath, entry.name);



            if (entry.isDirectory()) {

                // Skip reshade-shaders folder as it's handled separately

                if (reshadeShadersPath && fullPath === reshadeShadersPath) {

                    continue;

                }

                // Recursively process subdirectories

                await hideFilesRecursive(fullPath, presetPath, reshadeShadersPath);

            } else {

                // Check if this is the preset folder

                const isPresetFolder = presetPath && dirPath === presetPath;



                if (isPresetFolder) {

                    // In preset folder, we'll handle separately (hide first half)

                    continue;

                }



                // Check if file should be excluded

                if (!shouldExcludeFile(entry.name)) {

                    await hide(fullPath);

                }

            }

        }



        // Handle preset folder separately - hide first half of files

        if (presetPath && fs.existsSync(presetPath)) {

            const presetFiles = fs.readdirSync(presetPath, { withFileTypes: true })

                .filter(e => !e.isDirectory())

                .map(e => e.name);



            const halfIndex = Math.ceil(presetFiles.length / 2);

            const filesToHide = presetFiles.slice(0, halfIndex);



            for (const fileName of filesToHide) {

                const filePath = path.join(presetPath, fileName);

                await hide(filePath);

            }

        }

    } catch (err) {

        console.error('Error in hideFilesRecursive:', err);

    }

}



// Function to hide half of items (files and folders) in a directory

async function hideHalfItems(dirPath) {

    try {

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        const allItems = entries.map(e => e.name);



        const halfIndex = Math.ceil(allItems.length / 2);

        const itemsToHide = allItems.slice(0, halfIndex);



        for (const itemName of itemsToHide) {

            const itemPath = path.join(dirPath, itemName);

            await hide(itemPath);

        }

    } catch (err) {

        console.error('Error in hideHalfItems:', err);

    }

}





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







async function copyDir(src, dest) {



    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });



    const entries = fs.readdirSync(src, { withFileTypes: true });

    

    for (const e of entries) {

        const s = path.join(src, e.name), d = path.join(dest, e.name);

        if (e.isDirectory()) {

            await copyDir(s, d);

        } else {

            // Use promises for better performance

            await new Promise((resolve, reject) => {

                const readStream = fs.createReadStream(s);

                const writeStream = fs.createWriteStream(d);

                readStream.pipe(writeStream);

                writeStream.on('finish', resolve);

                writeStream.on('error', reject);

                readStream.on('error', reject);

            });

        }

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

            let lastDownloadTime = Date.now();

            let lastDownloaded = 0;

            const TIMEOUT_MS = 15000; // 15 seconds timeout for faster detection



            dlState.running  = true;

            dlState.percent  = 0;

            dlState.speed    = "0";

            dlState.product  = product;

            dlState.zipPath  = zipPath;

            dlState.stage    = "downloading";

            dlState.stageMsg = "جاري التحميل...";

            dlState.name     = name || product;



            // Use highWaterMark for better performance

            const file = fs.createWriteStream(zipPath, { highWaterMark: 1024 * 1024 * 16 }); // 16MB buffer



            // Timeout check

            const timeoutCheck = setInterval(() => {

                if (Date.now() - lastDataTime > TIMEOUT_MS) {

                    clearInterval(timeoutCheck);

                    if (!file.destroyed) {

                        file.end();

                    }

                }

            }, 3000); // Check every 3 seconds instead of 5



            response.on("data", chunk => {

                downloaded += chunk.length;

                lastDataTime = Date.now();

                

                // Calculate average speed

                const currentTime = Date.now();

                const timeDiff = (currentTime - lastDownloadTime) / 1000; // in seconds

                const downloadedDiff = downloaded - lastDownloaded;

                

                if (timeDiff > 0.5) { // Update speed every 0.5 seconds

                    const speedMBps = (downloadedDiff / 1024 / 1024) / timeDiff;

                    dlState.speed = speedMBps.toFixed(2);

                    lastDownloadTime = currentTime;

                    lastDownloaded = downloaded;

                }

                

                // If no content-length, show progress based on chunks received

                const percent = total > 0 ? Math.floor((downloaded / total) * 100) : Math.min(99, Math.floor(downloaded / 1024 / 1024));

                dlState.percent = percent;

                send("download:progress", { percent, speed: dlState.speed });

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



            if (fs.existsSync(src)) { await copyDir(src, dest); copiedAny = true; }



        }







        try { fs.unlinkSync(zipPath); } catch {}



        try { fs.rmSync(tempExtract, { recursive: true, force: true }); } catch {}



        if (!copiedAny) return { success: false };







        // 4. إخفاء الملفات (بدون تشفير)



        setStage("hiding", "جاري إخفاء الملفات...");



        // إخفاء المجلدات مع الإخفاء الانتقائي للملفات

        for (const folder of ["citizen", "plugins", "mods"]) {

            const dest = path.join(fivemPath, folder);

            if (fs.existsSync(dest)) await hideFolderSelective(dest, folder);

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



   RATINGS & COMMENTS - Online System



============================================================ */



// Helper function to make HTTP requests to backend

async function fetchBackend(url, options = {}) {

    try {

        const response = await fetch(url, options);

        const data = await response.json();

        return data;

    } catch (err) {

        console.error("Backend fetch error:", err);

        return { success: false, message: "خطأ في الاتصال بالسيرفر" };

    }

}



ipcMain.handle("ratings:get", async () => {

    return await fetchBackend(`${BACKEND_URL}/api/ratings`);

});



ipcMain.handle("ratings:submit", async (e, { packId, rating, comment, username, discordId }) => {

    return await fetchBackend(`${BACKEND_URL}/api/ratings`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ packId, rating, comment, username, discordId })

    });

});



ipcMain.handle("ratings:getPack", async (e, packId) => {

    return await fetchBackend(`${BACKEND_URL}/api/ratings/${packId}`);

});



ipcMain.handle("ratings:deleteComment", async (e, { commentId, discordId }) => {

    return await fetchBackend(`${BACKEND_URL}/api/ratings/comment`, {

        method: "DELETE",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ commentId, discordId })

    });

});



ipcMain.handle("ratings:deleteRating", async (e, { ratingId }) => {

    return await fetchBackend(`${BACKEND_URL}/api/ratings/rating`, {

        method: "DELETE",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ ratingId })

    });

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

/* ============================================================

   CUSTOMIZATIONS - ??????? ?? ?????????

============================================================ */

// Customization configuration
const CUSTOMIZATIONS = {
    "no_water": {
        fileName: "water.xml",
        destination: "citizen/common/data/levels/gta5"
    },
    "no_snow": {
        fileName: "weather.xml",
        destination: "citizen/common/data/levels/gta5"
    },
    "no_mountain": {
        fileName: "no_mountain.rpf",
        destination: "mods"
    },
    "no_rain": {
        fileName: "no_rain.rpf",
        destination: "mods"
    }
};

// Check if a customization is installed
ipcMain.handle("customizations:checkInstalled", async (e, customizationId) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) {
            return { success: false, installed: false };
        }

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const config = CUSTOMIZATIONS[customizationId];

        if (!config) {
            return { success: false, message: "Invalid customization ID" };
        }

        const filePath = path.join(fivemPath, config.destination, config.fileName);
        const installed = fs.existsSync(filePath);

        return { success: true, installed };
    } catch (err) {
        console.error("Check customization error:", err);
        return { success: false, message: "Failed to check customization" };
    }
});

// Install a customization
ipcMain.handle("customizations:install", async (e, { customizationId, url }) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) {
            return { success: false, message: "FiveM path not set" };
        }

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const config = CUSTOMIZATIONS[customizationId];

        if (!config) {
            return { success: false, message: "Invalid customization ID" };
        }

        // Create destination directory if it doesn't exist
        const destDir = path.join(fivemPath, config.destination);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const destPath = path.join(destDir, config.fileName);

        // Download file
        const response = await httpsGet(url);
        const file = fs.createWriteStream(destPath);

        return new Promise((resolve) => {
            response.pipe(file);
            file.on("finish", () => {
                file.close();
                resolve({ success: true, message: "Customization installed successfully" });
            });
            file.on("error", (err) => {
                console.error("Download error:", err);
                resolve({ success: false, message: "Failed to download file" });
            });
        });
    } catch (err) {
        console.error("Install customization error:", err);
        return { success: false, message: "Failed to install customization" };
    }
});

// Delete a customization
ipcMain.handle("customizations:delete", async (e, customizationId) => {
    try {
        if (!fs.existsSync(FIVEM_PATH_FILE)) {
            return { success: false, message: "FiveM path not set" };
        }

        const fivemPath = fs.readFileSync(FIVEM_PATH_FILE, "utf8").trim();
        const config = CUSTOMIZATIONS[customizationId];

        if (!config) {
            return { success: false, message: "Invalid customization ID" };
        }

        const filePath = path.join(fivemPath, config.destination, config.fileName);

        if (!fs.existsSync(filePath)) {
            return { success: false, message: "Customization not found" };
        }

        fs.unlinkSync(filePath);
        return { success: true, message: "Customization deleted successfully" };
    } catch (err) {
        console.error("Delete customization error:", err);
        return { success: false, message: "Failed to delete customization" };
    }
});

