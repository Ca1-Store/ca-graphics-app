/* ==========================================================================
   SETTINGS — الإعدادات
   ========================================================================== */
const { esc, toast } = window.CA;
const $ = (id) => document.getElementById(id);

let currentPath = "";
let savedPath = "";

function updatePathUI(path, saved) {
    const has = !!path;
    $("pathValue").textContent = has ? path : "لم يتم تحديد مسار";
    $("currentFolderName").textContent = has ? (path.split(/[\\/]/).filter(Boolean).pop() || "FiveM") : "لا يوجد مجلد";
    $("currentFolderPath").textContent = has ? path : "اختر مجلد FiveM Application Data";

    const dirty = has && path !== savedPath;
    $("pathStatusText").textContent = !has ? "لم يتم ضبط المسار" : dirty ? "تغييرات غير محفوظة" : "المسار مضبوط";
    $("pathStatusDot").className = "dot " + (!has ? "err" : dirty ? "warn" : "ok");

    const b = $("systemBadge");
    b.textContent = saved && has ? "النظام جاهز" : "يتطلب إعداد";
    b.className = "status-pill " + (saved && has ? "online" : "pending");
    $("savePathBtn").disabled = !dirty;
}

async function loadPath() {
    try {
        const r = await window.api.getFiveMPath();
        if (r && r.success && r.path) { currentPath = savedPath = r.path; }
    } catch (e) { console.error(e); }
    updatePathUI(currentPath, !!savedPath);
}

$("selectPathBtn").onclick = async () => {
    try {
        const r = await window.api.selectFolder();
        if (!r || !r.success || !r.path) return;
        currentPath = r.path;
        updatePathUI(currentPath, !!savedPath);
        const v = await window.api.validateFiveMPath(r.path);
        if (v && v.valid) toast("تم اختيار المجلد، اضغط «حفظ المسار»");
        else toast("لا يبدو أن هذا مجلد FiveM صالح", "error");
    } catch (e) { console.error(e); toast("فشل اختيار المجلد", "error"); }
};

$("savePathBtn").onclick = async () => {
    if (!currentPath) return toast("اختر مساراً صالحاً أولاً", "error");
    const btn = $("savePathBtn");
    btn.disabled = true;
    try {
        const v = await window.api.validateFiveMPath(currentPath);
        if (!v || !v.valid) {
            toast("المجلد لا يحتوي ملفات FiveM المتوقعة، اختر المجلد الصحيح", "error");
            return;
        }
        const r = await window.api.saveFiveMPath(currentPath);
        if (r && r.success) { savedPath = currentPath; toast("تم حفظ المسار"); }
        else toast("فشل حفظ المسار", "error");
    } catch (e) { console.error(e); toast("فشل الحفظ", "error"); }
    finally { updatePathUI(currentPath, !!savedPath); }
};

$("openModsManager").onclick = () => window.api.openPage("addons.html");

async function checkConnection() {
    const pill = $("connectionStatus").parentElement;
    const r = await window.api.v4.get("/api/v4/config");
    const ok = r && r.success;
    $("connectionStatus").textContent = ok ? "متصل" : "غير متصل";
    pill.className = "status-pill " + (ok ? "online" : "offline");
}

window.addEventListener("keydown", (e) => { if (e.key === "F11") { e.preventDefault(); window.api.fullscreen(); } });

(async () => {
    loadPath();
    checkConnection();
    try {
        const r = await window.api.auth.check();
        $("accountText").textContent = r.success ? `${r.username || "—"} · ${(r.plans || []).join(" + ") || "بدون اشتراك"}` : "غير مسجّل";
    } catch {}
})();
