/* ==========================================================================
   VERSIONS — باكات الجرافيكس
   ========================================================================== */
const { ic, esc, toast, confirm: askConfirm } = window.CA;

const ADMIN_DISCORD_ID = "1336347875206234292";

const packsContainer = document.getElementById("packsContainer");

let packs = [];
let userPlans = [];
let packRatings = {};
let selectedPack = null;
let currentRating = 0;
let currentDiscordId = null;

const selectedVersion = {};   // packId -> version object
const imageTimers = {};
const imageIndexes = {};

const isAdmin = () => currentDiscordId === ADMIN_DISCORD_ID;
const canDeleteComment = (id) => isAdmin() || id === currentDiscordId;
const showNotify = (msg, type = "success") => toast(msg, type);

function fmtDate(d) {
    const t = new Date(d);
    if (isNaN(t)) return esc(d || "");
    return t.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric", numberingSystem: "latn" });
}

/* ── DATA ── */
async function fetchPacksFromServer() {
    try {
        const data = await window.CA.getLibrary(true);
        if (data && data.success) { packs = data.packs || []; return true; }
        return false;
    } catch (err) {
        console.error("Failed to fetch packs:", err);
        return false;
    }
}

async function checkAuth() {
    const S = await window.CA.ready;
    if (!S) return false;
    userPlans = S.plans || [];
    currentDiscordId = S.discordId || null;
    return true;
}

async function loadRatings() {
    try {
        const r = await window.api.ratings.get();
        if (r.success) packRatings = r.ratings || {};
    } catch {}
}

function getPackRating(packId) {
    const d = packRatings[packId];
    if (!d || !d.totalRatings) return { average: 0, count: 0 };
    return { average: parseFloat(d.averageRating) || 0, count: d.totalRatings };
}

function starsHtml(rating) {
    const full = Math.round(rating);
    let out = "";
    for (let i = 0; i < 5; i++) out += `<svg class="i sm star ${i < full ? "on" : ""}" viewBox="0 0 24 24"><use href="#i-star"/></svg>`;
    return out;
}

/* ── VERSIONS ── */
function getPackVersions(pack) {
    if (Array.isArray(pack.versions) && pack.versions.length) return pack.versions;
    return [{
        version: "1.0", date: "—", latest: true, size: "—",
        features: [], changelog: "الإصدار الأولي من الباك", url: pack.url
    }];
}
function currentVersionOf(pack) {
    return selectedVersion[pack.id] || getPackVersions(pack)[0];
}

/* ── CARD ── */
let packFilter = "all";
let packSort = "default";
let packFavs = new Set();
try { packFavs = new Set(JSON.parse(localStorage.getItem("fav_packs") || "[]")); packSort = localStorage.getItem("packs_sort") || "default"; } catch {}
const saveFavs = () => { try { localStorage.setItem("fav_packs", JSON.stringify([...packFavs])); } catch {} };
const MAX_CHIPS = 4;

function createPackCard(pack, unlocked) {
    const card = document.createElement("article");
    card.className = "pk" + (unlocked ? "" : " locked");
    card.dataset.pack = pack.id;

    const versions = getPackVersions(pack);
    const ver = currentVersionOf(pack);
    const rating = getPackRating(pack.id);
    const images = pack.images || [];
    const shown = versions.slice(0, MAX_CHIPS);
    if (!shown.includes(ver)) shown[shown.length - 1] = ver;
    const notes = (ver.features && ver.features.length) ? `<ul>${ver.features.slice(0, 4).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`
        : ver.changelog ? `<p>${esc(ver.changelog)}</p>` : "";

    card.innerHTML = `
        <div class="pk-media">
            ${images[0] ? `<img src="${esc(images[0])}" alt="${esc(pack.name)}">` : `<div class="pk-media-empty">${ic("grid", "xl")}</div>`}
            <div class="pk-corner">${unlocked ? `<button class="fav-btn${packFavs.has(pack.id) ? " on" : ""}" data-act="fav" title="مفضلة">${ic("heart", "sm")}</button>` : ""}<span class="chip ${ver.latest ? "upd" : ""}">v${esc(ver.version)}${ver.latest ? " · الأحدث" : ""}</span></div>
            ${unlocked && images.length > 1 ? `<div class="pk-thumbs">${images.slice(0, 5).map((src, i) => `
                <button class="pk-thumb ${i === 0 ? "active" : ""}" data-act="thumb" data-index="${i}"><img src="${esc(src)}" alt=""></button>`).join("")}</div>` : ""}
            ${!unlocked ? `<div class="pack-lock">${ic("lock", "xl")}<span>هذا الباك غير متاح في اشتراكك</span></div>` : ""}
        </div>

        <div class="pk-b">
            <div class="pk-t">
                <div>
                    <span class="chip ${unlocked ? "ok" : "warn"}">${ic(unlocked ? "check" : "lock")}${unlocked ? "مفتوح لحسابك" : "مقفل"}</span>
                    <div class="pk-name">${esc(pack.name)}</div>
                </div>
                <button class="pk-rate" data-act="${unlocked ? "rate" : "none"}" title="${unlocked ? "قيّم هذا الباك" : ""}">
                    <div class="stars">${starsHtml(rating.average)}</div>
                    <span class="rating-count">${rating.count > 0 ? `${rating.average.toFixed(1)} · ${rating.count} تقييم` : (unlocked ? "قيّم الآن" : "لا تقييمات")}</span>
                </button>
            </div>

            <div class="pk-meta">
                ${unlocked ? `<span>${ic("download", "sm")}${esc(ver.size || "—")}</span><span>${ic("clock", "sm")}${esc(ver.date || "—")}</span>` : ""}
                <span>${ic("gauge", "sm")}المستوى ${esc(pack.level)}</span>
            </div>

            ${unlocked ? `
            <div class="vers">
                ${shown.map((v) => `<button class="ver-chip ${v === ver ? "on" : ""}" data-act="pick" data-index="${versions.indexOf(v)}">v${esc(v.version)}${v.latest ? "<em>الأحدث</em>" : ""}</button>`).join("")}
                ${versions.length > MAX_CHIPS ? `<button class="ver-chip more" data-act="details">${ic("history", "sm")}كل الإصدارات (${versions.length})</button>` : ""}
            </div>
            ${notes ? `<div class="new-box"><h4>ما الجديد في v${esc(ver.version)}</h4>${notes}</div>` : ""}` : ""}

            <div class="pk-act">
                ${unlocked ? `
                    <button class="cta" data-act="install">${ic("download")}تثبيت v${esc(ver.version)}</button>
                    <button class="sq" data-act="details" title="سجل الإصدارات">${ic("history")}</button>
                    <button class="sq" data-act="manage" title="خيارات">${ic("sliders")}</button>
                ` : `<button class="cta ghost" disabled>${ic("lock")}غير متاح في اشتراكك</button>`}
            </div>
        </div>`;

    if (unlocked && images.length > 1) startSlider(pack.id, images, card);
    return card;
}

function showImage(packId, images, card, i) {
    const img = card.querySelector(".pk-media > img");
    if (!img) return;
    imageIndexes[packId] = i;
    img.style.opacity = "0";
    setTimeout(() => {
        img.src = images[i];
        img.style.opacity = "1";
        card.querySelectorAll(".pk-thumb").forEach((t, k) => t.classList.toggle("active", k === i));
    }, 260);
}
function startSlider(packId, images, card) {
    clearInterval(imageTimers[packId]);
    imageIndexes[packId] = 0;
    const n = Math.min(images.length, 5);
    imageTimers[packId] = setInterval(() => {
        if (!card.isConnected) return clearInterval(imageTimers[packId]);
        showImage(packId, images, card, (imageIndexes[packId] + 1) % n);
    }, 4200);
}

function refreshCard(packId) {
    const pack = packs.find((p) => p.id === packId);
    const old = packsContainer.querySelector(`[data-pack="${CSS.escape(packId)}"].pk`);
    if (!pack || !old) return;
    clearInterval(imageTimers[packId]);
    old.replaceWith(createPackCard(pack, pack.unlocked !== false && (pack.unlocked === true || userPlans.includes(pack.plan))));
}

function loadPacks() {
    Object.keys(imageTimers).forEach((id) => clearInterval(imageTimers[id]));
    packsContainer.innerHTML = "";

    if (!packs.length) {
        packsContainer.innerHTML = `<div class="empty">
            <div class="icon-tile">${ic("grid", "lg")}</div><h3>لا توجد باكات حالياً</h3><p>سيتم إضافة باكات جديدة قريباً.</p></div>`;
    }

    let unlockedCount = 0, shown = 0;
    // المفتوحة أولاً
    const dateOf = (p) => new Date(getPackVersions(p)[0].date).getTime() || 0;
    const sorters = {
        default: () => 0,
        rating: (a, b) => getPackRating(b.id).average - getPackRating(a.id).average,
        newest: (a, b) => dateOf(b) - dateOf(a),
        level: (a, b) => (Number(b.level) || 0) - (Number(a.level) || 0)
    };
    const ordered = [...packs].sort((a, b) => ((b.unlocked ? 1 : 0) - (a.unlocked ? 1 : 0)) || (packFavs.has(b.id) - packFavs.has(a.id)) || sorters[packSort](a, b));
    ordered.forEach((pack) => {
        const unlocked = pack.unlocked === true || (pack.unlocked === undefined && userPlans.includes(pack.plan));
        if (unlocked) unlockedCount++;
        if ((packFilter === "open" && !unlocked) || (packFilter === "locked" && unlocked) || (packFilter === "fav" && !packFavs.has(pack.id))) return;
        shown++;
        packsContainer.appendChild(createPackCard(pack, unlocked));
    });
    if (packs.length && !shown) packsContainer.innerHTML = `<div class="empty"><div class="icon-tile">${ic("search", "lg")}</div><h3>لا توجد باكات في هذا الفلتر</h3></div>`;

    document.getElementById("installedPacks").textContent = unlockedCount;
    document.getElementById("totalPacks").textContent = packs.length;
    document.getElementById("currentPlanBadge").textContent = userPlans.join(" + ") || "بدون اشتراك";
}

const sortSel = document.getElementById("packSort");
sortSel.value = packSort;
sortSel.addEventListener("change", () => { packSort = sortSel.value; try { localStorage.setItem("packs_sort", packSort); } catch {} loadPacks(); });
document.getElementById("packFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    packFilter = b.dataset.f;
    document.querySelectorAll("#packFilter button").forEach((x) => x.classList.toggle("on", x === b));
    loadPacks();
});

/* ── CARD EVENTS ── */
packsContainer.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    const card = e.target.closest("[data-pack]");
    if (!el || !card) return;
    const id = card.dataset.pack;
    const pack = packs.find((p) => p.id === id);
    if (!pack) return;

    switch (el.dataset.act) {
        case "pick":
            selectedVersion[id] = getPackVersions(pack)[Number(el.dataset.index)];
            refreshCard(id);
            break;
        case "thumb": {
            const imgs = (pack.images || []).slice(0, 5);
            showImage(id, imgs, card, Number(el.dataset.index));
            startSlider(id, pack.images || [], card);
            imageIndexes[id] = Number(el.dataset.index);
            break;
        }
        case "fav":
            packFavs.has(id) ? packFavs.delete(id) : packFavs.add(id);
            saveFavs();
            loadPacks();
            break;
        case "details": openVersionDetails(id); break;
        case "rate": openRatingPopup(id); break;
        case "install": startInstall(pack); break;
        case "manage": openPackSettings(id); break;
    }
});

/* ── استعادة النسخة الاحتياطية ── */
async function refreshBackupBtn() {
    const btn = document.getElementById("restoreBackupBtn");
    try {
        const r = await window.api.backupInfo();
        btn.disabled = !(r && r.exists);
        btn.title = r && r.exists ? `نسخة بتاريخ ${fmtDate(r.date)}` : "لا توجد نسخة احتياطية بعد (تُنشأ تلقائياً قبل أي تثبيت)";
    } catch { btn.disabled = true; }
}
document.getElementById("restoreBackupBtn").addEventListener("click", async () => {
    const ok = await askConfirm({
        title: "استعادة النسخة الاحتياطية؟",
        message: "سيتم استبدال الجرافيكس الحالية بآخر نسخة احتياطية أُخذت قبل التثبيت.",
        details: ["حذف مجلدات citizen و plugins و mods الحالية", "إعادة المجلدات المحفوظة"], confirmText: "استعادة"
    });
    if (!ok) return;
    const btn = document.getElementById("restoreBackupBtn");
    btn.disabled = true;
    try {
        const r = await window.api.restoreGraphics();
        showNotify(r && r.success ? "تمت استعادة النسخة الاحتياطية" : ((r && r.message) || "فشلت الاستعادة"), r && r.success ? "success" : "error");
    } catch { showNotify("فشلت الاستعادة", "error"); }
    refreshBackupBtn();
});

/* ── INSTALL ── */
async function startInstall(pack) {
    const fivem = await window.api.getFiveMPath();
    if (!fivem.success) {
        showNotify("حدّد مسار FiveM من صفحة الإعدادات أولاً", "error");
        return;
    }
    const ver = currentVersionOf(pack);
    const ok = await askConfirm({
        title: `تثبيت ${pack.name} v${ver.version}`,
        message: "سيتم استبدال الجرافيكس الحالية بهذا الإصدار، وتؤخذ نسخة احتياطية تلقائياً قبل ذلك.",
        details: ["نسخة احتياطية من الجرافيكس الحالية", "حذف مجلدات citizen و plugins و mods الحالية", "تحميل الإصدار المحدد وفك ضغطه", "نسخ الملفات وحمايتها داخل FiveM"],
        confirmText: "ابدأ التثبيت"
    });
    if (!ok) return;

    const pf = await window.api.lib.preflight({ type: "pack", id: pack.id, version: ver.version });
    if (pf && pf.code === "NO_SPACE") { showNotify("المساحة الحرة لا تكفي لتثبيت هذا الباك", "error"); return; }
    localStorage.setItem("pending_download", JSON.stringify({
        name: `${pack.name} v${ver.version}`,
        productId: pack.id,
        type: "pack",
        version: ver.version
    }));
    window.api.openPage("downloads.html");
}

/* ── VERSION DETAILS PANEL ── */
function openVersionDetails(packId) {
    const pack = packs.find((p) => p.id === packId);
    if (!pack) return;
    const versions = getPackVersions(pack);

    document.getElementById("versionDetailsTitle").textContent = pack.name;
    document.getElementById("versionDetailsSubtitle").textContent = "تاريخ الإصدارات والتحديثات";

    document.getElementById("changelogList").innerHTML = versions.map((v) => `
        <div class="changelog-item">
            <div class="changelog-top">
                <span class="changelog-ver">v${esc(v.version)} ${v.latest ? '<span class="pill ok plain">الأحدث</span>' : ""}</span>
                <span class="changelog-date">${esc(v.date || "")}</span>
            </div>
            ${v.changelog ? `<p class="changelog-desc">${esc(v.changelog)}</p>` : ""}
            ${(v.features || []).length ? `<ul class="changelog-features">${v.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        </div>`).join("");

    document.getElementById("comparisonTable").innerHTML = `
        <thead><tr><th></th>${versions.map((v) => `<th>v${esc(v.version)}</th>`).join("")}</tr></thead>
        <tbody>
            <tr><td>الحجم</td>${versions.map((v) => `<td>${esc(v.size || "—")}</td>`).join("")}</tr>
            <tr><td>تاريخ الإصدار</td>${versions.map((v) => `<td>${esc(v.date || "—")}</td>`).join("")}</tr>
            <tr><td>الحالة</td>${versions.map((v) => `<td class="${v.latest ? "hl" : ""}">${v.latest ? "الأحدث" : "سابق"}</td>`).join("")}</tr>
        </tbody>`;

    document.getElementById("versionDetailsOverlay").classList.add("open");
    document.getElementById("versionDetailsPanel").classList.add("open");
}
function closeVersionDetails() {
    document.getElementById("versionDetailsOverlay").classList.remove("open");
    document.getElementById("versionDetailsPanel").classList.remove("open");
}
document.getElementById("versionDetailsOverlay").addEventListener("click", closeVersionDetails);
document.getElementById("versionDetailsClose").addEventListener("click", closeVersionDetails);

/* ── POPUP HELPERS ── */
const show = (id) => document.getElementById(id).classList.remove("hidden");
const hide = (id) => document.getElementById(id).classList.add("hidden");
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => hide(b.dataset.close)));
document.querySelectorAll(".popup").forEach((p) => p.addEventListener("mousedown", (e) => { if (e.target === p) p.classList.add("hidden"); }));
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".popup:not(.hidden)").forEach((p) => p.classList.add("hidden"));
    closeVersionDetails();
});

function previewHtml(pack) {
    const img = (pack.images || [])[0];
    const ver = currentVersionOf(pack);
    return `
        ${img ? `<img src="${esc(img)}" alt="">` : `<div class="icon-tile">${ic("grid")}</div>`}
        <div>
            <div class="preview-name">${esc(pack.name)}</div>
            <div class="preview-sub">باك جرافيكس · المستوى ${esc(pack.level)} · v${esc(ver.version)}</div>
        </div>`;
}

/* ── PACK SETTINGS ── */
function openPackSettings(id) {
    selectedPack = packs.find((p) => p.id === id);
    if (!selectedPack) return;
    document.getElementById("managePackPreview").innerHTML = previewHtml(selectedPack);
    show("packPopup");
}
document.getElementById("closePopup").onclick = () => hide("packPopup");
document.getElementById("reinstallPackBtn").onclick = () => {
    if (!selectedPack) return;
    hide("packPopup");
    startInstall(selectedPack);
};

/* ── MANAGE POPUP ── */
document.getElementById("manageOpenBtn").onclick = () => show("managePopup");

document.getElementById("reshadeBtn").onclick = async () => {
    hide("managePopup");
    showNotify("جاري تفعيل ReShade...", "info");
    try {
        const r = await window.api.enableReshade();
        if (r.alreadyEnabled) showNotify("ReShade مفعّل مسبقاً");
        else if (r.success) showNotify("تم تفعيل ReShade — أعد تشغيل FiveM");
        else showNotify(r.message || "فشل تفعيل ReShade", "error");
    } catch { showNotify("فشل تفعيل ReShade", "error"); }
};

document.getElementById("launchersBtn").onclick = async () => {
    hide("managePopup");
    showNotify("جاري تحميل اللانشرات على سطح المكتب...", "info", 5000);
    try {
        const r = await window.api.downloadLaunchers();
        if (r.success) showNotify("تم تحميل اللانشرات على سطح المكتب");
        else showNotify("فشل تحميل اللانشرات", "error");
    } catch { showNotify("فشل تحميل اللانشرات", "error"); }
};

document.getElementById("deleteBtn").onclick = async () => {
    hide("managePopup");
    const ok = await askConfirm({
        title: "حذف الجرافيكس المثبّتة؟",
        message: "لا يمكن التراجع عن هذا الإجراء.",
        details: ["سيتم حذف مجلد citizen", "سيتم حذف مجلد plugins", "سيتم حذف مجلد mods"],
        confirmText: "نعم، احذف",
        danger: true
    });
    if (!ok) return;
    showNotify("جاري الحذف...", "info");
    try {
        const r = await window.api.deleteGraphics();
        if (r.success) showNotify("تم حذف الجرافيكس");
        else showNotify("فشل الحذف", "error");
    } catch { showNotify("فشل الحذف", "error"); }
};

/* ── RATING ── */
function updateStarInputs(rating, temp = false) {
    document.querySelectorAll("#ratingStarsInput .star-btn").forEach((btn, i) => btn.classList.toggle("active", i < rating));
    if (!temp) currentRating = rating;
}
const starsBox = document.getElementById("ratingStarsInput");
starsBox.addEventListener("click", (e) => {
    const b = e.target.closest(".star-btn");
    if (b) updateStarInputs(Number(b.dataset.rating));
});
starsBox.addEventListener("mouseover", (e) => {
    const b = e.target.closest(".star-btn");
    if (b) updateStarInputs(Number(b.dataset.rating), true);
});
starsBox.addEventListener("mouseleave", () => updateStarInputs(currentRating, true));

function openRatingPopup(packId) {
    selectedPack = packs.find((p) => p.id === packId);
    if (!selectedPack) return;
    document.getElementById("ratingPackPreview").innerHTML = previewHtml(selectedPack);
    currentRating = 0;
    document.getElementById("ratingComment").value = "";
    updateStarInputs(0);
    loadPackComments(packId);
    show("ratingPopup");
}

async function loadPackComments(packId) {
    const commentsList = document.getElementById("commentsList");
    const ratingsList = document.getElementById("ratingsList");
    commentsList.innerHTML = "";
    ratingsList.innerHTML = "";

    let r;
    try { r = await window.api.ratings.getPack(packId); } catch { r = { success: false }; }

    if (r.success && r.comments && r.comments.length) {
        commentsList.innerHTML = r.comments.map((c) => `
            <div class="comment-item">
                <div class="comment-head">
                    <span class="comment-author">${esc(c.username)}</span>
                    <span class="comment-date">${fmtDate(c.created_at)}</span>
                    ${canDeleteComment(c.discord_id) ? `<button class="link-btn danger" data-del-comment="${esc(c.id)}">حذف</button>` : ""}
                </div>
                <div class="stars">${starsHtml(c.rating || 0)}</div>
                ${c.comment ? `<div class="comment-text">${esc(c.comment)}</div>` : ""}
            </div>`).join("");
    } else {
        commentsList.innerHTML = '<div class="empty-line">لا توجد تعليقات بعد</div>';
    }

    if (isAdmin()) {
        ratingsList.innerHTML = `<div class="section-label">كل التقييمات (للإدارة)</div>` +
            (r.success && r.ratings && r.ratings.length
                ? r.ratings.map((x) => `
                    <div class="comment-item">
                        <div class="comment-head">
                            <span class="comment-author">${esc(x.username)}</span>
                            <span class="comment-date">${fmtDate(x.created_at)}</span>
                            <button class="link-btn danger" data-del-rating="${esc(x.id)}">حذف التقييم</button>
                        </div>
                        <div class="stars">${starsHtml(x.rating)}</div>
                    </div>`).join("")
                : '<div class="empty-line">لا توجد تقييمات بعد</div>');
    }
}

document.getElementById("ratingPopup").addEventListener("click", async (e) => {
    const dc = e.target.closest("[data-del-comment]");
    const dr = e.target.closest("[data-del-rating]");
    if (!dc && !dr) return;
    const ok = await askConfirm({
        title: dc ? "حذف هذا التعليق؟" : "حذف هذا التقييم؟",
        confirmText: "حذف", danger: true
    });
    if (!ok || !selectedPack) return;

    const r = dc
        ? await window.api.ratings.deleteComment(dc.dataset.delComment, currentDiscordId)
        : await window.api.ratings.deleteRating(dr.dataset.delRating, currentDiscordId);

    if (r.success) {
        showNotify(dc ? "تم حذف التعليق" : "تم حذف التقييم");
        await loadRatings();
        refreshCard(selectedPack.id);
        loadPackComments(selectedPack.id);
    } else {
        showNotify(r.message || "تعذّر الحذف", "error");
    }
});

document.getElementById("submitRatingBtn").addEventListener("click", async () => {
    if (!selectedPack || currentRating === 0) return showNotify("الرجاء اختيار تقييم أولاً", "error");

    const btn = document.getElementById("submitRatingBtn");
    btn.disabled = true;
    try {
        const comment = document.getElementById("ratingComment").value;
        const auth = await window.api.auth.check();
        const username = auth.success ? (auth.username || "مجهول") : "مجهول";
        const discordId = auth.success ? auth.discordId : null;

        const r = await window.api.ratings.submit(selectedPack.id, currentRating, comment, username, discordId);
        if (r.success) {
            showNotify("تم إرسال تقييمك، شكراً لك");
            hide("ratingPopup");
            await loadRatings();
            refreshCard(selectedPack.id);
        } else {
            showNotify(r.message || "فشل إرسال التقييم", "error");
        }
    } catch {
        showNotify("فشل إرسال التقييم", "error");
    } finally {
        btn.disabled = false;
    }
});

/* ── INIT ── */
(async function init() {
    if (!(await checkAuth())) return;

    packsContainer.innerHTML = Array.from({ length: 3 }, () => '<div class="pk skeleton shimmer-box"></div>').join("");

    if (!(await fetchPacksFromServer())) {
        packsContainer.innerHTML = `<div class="empty" style="grid-column:1/-1">
            <div class="icon-tile err">${ic("wifi", "lg")}</div><h3>تعذّر تحميل الباكات</h3><p>تحقق من اتصالك بالإنترنت ثم أعد فتح الصفحة.</p></div>`;
        return showNotify("فشل تحميل البيانات من الخادم", "error");
    }

    await loadRatings();
    loadPacks();
    refreshBackupBtn();
})();
