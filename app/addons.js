/* ==========================================================================
   ADDONS — المودات
   ========================================================================== */
const { ic, esc, toast, confirm: askConfirm } = window.CA;
const $ = (id) => document.getElementById(id);
const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";

const modsPreview = $("modsPreview");
const popup = $("managePopup");
const modsList = $("modsList");

let currentMods = [];
let pendingMods = [];
let userPlans = [];
let sections = [];
let allMods = [];
let activeSection = "all";
let searchQuery = "";

const baseName = (f) => String(f).split(/[\\/]/).pop();
const showNotify = (m, t = "success") => toast(m, t);

async function checkAuth() {
    const r = await window.api.auth.check();
    if (!r.success) { window.api.openPage("login.html"); return false; }
    userPlans = r.plans || [];
    return true;
}

async function fetchModsFromServer() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/mods`);
        const data = await res.json();
        if (!data.success) return false;
        sections = data.sections || [];
        allMods = sections.flatMap((s) => s.mods || []);
        return true;
    } catch (e) { console.error(e); return false; }
}

function updateStats() {
    $("modsCount").textContent = allMods.filter((m) => currentMods.map(baseName).includes(m.file)).length;
    $("totalMods").textContent = allMods.length;
    $("sectionsCount").textContent = sections.length;
}

/* ── prefs / favorites / versions ── */
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
let favs = new Set(lsGet("fav_mods", []));
let installedVer = lsGet("mod_versions", {});
const prefs = { view: lsGet("mods_view", "grid"), density: lsGet("mods_density", "cozy"), sort: lsGet("mods_sort", "default") };
let favOnly = false, selecting = false;
const selected = new Set();

const hasUpdate = (m, installed) => installed && m.version && installedVer[m.file] && String(installedVer[m.file]) !== String(m.version);
const isUnlocked = (section) => (section.requiredPlans || []).some((p) => userPlans.includes(p));

/* ── tabs ── */
function renderTabs() {
    $("mdTabs").innerHTML = [`<button class="tab ${activeSection === "all" ? "active" : ""}" data-section="all">الكل</button>`]
        .concat(sections.map((s) => `<button class="tab ${activeSection === s.title ? "active" : ""}" data-section="${esc(s.title)}">${esc(s.title)}</button>`)).join("");
}
$("mdTabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (!t) return;
    activeSection = t.dataset.section;
    renderTabs();
    renderSections();
});

/* ── toolbar ── */
function syncToolbar() {
    $("sortSel").value = prefs.sort;
    document.querySelectorAll("#viewSeg button").forEach((b) => b.classList.toggle("on", b.dataset.view === prefs.view));
    document.querySelectorAll("#densitySeg button").forEach((b) => b.classList.toggle("on", b.dataset.density === prefs.density));
    $("favOnly").classList.toggle("on", favOnly);
    $("selectMode").classList.toggle("on", selecting);
}
$("sortSel").onchange = (e) => { prefs.sort = e.target.value; lsSet("mods_sort", prefs.sort); renderSections(); };
$("viewSeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; prefs.view = b.dataset.view; lsSet("mods_view", prefs.view); syncToolbar(); renderSections(); };
$("densitySeg").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; prefs.density = b.dataset.density; lsSet("mods_density", prefs.density); syncToolbar(); renderSections(); };
$("favOnly").onclick = () => { favOnly = !favOnly; syncToolbar(); renderSections(); };
$("selectMode").onclick = () => {
    selecting = !selecting;
    if (!selecting) selected.clear();
    syncToolbar(); renderSections(); updateQueueBar();
};

function updateQueueBar() {
    $("queueN").textContent = selected.size;
    $("queueBar").classList.toggle("show", selecting && selected.size > 0);
}
$("queueClear").onclick = () => { selected.clear(); renderSections(); updateQueueBar(); };
$("queueGo").onclick = () => {
    const items = allMods.filter((m) => selected.has(m.file)).map(modPayload);
    if (!items.length) return;
    localStorage.setItem("download_queue", JSON.stringify(items));
    window.api.openPage("downloads.html");
};

/* ── cards ── */
const modPayload = (m) => ({ url: m.url, name: m.name, productId: m.file, type: "mod", fileName: m.file, version: m.version || null });

function sortMods(list) {
    const inst = (m) => currentMods.map(baseName).includes(m.file);
    const by = {
        name: (a, b) => (a.name || "").localeCompare(b.name || "", "ar"),
        installed: (a, b) => inst(b) - inst(a),
        notinstalled: (a, b) => inst(a) - inst(b),
        updates: (a, b) => (hasUpdate(b, inst(b)) ? 1 : 0) - (hasUpdate(a, inst(a)) ? 1 : 0)
    }[prefs.sort];
    return by ? [...list].sort(by) : list;
}

function cardHtml(mod, section, unlocked, installed) {
    const upd = hasUpdate(mod, installed);
    const fav = favs.has(mod.file);
    const sel = selected.has(mod.file);
    const label = !unlocked ? "مقفل" : upd ? "تحديث" : installed ? "إعادة التثبيت" : "تثبيت";
    const icon = !unlocked ? "lock" : installed && !upd ? "refresh" : "download";
    return `
    <article class="mc${installed ? " done" : ""}${unlocked ? "" : " locked"}${sel ? " sel" : ""}" data-file="${esc(mod.file)}" tabindex="0">
        <div class="mc-img"><img src="${esc(mod.img)}" alt="${esc(mod.name)}" loading="lazy"></div>
        ${unlocked ? `<span class="mc-check">${ic("check", "sm")}</span>` : ""}
        <div class="mc-top">
            <button class="fav-btn${fav ? " on" : ""}" data-act="fav" title="مفضلة">${ic("heart", "sm")}</button>
            <div class="mc-tags">
                ${installed ? `<span class="chip ok">${ic("check")}مثبّت</span>` : ""}
                ${upd ? `<span class="chip upd">${ic("refresh")}تحديث</span>` : ""}
                ${mod.isNew && !installed ? `<span class="chip">جديد</span>` : ""}
                ${unlocked ? "" : `<span class="chip warn">${ic("lock")}${esc((section.requiredPlans || []).join(" / "))}</span>`}
            </div>
        </div>
        <div class="mc-body">
            <div class="mc-info">
                <h3 class="mc-name">${esc(mod.name)}</h3>
                <p class="mc-desc">${esc(mod.description || "تحسين جرافيكس عالي الجودة لـ FiveM.")}</p>
            </div>
            <div class="mc-row">
                <button class="cta${installed && !upd || !unlocked ? " ghost" : ""}" data-act="install" ${unlocked ? "" : "disabled"}>${ic(icon)}${label}</button>
                ${mod.size ? `<span class="size-tag">${esc(mod.size)}</span>` : ""}
            </div>
        </div>
    </article>`;
}

function featuredHtml(mod, installed) {
    const upd = hasUpdate(mod, installed);
    return `
    <section class="m-feat" data-file="${esc(mod.file)}">
        <img src="${esc(mod.img)}" alt="${esc(mod.name)}">
        <div class="m-feat-b">
            <span class="chip" style="width:fit-content">${ic("star")}مود مميّز</span>
            <div class="m-feat-name">${esc(mod.name)}</div>
            <div class="m-feat-desc">${esc(mod.description || "")}</div>
            <div class="row">
                <button class="cta${installed && !upd ? " ghost" : ""}" data-act="install">${ic(installed && !upd ? "refresh" : "download")}${upd ? "تحديث" : installed ? "إعادة التثبيت" : "تثبيت"}</button>
                ${mod.size ? `<span class="size-tag">${esc(mod.size)}</span>` : ""}
            </div>
        </div>
    </section>`;
}

/* ── sections ── */
function renderSections() {
    $("mdSkeleton").classList.add("hidden");
    modsPreview.className = (prefs.density === "compact" ? "compact " : "") + (selecting ? "selecting" : "");
    const installedNames = currentMods.map(baseName);
    const list = activeSection === "all" ? sections : sections.filter((s) => s.title === activeSection);
    const q = searchQuery.toLowerCase();
    let html = "", total = 0;

    // المود المميّز: أول مود مفتوح غير مثبّت (أو عليه تحديث) في وضع «الكل» بدون بحث/فلتر
    if (activeSection === "all" && !q && !favOnly) {
        const cand = sections.filter(isUnlocked).flatMap((s) => s.mods || [])
            .find((m) => m.featured) || sections.filter(isUnlocked).flatMap((s) => s.mods || [])
            .find((m) => !installedNames.includes(m.file) || hasUpdate(m, true));
        if (cand) html += featuredHtml(cand, installedNames.includes(cand.file));
    }

    const blocks = [];
    list.forEach((section) => {
        const unlocked = isUnlocked(section);
        let mods = section.mods || [];
        if (q) mods = mods.filter((m) => (m.name || "").toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q));
        if (favOnly) mods = mods.filter((m) => favs.has(m.file));
        if (!mods.length) return;
        mods = sortMods(mods);
        total += mods.length;
        blocks.push(`
        <section class="mod-block">
            <div class="mod-block-head">
                <div class="icon-tile ${unlocked ? "" : "warn"}">${ic(unlocked ? "package" : "lock")}</div>
                <div class="grow">
                    <div class="mod-block-title">${esc(section.title)} <span class="pill ${unlocked ? "ok" : "warn"} plain">${unlocked ? "متاح" : "مقفل"}</span></div>
                    <div class="card-sub">${esc(section.subtitle || "")}</div>
                </div>
                <div class="rating-count">${mods.length} مود</div>
            </div>
            <div class="mods-grid${prefs.view === "list" ? " list" : ""}">
                ${mods.map((m) => cardHtml(m, section, unlocked, installedNames.includes(m.file))).join("")}
            </div>
        </section>`);
    });
    modsPreview.innerHTML = html + blocks.join("");

    const empty = total === 0 && (searchQuery || favOnly);
    $("mdEmpty").classList.toggle("hidden", !empty);
    if (empty) $("mdEmpty").querySelector("p").textContent = favOnly && !searchQuery ? "لم تضف أي مود إلى المفضلة بعد." : "جرّب كلمة بحث أخرى.";
    updateStats();
}

modsPreview.addEventListener("click", (e) => {
    const holder = e.target.closest("[data-file]");
    if (!holder) return;
    const mod = allMods.find((m) => m.file === holder.dataset.file);
    if (!mod) return;
    const act = e.target.closest("[data-act]")?.dataset.act;

    if (act === "fav") {
        favs.has(mod.file) ? favs.delete(mod.file) : favs.add(mod.file);
        lsSet("fav_mods", [...favs]);
        renderSections();
        return;
    }
    if (selecting && holder.classList.contains("mc") && !holder.classList.contains("locked")) {
        selected.has(mod.file) ? selected.delete(mod.file) : selected.add(mod.file);
        holder.classList.toggle("sel", selected.has(mod.file));
        updateQueueBar();
        return;
    }
    if (act === "install") install(mod);
});

function install(mod) {
    localStorage.setItem("pending_download", JSON.stringify(modPayload(mod)));
    window.api.openPage("downloads.html");
}

/* ── manage popup ── */
function setDirty(d) {
    $("manageSaveStatus").textContent = d ? "تغييرات غير محفوظة" : "لا توجد تغييرات";
    $("manageSaveStatus").style.color = d ? "var(--warn)" : "";
}
function closePopup() { popup.classList.add("hidden"); }

$("manageModsBtn").onclick = async () => {
    popup.classList.remove("hidden");
    await syncMods();
    setDirty(false);
};
$("closeManageBtn").onclick = closePopup;
popup.addEventListener("mousedown", (e) => { if (e.target === popup) closePopup(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopup(); });

async function syncMods() {
    try {
        const r = await window.api.getModsList();
        if (!r?.success) return showNotify("تعذّر تحميل قائمة المودات", "error");
        currentMods = Array.isArray(r.files) ? [...r.files] : [];
        pendingMods = [...currentMods];
        updateStats();
        renderModsList();
    } catch { showNotify("فشلت المزامنة", "error"); }
}

function renderModsList() {
    $("manageCount").textContent = pendingMods.length;
    if (!pendingMods.length) {
        modsList.innerHTML = `<div class="empty-line">لا توجد مودات. اضغط «إضافة ملف» للبدء.</div>`;
        return;
    }
    modsList.innerHTML = pendingMods.map((file, i) => {
        const name = baseName(file);
        const data = allMods.find((m) => m.file === name);
        return `
        <div class="manage-row">
            <div class="manage-thumb">${data?.img ? `<img src="${esc(data.img)}" alt="">` : ic("file")}</div>
            <div class="grow" style="min-width:0">
                <div class="manage-name">${esc(data?.name || name)}</div>
                <div class="manage-file ltr">${esc(name)}</div>
            </div>
            <button class="btn btn-sm btn-icon btn-danger" data-rm="${i}" title="إزالة">${ic("x", "sm")}</button>
        </div>`;
    }).join("");
}
modsList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");
    if (!b) return;
    pendingMods.splice(Number(b.dataset.rm), 1);
    setDirty(true);
    renderModsList();
});

$("addModBtn").onclick = async () => {
    const btn = $("addModBtn");
    btn.disabled = true;
    const r = await window.api.addModFile();
    btn.disabled = false;
    if (!r?.success || !r.files?.length) return;

    let added = 0;
    r.files.forEach((fp) => {
        const n = baseName(fp);
        if (!pendingMods.some((f) => baseName(f) === n)) { pendingMods.push(fp); added++; }
    });
    if (added) {
        setDirty(true);
        renderModsList();
        showNotify(`تمت إضافة ${added} ملف`);
    } else showNotify("الملفات موجودة مسبقاً في القائمة", "error");
};

$("deleteAllBtn").onclick = async () => {
    if (!pendingMods.length) return;
    const ok = await askConfirm({
        title: "إزالة كل المودات من القائمة؟",
        message: "لن يُطبَّق الحذف حتى تضغط «حفظ التغييرات».",
        confirmText: "إزالة الكل", danger: true
    });
    if (!ok) return;
    pendingMods = [];
    setDirty(true);
    renderModsList();
};

$("saveModsBtn").onclick = async () => {
    const btn = $("saveModsBtn");
    btn.disabled = true;
    try {
        const r = await window.api.saveMods(pendingMods);
        if (!r?.success) return showNotify("فشل الحفظ", "error");
        currentMods = pendingMods.map(baseName);
        setDirty(false);
        closePopup();
        renderSections();
        showNotify("تم حفظ المودات");
    } catch (e) {
        console.error(e);
        showNotify("فشل الحفظ", "error");
    } finally { btn.disabled = false; }
};

/* ── search ── */
const searchInput = $("modsSearch");
const clearBtn = $("clearSearch");
searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value.trim();
    clearBtn.classList.toggle("hidden-btn", !searchQuery);
    renderSections();
});
clearBtn.addEventListener("click", () => {
    searchInput.value = ""; searchQuery = "";
    clearBtn.classList.add("hidden-btn");
    searchInput.focus();
    renderSections();
});

/* ── init ── */
(async () => {
    if (!(await checkAuth())) return;
    if (!(await fetchModsFromServer())) {
        $("mdSkeleton").classList.add("hidden");
        modsPreview.innerHTML = `<div class="empty"><div class="icon-tile err">${ic("wifi", "lg")}</div><h3>تعذّر تحميل المودات</h3><p>تحقق من اتصالك بالإنترنت ثم أعد فتح الصفحة.</p></div>`;
        return showNotify("فشل تحميل المودات من الخادم", "error");
    }
    await syncMods();
    renderTabs();
    syncToolbar();
    renderSections();
})();
