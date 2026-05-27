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

/* ============================================================
   STEPS
============================================================ */
const STEPS = ["download", "extract", "install", "hide", "done"];

function setStep(stepName) {
    STEPS.forEach(s => {
        const el = document.getElementById(`step-${s}`);
        if (!el) return;
        el.className = "dl-step";
        const idx = STEPS.indexOf(s), ai = STEPS.indexOf(stepName);
        if (idx < ai) el.classList.add("done");
        else if (idx === ai) el.classList.add("active");
    });
}

function setStatus(msg, color = "#7cb0ff", dot = "#4f8cff") {
    if (dlStatus) { dlStatus.textContent = msg; dlStatus.style.color = color; }
    if (statusDot) statusDot.style.background = dot;
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

/* ============================================================
   تحويل stage → عرض مناسب
============================================================ */
function applyStage(stage, percent, speed) {
    setProgress(percent, speed ? speed + " MB/s" : "—");

    if (stage === "downloading") {
        setStep("download");
        setStatus("جاري التحميل...", "#7cb0ff", "#4f8cff");
    } else if (stage === "installing" || stage === "preparing") {
        setStep("extract");
        setStatus("جاري التثبيت...", "#a78bfa", "#7c5cff");
    } else if (stage === "extracting") {
        setStep("extract");
        setStatus("جاري فك الضغط...", "#7cb0ff", "#4f8cff");
    } else if (stage === "copying") {
        setStep("install");
        setStatus("جاري نسخ الملفات...", "#a78bfa", "#7c5cff");
    } else if (stage === "hiding") {
        setStep("hide");
        setStatus("جاري حماية الملفات...", "#ffb347", "#ffb347");
    } else if (stage === "done") {
        setStep("done");
        setStatus("تم بنجاح! ✅", "#00ffae", "#00ffae");
        setProgress(100, "مكتمل");
        if (statusDot) statusDot.style.animation = "none";
    } else if (stage === "error") {
        setStatus("❌ فشل", "#ff4d6a", "#ff4d6a");
        if (statusDot) statusDot.style.animation = "none";
    }
}

/* ============================================================
   LISTENERS - يسجّل مرة وحدة
============================================================ */
function registerListeners(pending) {
    window.api.onDownloadProgress(data => {
        setProgress(data.percent, data.speed + " MB/s");
    });

    window.api.onInstallStatus(data => {
        applyStage(data.stage, 100, null);

        if (data.stage === "done") {
            const name = (pending && pending.name) || localStorage.getItem("active_download_name") || "—";
            downloadHistory.push({ name, date: new Date().toLocaleString("ar") });
            localStorage.setItem("download_history", JSON.stringify(downloadHistory));
            localStorage.setItem("last_update", new Date().toLocaleString());
            localStorage.removeItem("active_download_name");
            renderHistory();
            setTimeout(hideBox, 5000);
        }
    });
}

/* ============================================================
   INIT - المنطق الكامل
============================================================ */
async function init() {
    renderHistory();

    /* ── 1. هل فيه تحميل جديد pending؟ ── */
    const raw = localStorage.getItem("pending_download");

    if (raw) {
        const pending = JSON.parse(raw);
        localStorage.removeItem("pending_download");
        localStorage.setItem("active_download_name", pending.name || "جاري التحميل...");

        registerListeners(pending);
        showBox(pending.name || "جاري التحميل...");

        // حذف القديمة
        if (pending.deleteFirst && pending.type === "pack") {
            setStatus("جاري حذف الجرافيكس القديمة...", "#ffb347", "#ffb347");
            setStep("download");
            await window.api.deleteGraphics();
        }

        setStep("download");
        setStatus("جاري التحميل...", "#7cb0ff", "#4f8cff");
        setProgress(0, "0 MB/s");

        const result = await window.api.startDownload(pending.url, pending.productId);

        if (!result.success) {
            setStatus("❌ فشل التحميل", "#ff4d6a", "#ff4d6a");
            if (statusDot) statusDot.style.animation = "none";
            localStorage.removeItem("active_download_name");
            return;
        }

        setProgress(100, "—");
        setStep("extract");
        setStatus("جاري التثبيت...", "#a78bfa", "#7c5cff");

        if (pending.type === "pack") {
            const install = await window.api.runInstall(result.zipPath, pending.productId);
            if (!install.success) {
                setStatus("❌ فشل التثبيت", "#ff4d6a", "#ff4d6a");
                if (statusDot) statusDot.style.animation = "none";
                localStorage.removeItem("active_download_name");
            }
        }

        if (pending.type === "mod") {
            setStep("install");
            setStatus("جاري تثبيت الـ Mod...", "#a78bfa", "#7c5cff");
            await window.api.downloadMod(pending.url, pending.fileName || pending.productId);
            setStep("done");
            setStatus("تم ✅", "#00ffae", "#00ffae");
            if (statusDot) statusDot.style.animation = "none";
            downloadHistory.push({ name: pending.name, date: new Date().toLocaleString("ar") });
            localStorage.setItem("download_history", JSON.stringify(downloadHistory));
            localStorage.removeItem("active_download_name");
            renderHistory();
            setTimeout(hideBox, 5000);
        }

        return;
    }

    /* ── 2. لا pending - اسأل main process عن الحالة ── */
    registerListeners(null);

    const state = await window.api.getDownloadState();
    const name  = localStorage.getItem("active_download_name") || "جاري التحميل...";

    if (state && (state.running || (state.stage && state.stage !== "done" && state.stage !== "error" && state.stage !== null))) {
        // ✅ فيه تحميل شغّال - اعرضه فوراً
        showBox(name);
        applyStage(state.stage, state.percent, state.speed);
    } else {
        // لا شيء
        hideBox();
    }
}

init();