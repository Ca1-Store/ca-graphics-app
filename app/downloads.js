/* ============================================================
   DOWNLOADS PAGE - نظام تحميل محسّن مع polling
============================================================ */

const box       = document.getElementById("downloadBox");
const bar       = document.getElementById("progressBar");
const pct       = document.getElementById("progressPercent");
const spd       = document.getElementById("progressSpeed");
const dlName    = document.getElementById("downloadName");
const dlStatus  = document.getElementById("downloadStatus");
const statusDot = document.getElementById("statusDot");
const emptyMsg  = document.getElementById("emptyMsg");
const historyEl = document.getElementById("downloadHistory");

let downloadHistory = JSON.parse(localStorage.getItem("download_history") || "[]");
let pollTimer = null;

/* ── STEPS ── */
const STEPS = ["download", "extract", "install", "hide", "done"];

function setStep(name) {
    STEPS.forEach(s => {
        const el = document.getElementById(`step-${s}`);
        if (!el) return;
        el.className = "dl-step";
        const i = STEPS.indexOf(s), ai = STEPS.indexOf(name);
        if (i < ai) el.classList.add("done");
        else if (i === ai) el.classList.add("active");
    });
}

function setStatus(msg, color = "#7cb0ff", dot = "#4f8cff") {
    if (dlStatus) { dlStatus.textContent = msg; dlStatus.style.color = color; }
    if (statusDot) { statusDot.style.background = dot; statusDot.style.animation = "pulse-dot 1.4s ease infinite"; }
}

function setProgress(percent, speed = null) {
    if (bar) bar.style.width = percent + "%";
    if (pct) pct.textContent = percent + "%";
    if (speed !== null && spd) spd.textContent = speed;
}

function showBox(name) {
    if (emptyMsg) emptyMsg.style.display = "none";
    if (box) box.style.display = "block";
    if (dlName && name) dlName.textContent = name;
}

function hideBox() {
    if (box) box.style.display = "none";
    if (emptyMsg) emptyMsg.style.display = "block";
    stopPolling();
}

/* ── POLLING ── */
function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
        const state = await window.api.getDownloadState();
        if (!state || (!state.running && (!state.stage || state.stage === "done" || state.stage === "error"))) {
            stopPolling();
            return;
        }
        applyStage(state.stage, state.percent, state.speed);
    }, 800);
}

function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

/* ── APPLY STAGE ── */
function applyStage(stage, percent = 0, speed = null) {
    if (percent !== null) setProgress(percent, speed ? speed + " MB/s" : null);

    const stageMap = {
        downloading: ["download",  "جاري التحميل...",       "#7cb0ff", "#4f8cff"],
        preparing:   ["extract",   "جاري التحضير...",       "#a78bfa", "#7c5cff"],
        extracting:  ["extract",   "جاري فك الضغط...",      "#7cb0ff", "#4f8cff"],
        installing:  ["extract",   "جاري التثبيت...",       "#a78bfa", "#7c5cff"],
        copying:     ["install",   "جاري نسخ الملفات...",   "#a78bfa", "#7c5cff"],
        hiding:      ["hide",      "جاري حماية الملفات...", "#ffb347", "#ffb347"],
        done:        ["done",      "تم بنجاح! ✅",           "#00ffae", "#00ffae"],
        error:       ["download",  "❌ حدث خطأ",             "#ff4d6a", "#ff4d6a"],
    };

    const [step, msg, color, dot] = stageMap[stage] || ["download", stage, "#7cb0ff", "#4f8cff"];
    setStep(step);
    setStatus(msg, color, dot);

    if (stage === "done" || stage === "error") {
        if (statusDot) statusDot.style.animation = "none";
    }
}

/* ── HISTORY ── */
function renderHistory() {
    if (!historyEl) return;
    historyEl.innerHTML = "";
    if (!downloadHistory.length) {
        historyEl.innerHTML = `<div style="padding:24px;text-align:center;color:#444;font-size:13px;">لا يوجد سجل تحميل</div>`;
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
                <div>
                    <div class="history-name">${item.name}</div>
                    <div class="history-date">${item.date}</div>
                </div>
            </div>
            <div class="history-badge">✓ مكتمل</div>
        `;
        historyEl.appendChild(row);
    });
}

function saveHistory(name) {
    downloadHistory.push({ name, date: new Date().toLocaleString("ar") });
    localStorage.setItem("download_history", JSON.stringify(downloadHistory));
    localStorage.setItem("last_update", new Date().toLocaleString());
    renderHistory();
}

/* ── REGISTER LISTENERS ── */
function registerListeners(pendingName) {
    window.api.onDownloadProgress(data => {
        setProgress(data.percent, data.speed + " MB/s");
    });

    window.api.onInstallStatus(data => {
        applyStage(data.stage, null, null);
        if (data.stage === "done") {
            stopPolling();
            setProgress(100, "مكتمل");
            saveHistory(pendingName || localStorage.getItem("active_dl_name") || "—");
            localStorage.removeItem("active_dl_name");
            setTimeout(hideBox, 5000);
        }
        if (data.stage === "error") {
            stopPolling();
            localStorage.removeItem("active_dl_name");
        }
    });

    // استقبال الحالة الكاملة لما تُفتح الصفحة من جديد
    window.api.onDownloadStateSync(state => {
        if (!state || (!state.running && (!state.stage || state.stage === "done" || state.stage === "error"))) return;
        const name = localStorage.getItem("active_dl_name") || state.name || "جاري التحميل...";
        showBox(name);
        applyStage(state.stage, state.percent, state.speed);
    });
}

/* ── MAIN FLOW ── */
async function startPendingDownload() {
    const raw = localStorage.getItem("pending_download");

    if (raw) {
        const pending = JSON.parse(raw);
        localStorage.removeItem("pending_download");
        localStorage.setItem("active_dl_name", pending.name || "جاري التحميل...");

        registerListeners(pending.name);
        showBox(pending.name || "جاري التحميل...");

        if (pending.deleteFirst && pending.type === "pack") {
            setStatus("جاري حذف الجرافيكس القديمة...", "#ffb347", "#ffb347");
            setStep("download");
            await window.api.deleteGraphics();
        }

        setStep("download");
        setStatus("جاري التحميل...", "#7cb0ff", "#4f8cff");
        setProgress(0, "0 MB/s");
        startPolling();

        const result = await window.api.startDownload(pending.url, pending.productId, pending.name);

        if (!result.success) {
            stopPolling();
            applyStage("error");
            localStorage.removeItem("active_dl_name");
            return;
        }

        setProgress(100, "—");
        applyStage("extracting");

        if (pending.type === "pack") {
            const install = await window.api.runInstall(result.zipPath, pending.productId);
            if (!install.success) {
                stopPolling();
                applyStage("error");
                localStorage.removeItem("active_dl_name");
            }
        }

        if (pending.type === "mod") {
            applyStage("copying");
            await window.api.downloadMod(pending.url, pending.fileName || pending.productId);
            stopPolling();
            applyStage("done", 100, "مكتمل");
            saveHistory(pending.name);
            localStorage.removeItem("active_dl_name");
            setTimeout(hideBox, 5000);
        }

        return;
    }

    /* ── لا pending - تحقق من حالة شغّالة ── */
    registerListeners(null);
    const state = await window.api.getDownloadState();
    const name  = localStorage.getItem("active_dl_name") || "جاري التحميل...";

    if (state && (state.running || (state.stage && state.stage !== "done" && state.stage !== "error"))) {
        showBox(name);
        applyStage(state.stage, state.percent, state.speed);
        startPolling();
    } else {
        hideBox();
    }
}

/* ── INIT ── */
renderHistory();
startPendingDownload();