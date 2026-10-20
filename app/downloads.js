/* ==========================================================================
   DOWNLOADS — التحميلات (v2: إيقاف مؤقت / استئناف / إلغاء / ETA / سجل)
   ========================================================================== */
const { ic, esc, toast, confirm: askConfirm } = window.CA;
const $ = (id) => document.getElementById(id);

const box = $("downloadBox"), bar = $("progressBar"), pct = $("progressPercent"), spd = $("progressSpeed");
const dlName = $("downloadName"), dlStatus = $("downloadStatus"), statusDot = $("statusDot");
const emptyMsg = $("emptyMsg"), historyEl = $("downloadHistory");
const controls = $("dlControls"), track = $("dlTrack");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let downloadHistory = [];
try { downloadHistory = JSON.parse(localStorage.getItem("download_history") || "[]"); } catch {}
let histFilter = "all";
let pollTimer = null, tickTimer = null;

/* حالة العنصر الجاري */
let cur = null;            // { payload, startedAt, logged, canceled }
let paused = false;
let cancelAll = false;

/* ── helpers ── */
function fmtBytes(n) {
    n = Number(n) || 0;
    if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(2) + " GB";
    if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(1) + " MB";
    if (n >= 1024) return Math.round(n / 1024) + " KB";
    return n + " B";
}
function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}
function notifyOS(title, body) {
    try { if (document.hidden) new Notification(title, { body, silent: false }); } catch {}
}

/* ── steps ── */
const STEPS = ["download", "extract", "install", "hide", "done"];
function setStep(name) {
    const ai = STEPS.indexOf(name);
    STEPS.forEach((s, i) => {
        const el = $(`step-${s}`);
        if (el) el.className = "step" + (i < ai ? " done" : i === ai ? " active" : "");
    });
}
function setStatus(msg, tone = "info") {
    dlStatus.textContent = msg;
    statusDot.className = "dl-dot " + tone;
}

/* ── progress ── */
let lastBytes = { done: 0, total: 0, speed: 0 };
function setProgress(percent, speed = null, done = null, total = null) {
    const p = Math.max(0, Math.min(100, Number(percent) || 0));
    bar.style.width = p + "%";
    pct.textContent = Math.round(p) + "%";
    if (speed !== null && speed !== undefined) {
        spd.textContent = typeof speed === "number" || /^[\d.]+$/.test(String(speed)) ? `${speed} MB/s` : speed;
        lastBytes.speed = parseFloat(speed) || 0;
    }
    if (done !== null && done !== undefined) {
        lastBytes.done = done; lastBytes.total = total || 0;
        $("progressSize").textContent = total ? `${fmtBytes(done)} / ${fmtBytes(total)}` : fmtBytes(done);
    }
    if (lastBytes.total && lastBytes.speed > 0 && !paused) {
        $("progressEta").textContent = fmtTime((lastBytes.total - lastBytes.done) / (lastBytes.speed * 1024 * 1024));
    } else if (paused) $("progressEta").textContent = "—";
}
function resetCells() {
    lastBytes = { done: 0, total: 0, speed: 0 };
    $("progressSize").textContent = "—";
    $("progressEta").textContent = "—";
    $("progressElapsed").textContent = "0:00";
    spd.textContent = "0 MB/s";
}

function startTick() {
    stopTick();
    tickTimer = setInterval(() => {
        if (cur && !paused) $("progressElapsed").textContent = fmtTime((Date.now() - cur.startedAt) / 1000);
    }, 1000);
}
function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

function showBox(name) {
    emptyMsg.style.display = "none";
    box.style.display = "";
    if (name) dlName.textContent = name;
}
function hideBox() {
    box.style.display = "none";
    emptyMsg.style.display = queueState.length > 1 ? "none" : "";
    stopPolling(); stopTick();
}

/* ── pause / cancel UI ── */
function setPaused(p) {
    paused = p;
    track.classList.toggle("paused", p);
    $("pauseBtn").innerHTML = p ? `${ic("play")}استئناف` : `${ic("pause")}إيقاف مؤقت`;
    if (p) { setStatus("متوقف مؤقتاً", "paused"); spd.textContent = "0 MB/s"; $("progressEta").textContent = "—"; }
    else setStatus("جاري التحميل...", "info");
}
$("pauseBtn").addEventListener("click", async () => {
    const r = await (paused ? window.api.resumeDownload() : window.api.pauseDownload());
    if (r && r.success) setPaused(!paused);
    else toast("لا يمكن التحكم بالتحميل الآن", "error");
});
async function doCancel() {
    const r = await window.api.cancelDownload();
    if (cur) cur.canceled = true;
    return r && r.success;
}
$("cancelBtn").addEventListener("click", async () => {
    const ok = await askConfirm({
        title: "إلغاء التحميل؟", message: "سيتوقف التحميل وتُحذف الملفات المؤقتة.", confirmText: "إلغاء التحميل", danger: true
    });
    if (ok) await doCancel();
});

/* ── polling (يشمل إعادة فتح الصفحة أثناء تحميل جارٍ) ── */
const isIdle = (s) => !s || (!s.running && (!s.stage || s.stage === "done" || s.stage === "error"));
function startPolling() {
    stopPolling();
    pollTimer = setInterval(async () => {
        const s = await window.api.getDownloadState();
        if (isIdle(s)) return stopPolling();
        if (s.paused !== undefined && s.paused !== paused && s.stage === "downloading") setPaused(!!s.paused);
        applyStage(s.stage, s.percent, s.speed, s.downloaded, s.total);
    }, 900);
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

const STAGES = {
    downloading: ["download", "جاري التحميل...", "info"],
    preparing:   ["extract",  "جاري التحضير...", "info"],
    extracting:  ["extract",  "جاري فك الضغط...", "info"],
    installing:  ["extract",  "جاري التثبيت...", "info"],
    copying:     ["install",  "جاري نسخ الملفات...", "info"],
    hiding:      ["hide",     "جاري حماية الملفات...", "warn"],
    done:        ["done",     "تم بنجاح", "ok"],
    error:       ["download", "حدث خطأ أثناء العملية", "err"]
};
function applyStage(stage, percent = null, speed = null, done = null, total = null) {
    if (percent !== null && percent !== undefined) setProgress(percent, speed, done, total);
    const [step, msg, tone] = STAGES[stage] || ["download", stage || "...", "info"];
    setStep(step);
    if (!(stage === "downloading" && paused)) setStatus(msg, tone);
    controls.classList.toggle("hidden", stage !== "downloading");
    if (stage === "done") { setStep("done"); $("step-done").classList.replace("active", "done"); }
}

/* ── history ── */
function renderStats() {
    const ok = downloadHistory.filter((h) => (h.st || "ok") === "ok").length;
    $("stOk").textContent = ok;
    $("stFail").textContent = downloadHistory.length - ok;
    const last = downloadHistory[downloadHistory.length - 1];
    $("stLast").textContent = last ? String(last.date).split(/[,،]/)[0] : "—";
}
const ST_LABEL = { ok: ["ok", "مكتمل", "check"], fail: ["err", "فشل", "alert"], cancel: ["warn", "ملغى", "x"] };
function renderHistory() {
    renderStats();
    $("clearHistory").disabled = !downloadHistory.length;
    let list = [...downloadHistory].reverse();
    if (histFilter === "ok") list = list.filter((h) => (h.st || "ok") === "ok");
    if (histFilter === "bad") list = list.filter((h) => (h.st || "ok") !== "ok");
    if (!list.length) {
        historyEl.innerHTML = `<div class="empty-line">${downloadHistory.length ? "لا توجد عمليات في هذا الفلتر" : "لا يوجد سجل تحميل بعد"}</div>`;
        return;
    }
    const idxOf = (it) => downloadHistory.indexOf(it);
    historyEl.innerHTML = list.slice(0, 40).map((it) => {
        const [tone, label, icon] = ST_LABEL[it.st || "ok"];
        const bad = (it.st || "ok") !== "ok";
        return `
        <div class="history-row">
            <div class="icon-tile sm ${tone}">${ic(icon, "sm")}</div>
            <div class="grow" style="min-width:0">
                <div class="history-name">${esc(it.name)}</div>
                <div class="history-date">${esc(it.date)}</div>
            </div>
            ${bad && it.payload ? `<button class="btn btn-sm" data-retry="${idxOf(it)}">${ic("refresh", "sm")}إعادة المحاولة</button>` : ""}
            <span class="pill ${tone} plain">${label}</span>
        </div>`;
    }).join("");
}
function addHistory(name, st = "ok", payload = null) {
    const date = new Date().toLocaleString("ar", { numberingSystem: "latn" });
    downloadHistory.push({ name, date, st, payload: st === "ok" ? null : payload });
    try {
        localStorage.setItem("download_history", JSON.stringify(downloadHistory.slice(-100)));
        if (st === "ok") localStorage.setItem("last_update", date);
    } catch {}
    renderHistory();
}
function logOnce(st) {
    if (!cur || cur.logged) return;
    cur.logged = true;
    addHistory(cur.payload.name || "—", st, cur.payload);
}
$("histFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    histFilter = b.dataset.f;
    document.querySelectorAll("#histFilter button").forEach((x) => x.classList.toggle("on", x === b));
    renderHistory();
});
$("clearHistory").addEventListener("click", async () => {
    const ok = await askConfirm({ title: "مسح سجل التحميلات؟", message: "لن يؤثر هذا على الملفات المثبّتة.", confirmText: "مسح", danger: true });
    if (!ok) return;
    downloadHistory = [];
    try { localStorage.removeItem("download_history"); } catch {}
    renderHistory();
});
historyEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-retry]");
    if (!b) return;
    const it = downloadHistory[Number(b.dataset.retry)];
    if (!it || !it.payload) return;
    localStorage.setItem("pending_download", JSON.stringify(it.payload));
    location.reload();
});
document.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => window.api.openPage(b.dataset.go)));

/* ── listeners ── */
function registerListeners() {
    window.api.onDownloadProgress((d) => setProgress(d.percent, d.speed, d.downloaded, d.total));

    window.api.onInstallStatus((d) => {
        applyStage(d.stage, null, null);
        if (d.stage === "done") {
            stopPolling();
            setProgress(100, "مكتمل");
            logOnce("ok");
            localStorage.removeItem("active_dl_name");
            toast("اكتمل التثبيت", "success");
            notifyOS("Ca Store", `اكتمل تثبيت ${cur ? cur.payload.name : ""}`);
            if (!queueState.length) setTimeout(hideBox, 5000);
        }
        if (d.stage === "error") { stopPolling(); localStorage.removeItem("active_dl_name"); }
    });

    window.api.onDownloadStateSync((s) => {
        if (isIdle(s)) return;
        showBox(localStorage.getItem("active_dl_name") || s.name || "جاري التحميل...");
        if (s.paused) setPaused(true);
        applyStage(s.stage, s.percent, s.speed, s.downloaded, s.total);
    });
}

function fail(msg) {
    stopPolling();
    applyStage("error");
    controls.classList.add("hidden");
    if (msg) setStatus(msg, "err");
    localStorage.removeItem("active_dl_name");
    logOnce("fail");
    toast("فشلت العملية، حاول مرة أخرى", "error");
    notifyOS("Ca Store", "فشلت العملية");
}
function canceled() {
    stopPolling();
    setPaused(false);
    controls.classList.add("hidden");
    setStatus("تم إلغاء التحميل", "err");
    localStorage.removeItem("active_dl_name");
    logOnce("cancel");
    toast("تم إلغاء التحميل", "info");
}

/* ── queue UI ── */
let queueState = [];
function renderQueue() {
    const card = $("queueCard");
    card.style.display = queueState.length > 1 ? "" : "none";
    const label = { wait: "في الانتظار", active: "جاري التنفيذ", done: "اكتمل", fail: "فشل", cancel: "ملغى", skip: "تم التخطي" };
    $("queueList").innerHTML = queueState.map((q, i) => `
        <div class="q-row ${q.st}"><span class="q-n">${q.st === "done" ? ic("check", "sm") : i + 1}</span>
        <span class="q-name">${esc(q.name)}</span><span class="st">${label[q.st]}</span>
        ${q.st === "wait" ? `<button class="q-x" data-skip="${i}" title="إزالة من الطابور">${ic("x", "sm")}</button>` : ""}</div>`).join("");
    const done = queueState.filter((q) => !["wait", "active"].includes(q.st)).length;
    $("queueCount").textContent = `${done} / ${queueState.length}`;
}
$("queueList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-skip]");
    if (!b) return;
    const q = queueState[Number(b.dataset.skip)];
    if (q && q.st === "wait") { q.st = "skip"; renderQueue(); }
});
$("queueCancelAll").addEventListener("click", async () => {
    const ok = await askConfirm({ title: "إلغاء كل الطابور؟", message: "سيُلغى التحميل الحالي وكل العناصر المنتظرة.", confirmText: "إلغاء الكل", danger: true });
    if (!ok) return;
    cancelAll = true;
    queueState.forEach((q) => { if (q.st === "wait") q.st = "skip"; });
    renderQueue();
    if (cur) await doCancel();
});

function recordModVersion(p) {
    if (p.type !== "mod" || !p.version) return;
    try {
        const m = JSON.parse(localStorage.getItem("mod_versions") || "{}");
        m[p.fileName || p.productId] = p.version;
        localStorage.setItem("mod_versions", JSON.stringify(m));
    } catch {}
}

/* ── تشغيل عنصر واحد (مع إعادة محاولة تلقائية) ── */
const MAX_RETRY = 2;
async function runItem(pending) {
    cur = { payload: pending, startedAt: Date.now(), logged: false, canceled: false };
    setPaused(false);
    localStorage.setItem("active_dl_name", pending.name || "جاري التحميل...");
    showBox(pending.name || "جاري التحميل...");
    resetCells(); setProgress(0, "0");
    startTick();
    try {
        if (pending.deleteFirst && pending.type === "pack") {
            setStatus("جاري أخذ نسخة احتياطية...", "warn");
            setStep("download");
            try { await window.api.backupGraphics?.(); } catch (e) { console.error(e); }
            setStatus("جاري حذف الجرافيكس القديمة...", "warn");
            await window.api.deleteGraphics();
        }

        let result = null;
        for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
            setStep("download");
            setStatus(attempt ? `إعادة المحاولة (${attempt}/${MAX_RETRY})...` : "جاري التحميل...", attempt ? "warn" : "info");
            controls.classList.remove("hidden");
            startPolling();
            result = await window.api.startDownload(pending.url, pending.productId, pending.name);
            if (result && (result.success || result.canceled)) break;
            if (cur.canceled || attempt === MAX_RETRY) break;
            stopPolling();
            setStatus(`انقطع التحميل، سأعيد المحاولة خلال 3 ثوانٍ (${attempt + 1}/${MAX_RETRY})`, "warn");
            await sleep(3000);
        }
        controls.classList.add("hidden");
        if (result && result.canceled) { canceled(); return "cancel"; }
        if (!result || !result.success) { fail(); return "fail"; }

        setProgress(100, "—");
        applyStage("extracting");

        if (pending.type === "pack") {
            const inst = await window.api.runInstall(result.zipPath, pending.productId);
            if (!inst || !inst.success) { fail(); return "fail"; }
            return "ok";
        }
        applyStage("copying");
        const r = await window.api.downloadMod(pending.url, pending.fileName || pending.productId);
        stopPolling();
        if (r && r.success === false) { fail(); return "fail"; }
        applyStage("done", 100, null);
        setProgress(100, "مكتمل");
        logOnce("ok");
        recordModVersion(pending);
        localStorage.removeItem("active_dl_name");
        notifyOS("Ca Store", `اكتمل تثبيت ${pending.name}`);
        return "ok";
    } catch (e) {
        console.error(e);
        fail();
        return "fail";
    } finally { stopTick(); }
}

/* ── main flow ── */
async function startPendingDownload() {
    let queue = null, pending = null;
    try {
        const q = localStorage.getItem("download_queue");
        if (q) { queue = JSON.parse(q); localStorage.removeItem("download_queue"); }
        const raw = localStorage.getItem("pending_download");
        if (raw) { pending = JSON.parse(raw); localStorage.removeItem("pending_download"); }
    } catch {}

    registerListeners();

    if (Array.isArray(queue) && queue.length) {
        queueState = queue.map((q) => ({ name: q.name, st: "wait" }));
        renderQueue();
        for (let i = 0; i < queue.length; i++) {
            if (queueState[i].st === "skip" || cancelAll) continue;
            queueState[i].st = "active"; renderQueue();
            const res = await runItem(queue[i]);
            queueState[i].st = res === "ok" ? "done" : res; renderQueue();
            if (i < queue.length - 1) await sleep(900);
        }
        const okN = queueState.filter((q) => q.st === "done").length;
        toast(`اكتمل ${okN} من ${queueState.length}`, okN === queueState.length ? "success" : "error");
        setTimeout(hideBox, 5000);
        return;
    }

    if (pending) {
        const res = await runItem(pending);
        if (res !== "ok" || pending.type === "mod") setTimeout(hideBox, res === "ok" ? 5000 : 7000);
        return;
    }

    const s = await window.api.getDownloadState();
    if (s && !isIdle(s)) {
        showBox(localStorage.getItem("active_dl_name") || s.name || "جاري التحميل...");
        if (s.paused) setPaused(true);
        applyStage(s.stage, s.percent, s.speed, s.downloaded, s.total);
        cur = { payload: { name: localStorage.getItem("active_dl_name") || s.name || "—" }, startedAt: Date.now(), logged: false, canceled: false };
        startTick();
        startPolling();
    } else hideBox();
}

renderHistory();
startPendingDownload();
