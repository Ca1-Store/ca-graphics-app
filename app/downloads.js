const box        = document.getElementById("downloadBox");
const bar        = document.getElementById("progressBar");
const pct        = document.getElementById("progressPercent");
const spd        = document.getElementById("progressSpeed");
const sizeEl     = document.getElementById("progressSize");
const dlName     = document.getElementById("downloadName");
const dlStatus   = document.getElementById("downloadStatus");
const statusDot  = document.getElementById("statusDot");
const emptyMsg   = document.getElementById("emptyMsg");
const historyEl  = document.getElementById("downloadHistory");

let downloadHistory = JSON.parse(localStorage.getItem("download_history") || "[]");

/* ============================================================
   STEPS HELPER
============================================================ */
const STEPS = ["download", "extract", "install", "hide", "done"];

function setStep(stepName) {
    STEPS.forEach(s => {
        const el = document.getElementById(`step-${s}`);
        if (!el) return;
        el.className = "dl-step";
        const idx = STEPS.indexOf(s);
        const activeIdx = STEPS.indexOf(stepName);
        if (idx < activeIdx) el.classList.add("done");
        else if (idx === activeIdx) el.classList.add("active");
    });
}

/* ============================================================
   STATUS HELPER
============================================================ */
function setStatus(msg, color = "#7cb0ff", dotColor = "#4f8cff") {
    if (dlStatus) dlStatus.textContent = msg;
    if (dlStatus) dlStatus.style.color = color;
    if (statusDot) statusDot.style.background = dotColor;
}

function setProgress(percent, speed = null, sizeText = null) {
    if (bar) bar.style.width = percent + "%";
    if (pct) pct.textContent = percent + "%";
    if (speed !== null && spd) spd.textContent = speed;
    if (sizeText !== null && sizeEl) sizeEl.textContent = sizeText;
}

/* ============================================================
   RENDER HISTORY
============================================================ */
function renderHistory() {
    if (!historyEl) return;
    historyEl.innerHTML = "";

    if (!downloadHistory.length) {
        historyEl.innerHTML = `<div style="padding:20px;text-align:center;color:#444;font-size:13px;">لا يوجد سجل تحميل</div>`;
        return;
    }

    [...downloadHistory].reverse().forEach(item => {
        const row = document.createElement("div");
        row.className = "history-row";
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px;overflow:hidden;">
                <div class="history-icon">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 2v8"/><path d="M5 7l3 3 3-3"/><path d="M3 13h10"/>
                    </svg>
                </div>
                <div style="overflow:hidden;">
                    <div class="history-name">${item.name}</div>
                    <div class="history-date">${item.date}</div>
                </div>
            </div>
            <div class="history-badge">✓ مكتمل</div>
        `;
        historyEl.appendChild(row);
    });
}

/* ============================================================
   MAIN DOWNLOAD FLOW
============================================================ */
async function startPendingDownload() {
    const raw = localStorage.getItem("pending_download");
    if (!raw) {
        if (emptyMsg) emptyMsg.style.display = "block";
        if (box) box.style.display = "none";
        renderHistory();
        return;
    }

    const pending = JSON.parse(raw);
    localStorage.removeItem("pending_download");

    if (emptyMsg) emptyMsg.style.display = "none";
    if (box) box.style.display = "block";

    if (dlName) dlName.textContent = pending.name || "جاري التحميل...";

    // ── مرحلة 0: حذف الجرافيكس القديمة إذا مطلوب ──
    if (pending.deleteFirst && pending.type === "pack") {
        setStatus("جاري حذف الجرافيكس القديمة...", "#ffb347", "#ffb347");
        setStep("download");
        await window.api.deleteGraphics();
    }

    // ── مرحلة 1: التحميل ──
    setStep("download");
    setStatus("جاري التحميل...", "#7cb0ff", "#4f8cff");
    setProgress(0, "0 MB/s");

    // استقبال progress
    window.api.onDownloadProgress(data => {
        setProgress(data.percent, data.speed + " MB/s");
    });

    // استقبال install status من main.js
    window.api.onInstallStatus(data => {
        if (data.stage === "preparing") {
            setStep("extract");
            setStatus("جاري التحضير...", "#7cb0ff", "#4f8cff");
            setProgress(100, "—");
        }
        if (data.stage === "extracting") {
            setStep("extract");
            setStatus("جاري فك الضغط...", "#7cb0ff", "#4f8cff");
        }
        if (data.stage === "copying") {
            setStep("install");
            setStatus("جاري نسخ الملفات...", "#a78bfa", "#7c5cff");
            setProgress(100, "—", "نسخ الملفات...");
        }
        if (data.stage === "hiding") {
            setStep("hide");
            setStatus("جاري حماية الملفات...", "#ffb347", "#ffb347");
            setProgress(100, "—", "حماية...");
        }
        if (data.stage === "done") {
            setStep("done");
            setStatus("تم بنجاح! ✅", "#00ffae", "#00ffae");
            setProgress(100, "مكتمل", "—");
            if (statusDot) statusDot.style.animation = "none";
        }
    });

    // بدء التحميل
    const result = await window.api.startDownload(pending.url, pending.productId);

    if (!result.success) {
        setStatus("❌ فشل التحميل", "#ff4d6a", "#ff4d6a");
        if (statusDot) statusDot.style.animation = "none";
        return;
    }

    setProgress(100, "—");
    setStep("extract");
    setStatus("جاري فك الضغط والتثبيت...", "#a78bfa", "#7c5cff");

    // تثبيت الباك
    if (pending.type === "pack") {
        const install = await window.api.runInstall(result.zipPath, pending.productId);

        if (!install.success) {
            setStatus("❌ فشل التثبيت", "#ff4d6a", "#ff4d6a");
            if (statusDot) statusDot.style.animation = "none";
            return;
        }
        // install:status يعرض المراحل تلقائياً
    }

    // مودات
    if (pending.type === "mod") {
        setStep("install");
        setStatus("جاري تثبيت الـ Mod...", "#a78bfa", "#7c5cff");
        await window.api.downloadMod(pending.url, pending.fileName || pending.productId);
        setStep("done");
        setStatus("تم تثبيت الـ Mod ✅", "#00ffae", "#00ffae");
        if (statusDot) statusDot.style.animation = "none";
    }

    // سجّل في التاريخ
    downloadHistory.push({
        name: pending.name,
        date: new Date().toLocaleString("ar")
    });
    localStorage.setItem("download_history", JSON.stringify(downloadHistory));
    localStorage.setItem("last_update", new Date().toLocaleString());

    renderHistory();

    // إخفاء الـ box بعد 5 ثواني
    setTimeout(() => {
        if (box) box.style.display = "none";
        if (emptyMsg) emptyMsg.style.display = "block";
    }, 5000);
}

/* ============================================================
   INIT
============================================================ */
renderHistory();
startPendingDownload();