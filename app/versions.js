const packs = [
    {
        id: "CA1", plan: "CA-1", name: "CA - Pack 1", level: 1,
        images: ["../assets/Ca--Pack.png","../assets/Ca-1.png","../assets/Ca-1v1.png"],
        url: "https://drive.google.com/uc?export=download&id=1epUBOTeQmiwEos5bW6eN1Eim-DEeGtbu"
    },
    {
        id: "CA2", plan: "CA-2", name: "CA - Pack 2", level: 2,
        images: ["../assets/Ca-Pack.png","../assets/Ca-2v2.png","../assets/Ca_Store.png"],
        url: "https://drive.google.com/uc?export=download&id=1q5bAjZY18becBhIbxVhDz1NZh46Fx_VO"
    },
    {
        id: "CA3", plan: "CA-3", name: "CA - Pack 3", level: 3,
        images: ["../assets/ca333.png","../assets/ca3.png","../assets/ca33.png"],
        url: "https://drive.google.com/uc?export=download&id=1p3tCjRyTLGkbXBnlolUsnbEt7jBsZjTm"
    }
       , {
        id: "CA4", plan: "CA-4", name: "CA - Pack 4", level: 4,
        images: ["../assets/ca444.png","../assets/ca4.png","../assets/ca44.png"],
        url: "https://drive.google.com/uc?export=download&id=1UsYRgYfvJLkHMxUvbP_qzmyQd_GT1cEb"
    }

];

const packsContainer = document.getElementById("packsContainer");
const notify         = document.getElementById("notify");

let selectedPack = null;
let userPlans    = [];
const imageTimers  = {};
const imageIndexes = {};

/* ── AUTH ── */
async function checkAuth() {
    const r = await window.api.auth.check();
    if (!r.success) { window.api.openPage("login.html"); return false; }
    userPlans = r.plans || [];
    return true;
}

/* ── NOTIFY ── */
function showNotify(msg, type = "success") {
    notify.textContent = msg;
    notify.className = `notification show ${type}`;
    setTimeout(() => notify.classList.remove("show"), 3500);
}

/* ── SLIDER ── */
function startSlider(packId, images, imgEl) {
    if (images.length <= 1) return;
    imageIndexes[packId] = 0;
    if (imageTimers[packId]) clearInterval(imageTimers[packId]);

    imageTimers[packId] = setInterval(() => {
        imageIndexes[packId] = (imageIndexes[packId] + 1) % images.length;
        imgEl.style.opacity = "0";
        setTimeout(() => {
            imgEl.src = images[imageIndexes[packId]];
            imgEl.style.opacity = "1";
            images.forEach((_, i) => {
                const d = document.getElementById(`dot_${packId}_${i}`);
                if (d) d.className = "pack-dot" + (i === imageIndexes[packId] ? " active" : "");
            });
        }, 600);
    }, 3000);
}

/* ── CARD ── */
function createPackCard(pack, unlocked) {
    const card = document.createElement("div");
    card.className = "pack-card-v2" + (unlocked ? "" : " locked");

    card.innerHTML = `
        <div class="pack-img-wrap">
            <img id="packImg_${pack.id}" src="${pack.images[0]}"
                style="transition:transform 0.4s ease,opacity 0.6s ease;" />
            <div class="pack-img-gradient"></div>
            <div class="pack-level-badge">LEVEL ${pack.level}</div>
            ${unlocked && pack.images.length > 1 ? `
            <div class="pack-dots">
                ${pack.images.map((_,i) => `<div id="dot_${pack.id}_${i}" class="pack-dot${i===0?' active':''}"></div>`).join("")}
            </div>` : ""}
            ${!unlocked ? `
            <div class="pack-lock-cover">
                <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="7" y="13" width="14" height="10" rx="2"></rect>
                    <path d="M11 13v-3a4 4 0 0 1 8 0v3"></path>
                </svg>
                هذا الباك مو في نسختك
            </div>` : ""}
        </div>
        <div class="pack-body-v2">
            <div class="pack-name-v2">${pack.name}</div>
            <div class="pack-meta">
                <span class="pack-status-dot" style="background:${unlocked?'#00ffae':'#ff4d6a'};"></span>
                <span class="pack-meta-tag">${unlocked ? "UNLOCKED" : "LOCKED"} • Graphics Pack</span>
            </div>
            <div class="pack-actions">
                ${unlocked ? `
                <button class="pack-install-btn" onclick="downloadPack('${pack.id}',this)">
                    Install
                </button>
                <button class="pack-manage-btn" onclick="openPackSettings('${pack.id}')" title="Manage">
                    <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="7.5" cy="7.5" r="2.5"/>
                        <path d="M7.5 1v1.5M7.5 11v1.5M1 7.5h1.5M11 7.5h1.5"/>
                    </svg>
                </button>
                ` : `
                <button class="pack-install-btn" style="opacity:0.3;cursor:not-allowed;background:rgba(255,255,255,0.08);" disabled>Locked</button>
                `}
            </div>
        </div>
    `;
    return card;
}

/* ── LOAD PACKS ── */
function loadPacks() {
    Object.keys(imageTimers).forEach(id => clearInterval(imageTimers[id]));
    packsContainer.innerHTML = "";
    let count = 0;

    packs.forEach(pack => {
        const unlocked = userPlans.includes(pack.plan);
        if (unlocked) count++;
        packsContainer.appendChild(createPackCard(pack, unlocked));

        if (unlocked && pack.images.length > 1) {
            const img = document.getElementById(`packImg_${pack.id}`);
            if (img) startSlider(pack.id, pack.images, img);
        }
    });

    const el = document.getElementById("installedPacks");
    if (el) el.textContent = count;

    const badge = document.getElementById("currentPlanBadge");
    if (badge) badge.textContent = userPlans.join(" + ") || "—";
}

/* ── DOWNLOAD ── */
async function downloadPack(id, btn) {
    const pack = packs.find(p => p.id === id);
    if (!pack) return;
    if (btn) { btn.disabled = true; btn.textContent = "جاري..."; }

    localStorage.setItem("pending_download", JSON.stringify({
        url: pack.url, name: pack.name,
        productId: pack.id, type: "pack", deleteFirst: true
    }));
    window.api.openPage("downloads.html");
}

/* ── PACK SETTINGS POPUP ── */
function openPackSettings(id) {
    selectedPack = packs.find(p => p.id === id);
    if (!selectedPack) return;

    const preview = document.getElementById("managePackPreview");
    if (preview) {
        preview.innerHTML = `
            <img class="manage-pack-img" src="${selectedPack.images[0]}" />
            <div>
                <div class="manage-pack-name">${selectedPack.name}</div>
                <div class="manage-pack-sub">Graphics Pack • Level ${selectedPack.level}</div>
            </div>
        `;
    }
    document.getElementById("packPopup").classList.remove("hidden");
}

document.getElementById("closePopup").onclick = () =>
    document.getElementById("packPopup").classList.add("hidden");

document.getElementById("reinstallPackBtn").onclick = () => {
    if (!selectedPack) return;
    document.getElementById("packPopup").classList.add("hidden");
    localStorage.setItem("pending_download", JSON.stringify({
        url: selectedPack.url, name: selectedPack.name,
        productId: selectedPack.id, type: "pack", deleteFirst: true
    }));
    window.api.openPage("downloads.html");
};

/* ── MANAGE POPUP ── */
function openManagePopup() {
    document.getElementById("managePopup").classList.remove("hidden");
}

document.getElementById("reshadeBtn").onclick = async () => {
    document.getElementById("managePopup").classList.add("hidden");
    showNotify("جاري تفعيل ReShade...");
    const r = await window.api.enableReshade();
    if (r.alreadyEnabled) showNotify("ℹ️ ReShade مفعّل مسبقاً", "success");
    else if (r.success) showNotify("✅ تم تفعيل ReShade! أعد تشغيل FiveM", "success");
    else showNotify(`❌ ${r.message || "فشل تفعيل ReShade"}`, "error");
};

document.getElementById("launchersBtn").onclick = async () => {

    document.getElementById("managePopup").classList.add("hidden");

    showNotify("جاري تحميل Launchers على سطح المكتب...");

    const launchers = [
        {
            name: "CA - L1.exe",
            url: "https://drive.google.com/uc?export=download&id=1-WnvUNCVATIOcp8tjiBw5DHssMx_85Ax"
        },
        {
            name: "CA - L2.exe",
            url: "https://drive.google.com/uc?export=download&id=1wmpQhGxRN8y6s5kDPFfKO-Vb32p8AbYS"
        }
    ];

    const r = await window.api.downloadLaunchers(launchers);

    if (r.success) {
        showNotify("✅ تم تحميل الـ Launchers على سطح المكتب", "success");
    } else {
        showNotify("❌ فشل التحميل", "error");
    }

};

document.getElementById("deleteBtn").onclick = async () => {
    document.getElementById("managePopup").classList.add("hidden");
    const ok = confirm("هل تريد حذف الجرافيكس المثبتة؟\nسيتم حذف citizen و plugins و mods.");
    if (!ok) return;
    showNotify("جاري الحذف...");
    const r = await window.api.deleteGraphics();
    if (r.success) showNotify("✅ تم حذف الجرافيكس", "success");
    else showNotify("❌ فشل الحذف", "error");
};

/* ── LOGOUT ── */
async function logout() {
    await window.api.auth.logout();
    window.api.openPage("login.html");
}

/* ── INIT ── */
async function init() {
    const ok = await checkAuth();
    if (!ok) return;
    loadPacks();
}

init();