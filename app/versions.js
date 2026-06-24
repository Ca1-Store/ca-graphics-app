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

// Version system state
let selectedVersion = {};
let versionDropdowns = {};

function isAdmin() {
    return currentDiscordId === ADMIN_DISCORD_ID;
}

function canDeleteComment(commentDiscordId) {
    // Allow deletion if user is admin or if it's their own comment
    return isAdmin() || commentDiscordId === currentDiscordId;
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
    const ratingsList = document.getElementById("ratingsList");

    // عرض التعليقات
    if (r.success && r.comments && r.comments.length > 0) {
        commentsList.innerHTML = r.comments.map((c) => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-author">${c.username}</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="comment-date">${new Date(c.created_at).toLocaleDateString('ar-SA')}</div>
                        ${canDeleteComment(c.discord_id) ? `<button class="delete-comment-btn" onclick="deleteComment('${packId}', ${c.id})">حذف</button>` : ''}
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

    // عرض التقييمات (للأدمن فقط)
    if (isAdmin() && r.success && r.ratings && r.ratings.length > 0) {
        ratingsList.innerHTML = r.ratings.map((rating) => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-author">${rating.username}</div>
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div class="comment-date">${new Date(rating.created_at).toLocaleDateString('ar-SA')}</div>
                        <button class="delete-comment-btn" onclick="deleteRating('${packId}', ${rating.id})">حذف التقييم</button>
                    </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <div class="rating-stars" style="transform:scale(0.8);transform-origin:left;">${renderStars(rating.rating)}</div>
                    <span style="font-size:12px;color:rgba(255,255,255,0.4);">${rating.rating}/5</span>
                </div>
            </div>
        `).join('');
    } else if (isAdmin()) {
        ratingsList.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.3);font-size:13px;padding:20px;">لا توجد تقييمات بعد</div>';
    }
}

async function deleteComment(packId, commentId) {
    if (!confirm("هل أنت متأكد من حذف هذا التعليق؟")) return;

    const r = await window.api.ratings.deleteComment(commentId, currentDiscordId);
    if (r.success) {
        showNotify("✅ تم حذف التعليق بنجاح");
        await loadRatings();
        loadPacks();
        loadPackComments(packId);
    } else {
        showNotify(`❌ ${r.message}`, "error");
    }
}

async function deleteRating(packId, ratingId) {
    if (!confirm("هل أنت متأكد من حذف هذا التقييم؟")) return;

    const r = await window.api.ratings.deleteRating(ratingId);
    if (r.success) {
        showNotify("✅ تم حذف التقييم بنجاح");
        await loadRatings();
        loadPacks();
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
    const discordId = authResult.success ? authResult.discordId : null;

    const r = await window.api.ratings.submit(selectedPack.id, currentRating, comment, username, discordId);
    
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

/* ── VERSION SYSTEM FUNCTIONS ── */
function getPackVersions(pack) {
    // Use versions from server data
    return pack.versions || [
        {
            version: "1.0",
            date: "2023-09-10",
            latest: true,
            size: "380 MB",
            features: ["الإصدار الأولي", "جرافيكس أساسي"],
            changelog: "الإصدار الأولي من باك الجرافيكس",
            url: pack.url
        }
    ];
}

function toggleVersionDropdown(packId) {
    const dropdown = document.getElementById(`versionDropdown_${packId}`);
    const selector = document.getElementById(`versionSelector_${packId}`);

    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        selector.classList.remove('open');
    } else {
        // Close all other dropdowns
        Object.keys(versionDropdowns).forEach(id => {
            if (id !== packId) {
                const d = document.getElementById(`versionDropdown_${id}`);
                const s = document.getElementById(`versionSelector_${id}`);
                if (d) d.classList.remove('show');
                if (s) s.classList.remove('open');
            }
        });

        dropdown.classList.add('show');
        selector.classList.add('open');
    }
}

function selectVersion(packId, version) {
    selectedVersion[packId] = version;

    // Update UI
    const selectorCurrent = document.getElementById(`versionSelectorCurrent_${packId}`);
    if (selectorCurrent) {
        selectorCurrent.textContent = `v${version.version}`;
    }

    // Update version badge in card corner
    const versionBadge = document.querySelector(`.version-badge[data-pack="${packId}"]`);
    if (versionBadge) {
        versionBadge.innerHTML = `v${version.version}${version.latest ? '<span class="new-tag">جديد</span>' : ''}`;
        if (version.latest) {
            versionBadge.classList.add('new');
        } else {
            versionBadge.classList.remove('new');
        }
    }

    // Update dropdown options
    const dropdown = document.getElementById(`versionDropdown_${packId}`);
    if (dropdown) {
        dropdown.querySelectorAll('.version-option').forEach(opt => {
            opt.classList.remove('active');
            if (opt.dataset.version === version.version) {
                opt.classList.add('active');
            }
        });
    }

    // Update timeline dots
    const pack = packs.find(p => p.id === packId);
    const versions = getPackVersions(pack);
    const timelineDots = document.querySelectorAll(`.version-dot[data-pack="${packId}"]`);
    timelineDots.forEach((dot, index) => {
        dot.classList.remove('active');
        if (versions[index].version === version.version) {
            dot.classList.add('active');
        }
    });

    // Update version info (size, date)
    const versionInfo = document.querySelector(`.version-info[data-pack="${packId}"]`);
    if (versionInfo) {
        const sizeItem = versionInfo.querySelector('.version-info-item:nth-child(1)');
        const dateItem = versionInfo.querySelector('.version-info-item:nth-child(2)');
        if (sizeItem) {
            sizeItem.innerHTML = `
                <svg fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                ${version.size}
            `;
        }
        if (dateItem) {
            dateItem.innerHTML = `
                <svg fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                ${version.date}
            `;
        }
    }

    // Update install button text
    const installBtn = document.querySelector(`.pack-install-btn[data-pack="${packId}"]`);
    if (installBtn) {
        installBtn.textContent = `تثبيت v${version.version}`;
    }

    // Close dropdown
    toggleVersionDropdown(packId);
}

function openVersionDetails(packId) {
    const pack = packs.find(p => p.id === packId);
    if (!pack) return;

    const versions = getPackVersions(pack);

    // Update panel content
    document.getElementById('versionDetailsTitle').textContent = pack.name;
    document.getElementById('versionDetailsSubtitle').textContent = `تاريخ الإصدارات والتحديثات`;

    // Render changelog
    const changelogList = document.getElementById('changelogList');
    changelogList.innerHTML = versions.map(v => `
        <div class="changelog-item">
            <div class="changelog-item-header">
                <div class="changelog-version">v${v.version} ${v.latest ? '<span class="version-option-badge latest">الأحدث</span>' : ''}</div>
                <div class="changelog-date">${v.date}</div>
            </div>
            <div class="changelog-description">${v.changelog}</div>
            <div class="changelog-features">
                ${v.features.map(f => `<div class="changelog-feature">${f}</div>`).join('')}
            </div>
        </div>
    `).join('');

    // Render comparison table
    const comparisonTable = document.getElementById('comparisonTable');
    comparisonTable.innerHTML = `
        <tr class="comparison-row">
            <td class="comparison-cell feature">حجم الملف</td>
            ${versions.map(v => `<td class="comparison-cell">${v.size}</td>`).join('')}
        </tr>
        <tr class="comparison-row">
            <td class="comparison-cell feature">تاريخ الإصدار</td>
            ${versions.map(v => `<td class="comparison-cell">${v.date}</td>`).join('')}
        </tr>
        <tr class="comparison-row">
            <td class="comparison-cell feature">الأداء</td>
            ${versions.map((v, i) => `<td class="comparison-cell ${i === 0 ? 'highlight' : ''}">${i === 0 ? 'محسّن' : 'عادي'}</td>`).join('')}
        </tr>
        <tr class="comparison-row">
            <td class="comparison-cell feature">الإضاءة</td>
            ${versions.map((v, i) => `<td class="comparison-cell ${i === 0 ? 'highlight' : ''}">${i === 0 ? 'محسّنة' : 'أساسية'}</td>`).join('')}
        </tr>
    `;

    // Show panel
    document.getElementById('versionDetailsOverlay').classList.add('open');
    document.getElementById('versionDetailsPanel').classList.add('open');
}

function closeVersionDetails() {
    document.getElementById('versionDetailsOverlay').classList.remove('open');
    document.getElementById('versionDetailsPanel').classList.remove('open');
}

// Close panel when clicking overlay
document.getElementById('versionDetailsOverlay').addEventListener('click', closeVersionDetails);

/* ── CARD ── */
function createPackCard(pack, unlocked) {
    const card = document.createElement("div");
    card.className = "pack-card-v3" + (unlocked ? "" : " locked");

    const rating = getPackRating(pack.id);
    const starsHtml = renderStars(rating.average);
    const versions = getPackVersions(pack);
    const currentVer = selectedVersion[pack.id] || versions[0];

    card.innerHTML = `
        <div class="pack-img-wrap">
            <img id="packImg_${pack.id}" src="${pack.images[0]}"
                style="transition:transform 0.4s ease,opacity 0.6s ease;" />
            <div class="pack-img-gradient"></div>
            
            <div class="version-badge ${currentVer.latest ? 'new' : ''}" data-pack="${pack.id}">
                v${currentVer.version}
                ${currentVer.latest ? '<span class="new-tag">جديد</span>' : ''}
            </div>
            
            ${unlocked ? `
            <div class="version-timeline">
                <span class="version-timeline-label">الإصدارات</span>
                <div class="version-dots">
                    ${versions.map((v, i) => `
                        <div class="version-dot ${v.version === currentVer.version ? 'active' : ''} ${v.latest ? 'latest' : ''}"
                             data-pack="${pack.id}"
                             data-version="${v.version}"
                             onclick="selectVersion('${pack.id}', ${JSON.stringify(v).replace(/"/g, '&quot;')})">
                        </div>
                    `).join('')}
                </div>
                <span class="version-count">${versions.length}</span>
            </div>
            ` : ''}
            
            ${!unlocked ? `
            <div class="pack-lock-cover">
                <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="7" y="13" width="14" height="10" rx="2"></rect>
                    <path d="M11 13v-3a4 4 0 0 1 8 0v3"></path>
                </svg>
                هذا الباك مو في نسختك
            </div>` : ""}
        </div>
        <div class="pack-body-v3">
            <div class="pack-header">
                <div>
                    <div class="pack-name-v3">${pack.name}</div>
                    <div class="pack-category">Graphics Pack • Level ${pack.level}</div>
                </div>
                ${unlocked ? `
                <div class="version-selector" id="versionSelector_${pack.id}" onclick="toggleVersionDropdown('${pack.id}')">
                    <span class="version-selector-current" id="versionSelectorCurrent_${pack.id}">v${currentVer.version}</span>
                    <svg class="version-selector-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M6 9l6 6 6-6"></path>
                    </svg>
                    <div class="version-dropdown" id="versionDropdown_${pack.id}">
                        ${versions.map(v => `
                            <div class="version-option ${v.version === currentVer.version ? 'active' : ''}" 
                                 data-version="${v.version}"
                                 onclick="event.stopPropagation(); selectVersion('${pack.id}', ${JSON.stringify(v).replace(/"/g, '&quot;')})">
                                <div class="version-option-left">
                                    <span class="version-option-number">v${v.version}</span>
                                    <span class="version-option-date">${v.date}</span>
                                </div>
                                ${v.latest ? '<span class="version-option-badge latest">Latest</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
            
            ${unlocked ? `
            <div class="version-info" data-pack="${pack.id}">
                <div class="version-info-item">
                    <svg fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    ${currentVer.size}
                </div>
                <div class="version-info-item">
                    <svg fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    ${currentVer.date}
                </div>
                <div class="version-info-item" style="cursor:pointer;" onclick="openVersionDetails('${pack.id}')">
                    <svg fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                    </svg>
                    عرض التاريخ
                </div>
            </div>
            ` : ''}
            
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
            
            <div class="pack-actions">
                ${unlocked ? `
                <button class="pack-install-btn" data-pack="${pack.id}" onclick="downloadPack('${pack.id}',this)">
                    تثبيت v${currentVer.version}
                </button>
                <button class="pack-manage-btn" onclick="openPackSettings('${pack.id}')" title="Manage">
                    <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="7.5" cy="7.5" r="2.5"/>
                        <path d="M7.5 1v1.5M7.5 11v1.5M1 7.5h1.5M11 7.5h1.5"/>
                    </svg>
                </button>
                ` : `
                <button class="pack-install-btn" style="opacity:0.3;cursor:not-allowed;background:rgba(255,255,255,0.08);" disabled>مقفل</button>
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

    // Get selected version URL
    const currentVer = selectedVersion[id] || getPackVersions(pack)[0];
    const downloadUrl = currentVer.url || pack.url;

    localStorage.setItem("pending_download", JSON.stringify({
        url: downloadUrl,
        name: `${pack.name} v${currentVer.version}`,
        productId: pack.id,
        type: "pack",
        deleteFirst: true,
        version: currentVer.version
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