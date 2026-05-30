const notify = document.getElementById("notify");

/* ============================================================
   NOTIFY
============================================================ */
function showNotify(msg, type = "success") {
    notify.textContent = msg;
    notify.className = `notification show ${type}`;
    clearTimeout(window.notifyTimeout);
    window.notifyTimeout = setTimeout(() => notify.classList.remove("show"), 2200);
}

/* ============================================================
   CLEAR TEMP FILES
============================================================ */
async function clearTempFiles() {
    try {
        const result = await window.api.clearTempFiles();
        if (result.success) {
            showNotify(`تم حذف ${result.filesDeleted || 0} ملف مؤقت`, "success");
        } else {
            showNotify("فشل حذف الملفات المؤقتة", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الحذف", "error");
    }
}

/* ============================================================
   CLEAR CACHE
============================================================ */
async function clearCache() {
    try {
        const result = await window.api.clearCache();
        if (result.success) {
            showNotify("تم حذف الكاش بنجاح", "success");
        } else {
            showNotify("فشل حذف الكاش", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الحذف", "error");
    }
}

/* ============================================================
   CLEAR LOGS
============================================================ */
async function clearLogs() {
    try {
        const result = await window.api.clearLogs();
        if (result.success) {
            showNotify(`تم حذف ${result.filesDeleted || 0} ملف سجل`, "success");
        } else {
            showNotify("فشل حذف ملفات السجلات", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الحذف", "error");
    }
}

/* ============================================================
   LOAD SYSTEM INFO
============================================================ */
async function loadSystemInfo() {
    try {
        const result = await window.api.getSystemInfo();
        
        if (result.diskSpace) {
            const diskSpaceEl = document.getElementById("diskSpace");
            const diskBadgeEl = document.getElementById("diskBadge");
            
            const freeGB = (result.diskSpace.free / (1024 * 1024 * 1024)).toFixed(1);
            const totalGB = (result.diskSpace.total / (1024 * 1024 * 1024)).toFixed(1);
            const usedPercent = ((1 - result.diskSpace.free / result.diskSpace.total) * 100).toFixed(0);
            
            diskSpaceEl.textContent = `${freeGB} GB free / ${totalGB} GB total`;
            
            if (usedPercent > 80) {
                diskBadgeEl.textContent = "Critical";
                diskBadgeEl.className = "status-badge warning";
            } else if (usedPercent > 60) {
                diskBadgeEl.textContent = "Warning";
                diskBadgeEl.className = "status-badge warning";
            } else {
                diskBadgeEl.textContent = "Good";
                diskBadgeEl.className = "status-badge";
            }
        }
        
        if (result.fivemStatus) {
            const fivemStatusEl = document.getElementById("fivemStatus");
            const fivemBadgeEl = document.getElementById("fivemBadge");
            
            if (result.fivemStatus.installed) {
                fivemStatusEl.textContent = "FiveM Installed";
                fivemBadgeEl.textContent = "Installed";
                fivemBadgeEl.className = "status-badge";
            } else {
                fivemStatusEl.textContent = "FiveM Not Found";
                fivemBadgeEl.textContent = "Not Found";
                fivemBadgeEl.className = "status-badge warning";
            }
        }
    } catch (err) {
        console.error(err);
    }
}

/* ============================================================
   INIT
============================================================ */
loadSystemInfo();
