const notify = document.getElementById("notify");
let currentConfirmAction = null;

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
   MODAL
============================================================ */
function openModal(title, description, details, action) {
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalDescription").textContent = description;
    
    const detailsList = document.getElementById("modalDetails");
    detailsList.innerHTML = details.map(d => `<li>${d}</li>`).join("");
    
    currentConfirmAction = action;
    document.getElementById("confirmModal").classList.add("show");
}

function closeModal() {
    document.getElementById("confirmModal").classList.remove("show");
    currentConfirmAction = null;
}

document.getElementById("modalConfirmBtn").onclick = () => {
    if (currentConfirmAction) {
        currentConfirmAction();
        closeModal();
    }
};

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

function confirmClearTempFiles() {
    openModal(
        "تأكيد حذف الملفات المؤقتة",
        "هل أنت متأكد من حذف جميع الملفات المؤقتة؟",
        [
            "حذف جميع الملفات في مجلد temp (%TEMP%)",
            "تحرير مساحة القرص",
            "قد يؤدي إلى تحسين أداء النظام",
            "الملفات المحذوفة غير قابلة للاستعادة"
        ],
        clearTempFiles
    );
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

function confirmClearCache() {
    openModal(
        "تأكيد حذف الكاش",
        "هل أنت متأكد من حذف كاش FiveM؟",
        [
            "حذف كاش FiveM في مجلد %LOCALAPPDATA%\\FiveM",
            "حذف ملفات الكاش المؤقتة",
            "قد يؤدي إلى تحسين أداء FiveM",
            "سيتم إعادة تحميل الموارد عند التشغيل التالي"
        ],
        clearCache
    );
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

function confirmClearLogs() {
    openModal(
        "تأكيد حذف ملفات السجلات",
        "هل أنت متأكد من حذف جميع ملفات السجلات؟",
        [
            "حذف ملفات السجلات في مجلد FiveM",
            "حذف ملفات .log و .txt",
            "تحرير مساحة القرص",
            "قد يؤدي إلى فقدان معلومات تصحيح الأخطاء"
        ],
        clearLogs
    );
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
   NVIDIA OPTIMIZATIONS
============================================================ */
async function optimizeNvidia() {
    try {
        const result = await window.api.optimizeNvidia();
        if (result.success) {
            showNotify(result.message || "تم تطبيق تحسينات NVIDIA بنجاح", "success");
        } else {
            showNotify(result.message || "فشل تطبيق تحسينات NVIDIA", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmOptimizeNvidia() {
    openModal(
        "تأكيد تحسينات NVIDIA",
        "هل أنت متأكد من تطبيق تحسينات NVIDIA؟",
        [
            "تفعيل NVIDIA High Performance Mode",
            "تعطيل Vertical Sync (V-Sync)",
            "تعيين Maximum Pre-rendered Frames إلى 1",
            "تفعيل Low Latency Mode",
            "تعطيل G-Sync للألعاب",
            "قد يؤدي إلى زيادة FPS في FiveM"
        ],
        optimizeNvidia
    );
}

/* ============================================================
   GAME MODE & POWER PLAN
============================================================ */
async function enableGameMode() {
    try {
        const result = await window.api.enableGameMode();
        if (result.success) {
            showNotify(result.message || "تم تفعيل Game Mode بنجاح", "success");
        } else {
            showNotify(result.message || "فشل تفعيل Game Mode", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmEnableGameMode() {
    openModal(
        "تأكيد تفعيل Game Mode",
        "هل أنت متأكد من تفعيل Game Mode و High Performance؟",
        [
            "تفعيل Windows Game Mode",
            "تفعيل High Performance Power Plan",
            "تعطيل Xbox Game Bar",
            "تعطيل Game DVR",
            "قد يؤدي إلى تحسين أداء الألعاب"
        ],
        enableGameMode
    );
}

/* ============================================================
   FIVEM GRAPHICS OPTIMIZATIONS
============================================================ */
async function optimizeFiveMGraphics() {
    try {
        const result = await window.api.optimizeFiveMGraphics();
        if (result.success) {
            showNotify(result.message || "تم تطبيق تحسينات الرسوميات بنجاح", "success");
        } else {
            showNotify(result.message || "فشل تطبيق تحسينات الرسوميات", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmOptimizeFiveMGraphics() {
    openModal(
        "تأكيد تحسينات الرسوميات",
        "هل أنت متأكد من تطبيق تحسينات رسوميات FiveM؟",
        [
            "تقليل جودة الظلال (Shadow Quality)",
            "تقليل جودة الإضاءة (Lighting Quality)",
            "تقليل جودة الانعكاسات (Reflection Quality)",
            "تعطيل Motion Blur",
            "تعطيل Depth of Field",
            "قد يؤدي إلى زيادة FPS لكن تقليل جودة الرسوميات"
        ],
        optimizeFiveMGraphics
    );
}

/* ============================================================
   SYSTEM SERVICES OPTIMIZATION
============================================================ */
async function optimizeServices() {
    try {
        const result = await window.api.optimizeServices();
        if (result.success) {
            showNotify(result.message || "تم تحسين خدمات النظام بنجاح", "success");
        } else {
            showNotify(result.message || "فشل تحسين الخدمات", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmOptimizeServices() {
    openModal(
        "تأكيد تحسين الخدمات",
        "هل أنت متأكد من إيقاف الخدمات غير الضرورية؟",
        [
            "إيقاف Windows Search (Indexing)",
            "إيقاف Windows Update Service",
            "إيقاف Print Spooler",
            "إيقاف Fax Service",
            "إيقاف Xbox Services",
            "قد يؤدي إلى تحسين أداء النظام"
        ],
        optimizeServices
    );
}

/* ============================================================
   NETWORK OPTIMIZATION
============================================================ */
async function optimizeNetwork() {
    try {
        const result = await window.api.optimizeNetwork();
        if (result.success) {
            showNotify(result.message || "تم تحسين الشبكة بنجاح", "success");
        } else {
            showNotify(result.message || "فشل تحسين الشبكة", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmOptimizeNetwork() {
    openModal(
        "تأكيد تحسين الشبكة",
        "هل أنت متأكد من تحسين إعدادات الشبكة؟",
        [
            "تفعيل TCP No Delay (Disable Nagle's Algorithm)",
            "تعطيل TCP Auto-tuning",
            "تعطيل TCP Window Scaling",
            "تعطيل Large Send Offload (LSO)",
            "تعطيل TCP Chimney Offload",
            "قد يؤدي إلى تقليل الـ Lag في FiveM"
        ],
        optimizeNetwork
    );
}

/* ============================================================
   RAM OPTIMIZATION
============================================================ */
async function optimizeRAM() {
    try {
        const result = await window.api.optimizeRAM();
        if (result.success) {
            showNotify(result.message || "تم تحسين الذاكرة بنجاح", "success");
        } else {
            showNotify(result.message || "فشل تحسين الذاكرة", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmOptimizeRAM() {
    openModal(
        "تأكيد تحسين الذاكرة",
        "هل أنت متأكد من تحسين إعدادات الذاكرة؟",
        [
            "تفعيل Clear Page File at Shutdown",
            "تعطيل System Failure Memory Dump",
            "تعطيل Kernel Memory Dump",
            "تفعيل Large System Cache",
            "تحسين إعدادات Virtual Memory",
            "قد يؤدي إلى تحسين أداء الذاكرة"
        ],
        optimizeRAM
    );
}

/* ============================================================
   FULL OPTIMIZATION
============================================================ */
async function fullOptimization() {
    try {
        const result = await window.api.fullOptimization();
        if (result.success) {
            showNotify(result.message || "تم تطبيق التحسينات الشاملة بنجاح", "success");
        } else {
            showNotify(result.message || "فشل التحسين الشامل", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء التحسين", "error");
    }
}

function confirmFullOptimization() {
    openModal(
        "تأكيد التحسين الشامل",
        "هل أنت متأكد من تطبيق جميع التحسينات دفعة واحدة؟",
        [
            "تطبيق جميع تحسينات NVIDIA",
            "تفعيل Game Mode و High Performance",
            "تطبيق تحسينات رسوميات FiveM",
            "إيقاف الخدمات غير الضرورية",
            "تحسين إعدادات الشبكة",
            "تحسين إعدادات الذاكرة",
            "قد يستغرق بضع دقائق",
            "قد يتطلب إعادة تشغيل النظام"
        ],
        fullOptimization
    );
}

/* ============================================================
   RESTORE FUNCTIONS
============================================================ */
async function restoreNvidia() {
    try {
        const result = await window.api.restoreNvidia();
        if (result.success) {
            showNotify(result.message || "تم استعادة إعدادات NVIDIA بنجاح", "success");
        } else {
            showNotify(result.message || "فشل استعادة NVIDIA", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

async function restoreGameMode() {
    try {
        const result = await window.api.restoreGameMode();
        if (result.success) {
            showNotify(result.message || "تم استعادة إعدادات Game Mode بنجاح", "success");
        } else {
            showNotify(result.message || "فشل استعادة Game Mode", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

async function restoreFiveMGraphics() {
    try {
        const result = await window.api.restoreFiveMGraphics();
        if (result.success) {
            showNotify(result.message || "تم استعادة إعدادات الرسوميات بنجاح", "success");
        } else {
            showNotify(result.message || "فشل استعادة الرسوميات", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

async function restoreServices() {
    try {
        const result = await window.api.restoreServices();
        if (result.success) {
            showNotify(result.message || "تم استعادة خدمات النظام بنجاح", "success");
        } else {
            showNotify(result.message || "فشل استعادة الخدمات", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

async function restoreNetwork() {
    try {
        const result = await window.api.restoreNetwork();
        if (result.success) {
            showNotify(result.message || "تم استعادة إعدادات الشبكة بنجاح", "success");
        } else {
            showNotify(result.message || "فشل استعادة الشبكة", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

async function restoreRAM() {
    try {
        const result = await window.api.restoreRAM();
        if (result.success) {
            showNotify(result.message || "تم استعادة إعدادات الذاكرة بنجاح", "success");
        } else {
            showNotify(result.message || "فشل استعادة الذاكرة", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

async function restoreAll() {
    try {
        const result = await window.api.restoreAll();
        if (result.success) {
            showNotify(result.message || "تم استعادة جميع الإعدادات بنجاح", "success");
        } else {
            showNotify(result.message || "فشل الاستعادة الشاملة", "error");
        }
    } catch (err) {
        console.error(err);
        showNotify("حدث خطأ أثناء الاستعادة", "error");
    }
}

/* ============================================================
   INIT
============================================================ */
loadSystemInfo();
