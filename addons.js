/* مكتبة المودات v4 — البيانات من /api/v4/library والتثبيت عبر api.lib.* */
const { ic, esc, toast, safeImg, confirm: askConfirm, favs, prefs: P, fmtNum } = window.CA;
const $ = (id) => document.getElementById(id);
const CAT_IC = { road: "road", tree: "tree", car: "car", mountain: "mountain", star: "star", package: "package", layers: "layers" };

let LIB = null, installed = new Set(), activeCat = "all", mode = "mods", q = "", view = P.get("mods_view", "grid"), density = P.get("density", "cozy");
const flt = { open: false, inst: false, upd: false, fav: false };
let busyId = null, selMode = false; const selected = new Set(); let queueRunning = false;
const verMap = () => window.CA.lsGet("mod_versions", {});
const fileKey = (m) => String(m.fileName || "").toLowerCase();
const isInst = (m) => m.fileName && installed.has(fileKey(m));
const hasUpd = (m) => isInst(m) && verMap()[fileKey(m)] && verMap()[fileKey(m)] !== m.version;

function badge(m) {
    const t = [];
    if (m.early) t.push('<span class="badge warn">وصول مبكر</span>');
    if (m.isNew) t.push('<span class="badge ok">جديد</span>');
    if (hasUpd(m)) t.push('<span class="badge warn">تحديث</span>');
    return t.join("");
}
function card(m) {
    const img = safeImg(m.cover), inst = isInst(m), upd = hasUpd(m), busy = busyId === m.id;
    const cat = (LIB.categories || []).find((c) => c.slug === m.category);
    let act;
    if (!m.unlocked) act = `<div class="lock-note">${ic("lock", "sm")}${esc(m.lockReason && m.lockReason.startsWith("plan:") ? "يتطلب " + m.lockReason.slice(5) + " أو أعلى" : "غير متاح لنسختك")}</div>`;
    else if (busy) act = `<div class="dlp"><i id="dlbar-${m.id}"></i></div><div class="dlm"><span id="dltxt-${m.id}">جاري التحضير...</span><button class="link-btn" data-act="cancel">إلغاء</button></div>`;
    else if (upd) act = `<button class="btn btn-upd" data-act="install">${ic("refresh")}تحديث</button><button class="ibtn danger" data-act="remove" title="حذف">${ic("trash")}</button>`;
    else if (inst) act = `<button class="btn btn-ok2" data-act="reinstall">${ic("check")}مثبّت</button><button class="ibtn danger" data-act="remove" title="حذف">${ic("trash")}</button>`;
    else act = `<button class="btn btn-primary" data-act="install">${ic("download")}تثبيت</button>`;
    const planChips = (m.plans || []).length ? (m.plans || []).slice(0, 5).map((p) => `<span class="badge">${esc(p.replace("CA-", "CA"))}</span>`).join("") : '<span class="badge">للجميع</span>';
    return `<div class="mcard ${m.unlocked ? "" : "locked"} ${selected.has(m.id) ? "sel" : ""}" data-id="${m.id}" id="mc-${m.id}">
      <div class="cv">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<div class="ph">${ic(CAT_IC[(cat && cat.icon)] || "package")}</div>`}
        <div class="tg">${cat ? `<span class="badge hi">${esc(cat.name)}</span>` : ""}${badge(m)}</div>
        <button class="fv ${favs.has("mod:" + m.id) ? "on" : ""}" data-act="fav" title="مفضلة">${ic("heart", "sm")}</button></div>
      <div class="cb"><h5>${esc(m.name)}</h5><p>${esc(m.description || "")}</p>
        <div class="meta"><span>${ic("download", "sm")} ${esc(m.sizeLabel || "—")}</span><span>v${esc(m.version || "1")}</span><span>${fmtNum(m.downloads)} تحميل</span></div>
        <div class="plans" style="display:flex;gap:4px;flex-wrap:wrap">${planChips}</div>
        <div class="act">${act}</div></div></div>`;
}

function filtered() {
  let list = (LIB.mods || []).slice();
  if (activeCat !== "all") list = list.filter((m) => m.category === activeCat);
  if (q) { const s = q.toLowerCase(); list = list.filter((m) => (m.name + " " + (m.description || "")).toLowerCase().includes(s)); }
  if (flt.open) list = list.filter((m) => m.unlocked);
  if (flt.inst) list = list.filter(isInst);
  if (flt.upd) list = list.filter(hasUpd);
  if (flt.fav) list = list.filter((m) => favs.has("mod:" + m.id));
  const sort = $("sortSel").value;
  list.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "ar") : sort === "pop" ? (b.downloads || 0) - (a.downloads || 0) : sort === "size" ? (b.sizeBytes || 0) - (a.sizeBytes || 0) : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return list;
}

function renderCats() {
  const all = (LIB.mods || []).length;
  $("cats").innerHTML = `<button class="cat ${activeCat === "all" ? "on" : ""}" data-cat="all">${ic("layers")}كل المودات<em>${all}</em></button>` +
    (LIB.categories || []).map((c) => `<button class="cat ${activeCat === c.slug ? "on" : ""}" data-cat="${esc(c.slug)}">${ic(CAT_IC[c.icon] || "package")}${esc(c.name)}<em>${c.count != null ? c.count : (LIB.mods || []).filter((m) => m.category === c.slug).length}</em></button>`).join("");
}
function renderFeatured() {
  const f = (LIB.mods || []).find((m) => m.featured);
  const box = $("featBox");
  if (!f || mode !== "mods" || activeCat !== "all" || q) { box.innerHTML = ""; return; }
  const img = safeImg(f.cover);
  box.innerHTML = `<div class="feat" ${img ? `style="background-image:url('${esc(img).replace(/'/g, "%27")}')"` : ""}><div><span class="badge hi">مود الأسبوع</span><h3>${esc(f.name)}</h3><p>${esc(f.description || "")}</p></div>${f.unlocked ? `<button class="btn btn-primary" data-feat="${f.id}">${ic("download")}${isInst(f) ? "عرض" : "تثبيت الآن"}</button>` : `<span class="lock-note">${ic("lock", "sm")}غير متاح لنسختك</span>`}</div>`;
}
function renderBundles() {
  const list = LIB.bundles || [];
  $("grid").className = "bundles";
  $("grid").innerHTML = list.map((b) => {
    const mods = (b.modIds || []).map((id) => (LIB.mods || []).find((m) => m.id === id)).filter(Boolean);
    return `<div class="bundle" data-bid="${b.id}"><h5>${esc(b.name)}</h5><p>${esc(b.description || "")}</p><div class="meta" style="display:flex;gap:10px;font-size:11.5px;color:var(--text-3)"><span>${mods.length} مود</span><span>${esc(b.sizeLabel || "")}</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">${mods.slice(0, 6).map((m) => `<span class="badge">${esc(m.name)}</span>`).join("")}</div>${b.unlocked ? `<button class="btn btn-primary" data-bundle="${b.id}">${ic("download")}تثبيت الحزمة</button>` : `<span class="lock-note">${ic("lock", "sm")}غير متاحة لنسختك</span>`}</div>`;
  }).join("");
  $("empty").classList.toggle("hidden", list.length > 0);
}
function render() {
  document.body.classList.toggle("compact", density === "compact");
  renderCats();
  $("bundleN").textContent = (LIB.bundles || []).length ? `(${LIB.bundles.length})` : "";
  if (mode === "bundles") { $("featBox").innerHTML = ""; return renderBundles(); }
  renderFeatured();
  const list = filtered();
  $("grid").className = "mgrid " + (view === "list" ? "list" : "");
  $("grid").innerHTML = list.map(card).join("");
  $("empty").classList.toggle("hidden", list.length > 0);
  updateSel();
}
function updateSel() { $("selBar").classList.toggle("hidden", !selected.size); $("selN").textContent = selected.size; }

/* ── التثبيت ── */
async function doInstall(m, { silent } = {}) {
  if (busyId) { toast("هناك عملية جارية، انتظر حتى تنتهي", "error"); return { success: false }; }
  const pf = await window.api.lib.preflight({ type: "mod", id: m.id });
  if (!pf.success && pf.code === "NO_FIVEM") { toast("حدّد مسار FiveM من الإعدادات أولاً", "error"); return pf; }
  if (!pf.success && pf.code === "NO_SPACE") { toast("المساحة الحرة لا تكفي لتثبيت هذا المود", "error"); return pf; }
  if (!silent && ((pf.conflicts || []).length || (pf.warnings || []).length)) {
    const ok = await askConfirm({ title: `تثبيت «${m.name}»`, message: (pf.conflicts || []).length ? "هذا المود يتعارض مع مودات مثبّتة عندك" : "تنبيهات قبل التثبيت", details: [...(pf.conflicts || []).map((c) => "يتعارض مع: " + c.name), ...(pf.warnings || [])], confirmText: "متابعة التثبيت" });
    if (!ok) return { success: false, canceled: true };
  }
  busyId = m.id; render();
  const r = await window.api.lib.install({ type: "mod", id: m.id, overwrite: true });
  busyId = null;
  if (r && r.success) {
    const vm = verMap(); vm[fileKey(m)] = m.version; window.CA.lsSet("mod_versions", vm);
    installed.add(fileKey(m)); toast(`تم تثبيت ${m.name}`);
    try { const t = JSON.parse(localStorage.getItem("download_history") || "[]"); t.unshift({ name: m.name, type: "mod", at: Date.now(), ok: true }); localStorage.setItem("download_history", JSON.stringify(t.slice(0, 50))); } catch {}
  } else if (!(r && r.canceled)) toast((r && r.message) || "فشل التثبيت", "error", 4500);
  render(); return r;
}
window.api.onDownloadProgress((d) => {
  if (!busyId) return;
  const b = $("dlbar-" + busyId), t = $("dltxt-" + busyId);
  if (b) b.style.width = d.percent + "%";
  if (t) t.textContent = `${d.percent}%` + (d.speed && d.speed !== "0" ? ` · ${d.speed} MB/s` : "");
});
window.api.onInstallStatus((d) => { const t = busyId && $("dltxt-" + busyId); if (t && d.msg) t.textContent = d.msg; });

async function runQueue() {
  if (queueRunning) return; queueRunning = true;
  const ids = [...selected]; let ok = 0;
  for (const id of ids) { const m = LIB.mods.find((x) => x.id === id); if (!m || !m.unlocked) continue; const r = await doInstall(m, { silent: true }); if (r && r.success) ok++; selected.delete(id); if (r && r.code === "NO_FIVEM") break; }
  queueRunning = false; selMode = false; selected.clear(); render(); toast(`اكتمل تثبيت ${ok} من ${ids.length}`, ok === ids.length ? "success" : "error");
}

/* ── الأحداث ── */
$("grid").addEventListener("click", async (e) => {
  const bt = e.target.closest("[data-bundle]");
  if (bt) {
    const b = LIB.bundles.find((x) => x.id === Number(bt.dataset.bundle));
    const ok = await askConfirm({ title: `تثبيت حزمة «${b.name}»`, message: `سيتم تثبيت ${(b.modIds || []).length} مود بالتتابع.`, confirmText: "تثبيت الحزمة" });
    if (!ok) return; bt.disabled = true; toast("جاري تثبيت الحزمة...", "info", 2500);
    const r = await window.api.lib.installBundle(b.id); const okN = (r.results || []).filter((x) => x.ok).length;
    toast(`تم تثبيت ${okN} من ${(r.results || []).length}`, r.success ? "success" : "error"); await refreshInstalled(); render(); return;
  }
  const c = e.target.closest(".mcard"); if (!c) return;
  const m = LIB.mods.find((x) => x.id === Number(c.dataset.id)); if (!m) return;
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (act === "fav") { const on = favs.toggle("mod:" + m.id); e.target.closest(".fv").classList.toggle("on", on); }
  else if (act === "install" || act === "reinstall") { if (act === "reinstall") { const ok = await askConfirm({ title: "إعادة تثبيت المود؟", message: `سيتم استبدال ملف «${m.name}» الحالي.`, confirmText: "إعادة التثبيت" }); if (!ok) return; } doInstall(m, { silent: act === "reinstall" }); }
  else if (act === "remove") { const ok = await askConfirm({ title: "حذف المود؟", message: `سيتم حذف «${m.name}» من مجلد اللعبة.`, confirmText: "حذف", danger: true }); if (!ok) return; const r = await window.api.lib.remove({ type: "mod", id: m.id }); if (r.success) { installed.delete(fileKey(m)); toast("تم الحذف"); render(); } else toast(r.message || "فشل الحذف", "error"); }
  else if (act === "cancel") { window.api.cancelDownload(); }
  else if (selMode && m.unlocked) { if (selected.has(m.id)) selected.delete(m.id); else selected.add(m.id); render(); }
});
$("featBox").addEventListener("click", (e) => { const b = e.target.closest("[data-feat]"); if (!b) return; const m = LIB.mods.find((x) => x.id === Number(b.dataset.feat)); if (m && !isInst(m)) doInstall(m); else focusCard(m.id); });
$("cats").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (!b) return; activeCat = b.dataset.cat; mode = "mods"; syncMode(); render(); });
$("modeChips").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (!b) return; mode = b.dataset.mode; syncMode(); render(); });
function syncMode() { $("modeChips").querySelectorAll(".cchip").forEach((x) => x.classList.toggle("on", x.dataset.mode === mode)); }
$("q").addEventListener("input", (e) => { q = e.target.value.trim(); render(); });
$("sortSel").addEventListener("change", render);
$("viewSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (!b) return; view = b.dataset.view; P.set("mods_view", view); $("viewSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); render(); });
$("densitySeg").addEventListener("click", (e) => { const b = e.target.closest("[data-d]"); if (!b) return; density = b.dataset.d; P.set("density", density); $("densitySeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); render(); });
[["fOpen", "open"], ["fInst", "inst"], ["fUpd", "upd"], ["fFav", "fav"]].forEach(([id, k]) => $(id).addEventListener("change", (e) => { flt[k] = e.target.checked; render(); }));
$("selClear").addEventListener("click", () => { selected.clear(); selMode = false; render(); });
$("selGo").addEventListener("click", runQueue);
document.addEventListener("keydown", (e) => { if (e.key === "Shift") { selMode = true; } });
$("grid").addEventListener("dblclick", (e) => { const c = e.target.closest(".mcard"); if (c && !e.target.closest("button")) { const id = Number(c.dataset.id); const m = LIB.mods.find((x) => x.id === id); if (m && m.unlocked) { selMode = true; selected.add(id); render(); } } });

function focusCard(id) { const el = $("mc-" + id); if (!el) return; el.scrollIntoView({ block: "center", behavior: "smooth" }); el.style.outline = "2px solid var(--silver)"; setTimeout(() => (el.style.outline = ""), 2200); }
async function refreshInstalled() { const r = await window.api.lib.installed(); installed = new Set(((r && r.mods) || []).map((x) => x.toLowerCase())); }

/* ── ملفاتي ── */
const popup = $("managePopup");
async function openManage() {
  popup.classList.remove("hidden");
  const r = await window.api.getModsList(); const files = (r && r.files) || [];
  $("manageCount").textContent = files.length;
  $("modsList").innerHTML = files.length ? files.map((f) => { const m = (LIB.mods || []).find((x) => fileKey(x) === f.toLowerCase()); return `<div class="manage-row"><div class="manage-thumb">${m && safeImg(m.cover) ? `<img src="${esc(safeImg(m.cover))}" alt="">` : ic("file")}</div><div class="grow" style="min-width:0"><div class="manage-name">${esc(m ? m.name : f)}</div><div class="manage-file ltr">${esc(f)}</div></div><button class="btn btn-sm btn-icon btn-danger" data-rm="${esc(f)}">${ic("trash", "sm")}</button></div>`; }).join("") : `<div class="empty-line">لا توجد ملفات مود في مجلد اللعبة.</div>`;
}
$("manageBtn").addEventListener("click", openManage);
$("closeManageBtn").addEventListener("click", () => popup.classList.add("hidden"));
popup.addEventListener("mousedown", (e) => { if (e.target === popup) popup.classList.add("hidden"); });
$("modsList").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-rm]"); if (!b) return;
  const ok = await askConfirm({ title: "حذف الملف؟", message: b.dataset.rm, confirmText: "حذف", danger: true }); if (!ok) return;
  const r = await window.api.lib.remove({ type: "mod", fileName: b.dataset.rm }); if (r.success) { await refreshInstalled(); openManage(); render(); } else toast(r.message || "فشل الحذف", "error");
});
$("addModBtn").addEventListener("click", async () => {
  const r = await window.api.addModFile(); if (!r || !r.success || !r.files.length) return;
  const cur = (await window.api.getModsList()).files || [];
  const res = await window.api.saveMods([...cur, ...r.files]);
  if (res && res.success) { toast(`تمت إضافة ${r.files.length} ملف`); await refreshInstalled(); openManage(); render(); } else toast("فشلت الإضافة", "error");
});

/* ── بدء ── */
(async () => {
  const S = await window.CA.ready; if (!S) return;
  const [L] = await Promise.all([window.CA.getLibrary(true), refreshInstalled().catch(() => {})]);
  if (!L || !L.success) { $("grid").innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon-tile err">${ic("wifi", "lg")}</div><h3>تعذّر تحميل المكتبة</h3><p>${esc((L && L.message) || "تحقق من الاتصال")}</p></div>`; return; }
  LIB = L; $("viewSeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.view === view)); $("densitySeg").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.d === density));
  render();
  const f = (() => { try { const v = sessionStorage.getItem("ca_focus"); sessionStorage.removeItem("ca_focus"); return v; } catch { return null; } })();
  if (f) setTimeout(() => focusCard(Number(f)), 300);
})();
