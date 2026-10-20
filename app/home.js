/* ==========================================================================
   HOME — الرئيسية
   ========================================================================== */
const $id = (id) => document.getElementById(id);

const packsCount = $id("packsCount");
const modsCount = $id("modsCount");
const reshadeStatus = $id("reshadeStatus");
const lastUpdate = $id("lastUpdate");
const welcomeName = $id("welcomeName");
const welcomePlan = $id("welcomePlan");
const fivemStatus = $id("fivemStatus");
const pathsStatus = $id("pathsStatus");
const connectionStatus = $id("connectionStatus");
const connectionPill = $id("connectionPill");
const connectionBar = $id("connectionBar");

const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";

/* ── AUTH ── */
async function checkAuth() {
    const result = await window.api.auth.check();
    if (!result.success) {
        window.api.openPage("login.html");
        return null;
    }

    welcomeName.textContent = result.username || "مستخدم";

    const plans = result.plans || [];
    welcomePlan.textContent = plans.length ? plans.join(" + ") : "بدون اشتراك";
    packsCount.textContent = plans.length;

    return result;
}

/* ── MODS ── */
async function loadModsCount() {
    try {
        const result = await window.api.getModsList();
        modsCount.textContent = result && result.success ? result.files.length : "0";
    } catch {
        modsCount.textContent = "0";
    }
}

/* ── RESHADE ── */
function setReshade(text, color) {
    reshadeStatus.textContent = text;
    reshadeStatus.style.color = color || "";
}

async function loadReShadeStatus() {
    const fivem = await window.api.getFiveMPath();
    if (!fivem.success) return setReshade("غير متاح", "var(--text-3)");

    try {
        const content = await window.api.readFile(`${fivem.path}\\CitizenFX.ini`);
        const enabled = !!content && content.includes("ReShade5=");
        setReshade(enabled ? "مفعّل" : "معطّل", enabled ? "var(--ok)" : "var(--err)");
    } catch {
        setReshade("معطّل", "var(--err)");
    }
}

/* ── LAST UPDATE ── */
function loadLastUpdate() {
    let date = null;
    try { date = localStorage.getItem("last_update"); } catch {}
    lastUpdate.textContent = date || "لا يوجد";
}

/* ── SYSTEM ── */
function setPill(el, ok, text) {
    el.textContent = text;
    el.className = `status-pill ${ok ? "online" : "offline"}`;
}

async function loadFiveM() {
    const fivem = await window.api.getFiveMPath();
    if (fivem.success) {
        setPill(fivemStatus, true, "جاهز");
        pathsStatus.textContent = fivem.path;
        pathsStatus.title = fivem.path;
    } else {
        setPill(fivemStatus, false, "غير مُعدّ");
        pathsStatus.textContent = "لم يتم تحديد مسار";
    }
}

async function checkConnection() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
        await fetch(`${BACKEND_URL}/api/packs`, { method: "GET", signal: ctrl.signal, cache: "no-store" });
        connectionStatus.textContent = "متصل";
        setPill(connectionPill, true, "متصل");
        connectionBar.style.width = "100%";
    } catch {
        connectionStatus.textContent = "غير متصل";
        setPill(connectionPill, false, "غير متصل");
        connectionBar.style.width = "25%";
    } finally {
        clearTimeout(timer);
    }
}

/* ── INIT ── */
(async function init() {
    const authed = await checkAuth();
    if (!authed) return;

    loadLastUpdate();
    await Promise.allSettled([loadModsCount(), loadReShadeStatus(), loadFiveM(), checkConnection()]);
})();
