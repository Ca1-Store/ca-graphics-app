let packs = [];

const packsContainer = document.getElementById("packsContainer");
const notify         = document.getElementById("notify");

let selectedPack = null;
let userPlans    = [];
let packRatings  = {};
const imageTimers  = {};
const imageIndexes = {};
let currentRating = 0;
let currentUser = null;
let currentDiscordId = null;
const ADMIN_DISCORD_ID = "1336347875206234292";
const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";

function isAdmin() {
    return currentDiscordId === ADMIN_DISCORD_ID;
}

/* ── FETCH PACKS FROM SERVER ── */
async function fetchPacksFromServer() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/packs`);
        const data = await res.json();
        if (data.success) {
            packs = data.packs;
            return true;
        }
        return false;
    } catch (err) {
        console.error("Failed to fetch packs:", err);
        return false;
    }
}

/* ── AUTH ── */
async function checkAuth() {
    const r = await window.api.auth.check();
    if (!r.success) { window.api.openPage("login.html"); return false; }
    userPlans = r.plans || [];
    currentUser = r.username || null;
    currentDiscordId = r.discordId || null;
    return true;
}

/* ── NOTIFY ── */
function showNotify(msg, type = "success") {
    notify.textContent = msg;
    notify.className = `notification show ${type}`;
    setTimeout(() => notify.classList.remove("show"), 3500);
}

/* ── RATINGS ── */
async function loadRatings() {
    const r = await window.api.ratings.get();
    if (r.success) {
        packRatings = r.ratings;
    }
}

function getPackRating(packId) {
    const data = packRatings[packId];
    if (!data || data.totalRatings === 0) {
        return { average: 0, count: 0 };
    }
    return { average: parseFloat(data.averageRating), count: data.totalRatings };
}

function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += `<svg class="rating-star" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        } else {
            stars += `<svg class="rating-star empty" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
        }
    }
    return stars;
}

function openRatingPopup(packId) {
    selectedPack = packs.find(p => p.id === packId);
    if (!selectedPack) return;

    const preview = document.getElementById("ratingPackPreview");
    if (preview) {
        preview.innerHTML = `
            <img class="manage-pack-img" src="${selectedPack.images[0]}" />
            <div>
                <div class="manage-pack-name">${selectedPack.name}</div>
                <div class="manage-pack-sub">Graphics Pack • Level ${selectedPack.level}</div>
            </div>
        `;
    }

    // Reset form
    currentRating = 0;
    document.getElementById("ratingComment").value = "";
    updateStarInputs(0);

    // Load existing comments
    loadPackComments(packId);

    document.getElementById("ratingPopup").classList.remove("hidden");
}

async function loadPackComments(packId) {
    const r = await window.api.ratings.getPack(packId);
    const commentsList = document.getElementById("commentsList");

    if (r.success && r.comments && r.comments.length > 0) {
        commentsList.innerHTML = r.comments.map((c, index) => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-author">${c.username}</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="comment-date">${new Date(c.timestamp).toLocaleDateString('ar-SA')}</div>
                        ${isAdmin() ? `<button class="delete-comment-btn" onclick="deleteComment('${packId}', ${index})">حذف</button>` : ''}
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                    <div class="rating-stars" style="transform:scale(0.8);transform-origin:left;">${renderStars(c.rating || 0)}</div>
                    <span style="font-size:12px;color:rgba(255,255,255,0.4);">${c.rating || 0}/5</span>
                </div>
                <div class="comment-text">${c.comment}</div>
            </div>
        `).join('');
    } else {
        commentsList.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:13px;padding:20px;">لا توجد تعليقات بعد</div>';
    }
}

async function deleteComment(packId, commentIndex) {
    if (!confirm("هل أنت متأكد من حذف هذا التعليق؟")) return;

    const r = await window.api.ratings.deleteComment(packId, commentIndex, currentDiscordId);
    if (r.success) {
        showNotify("✅ تم حذف التعليق بنجاح");
        await loadRatings();
        loadPackComments(packId);
    } else {
        showNotify(`❌ ${r.message}`, "error");
    }
}

function updateStarInputs(rating) {
    const stars = document.querySelectorAll('.rating-star-input');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    currentRating = rating;
}

async function submitRating() {
    if (!selectedPack || currentRating === 0) {
        showNotify("الرجاء اختيار تقييم", "error");
        return;
    }

    const comment = document.getElementById("ratingComment").value;
    const authResult = await window.api.auth.check();
    const username = authResult.success ? (authResult.username || "Anonymous") : "Anonymous";

    const r = await window.api.ratings.submit(selectedPack.id, currentRating, comment, username);
    
    if (r.success) {
        showNotify("✅ تم إرسال تقييمك بنجاح!");
        document.getElementById("ratingPopup").classList.add("hidden");
        
        // Reload ratings and update UI
        await loadRatings();
        loadPacks();
    } else {
        showNotify("❌ فشل إرسال التقييم", "error");
    }
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

    const rating = getPackRating(pack.id);
    const starsHtml = renderStars(rating.average);

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
            <div class="pack-rating">
                <div class="rating-stars">${starsHtml}</div>
                <span class="rating-count">${rating.count > 0 ? `(${rating.count})` : ''}</span>
                ${unlocked ? `<button class="rate-btn" onclick="openRatingPopup('${pack.id}')">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    قيّم
                </button>` : ''}
            </div>
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
            url: "http://213.199.63.97/CA%20-%20L1.exe"
        },
        {
            name: "CA - L2.exe",
            url: "http://213.199.63.97/CA%20-%20L2.exe"
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

    // Fetch packs from server
    const fetched = await fetchPacksFromServer();
    if (!fetched) {
        showNotify("فشل تحميل البيانات من السيرفر", "error");
        return;
    }

    await loadRatings();
    loadPacks();

    // Setup rating stars click handlers
    const starInputs = document.querySelectorAll('.rating-star-input');
    starInputs.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            updateStarInputs(rating);
        });
    });

    // Setup submit button
    document.getElementById('submitRatingBtn').addEventListener('click', submitRating);
}

init();