/* ============================================================
   CA STORE — MODS v2
============================================================ */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const modsPreview = $("modsPreview");
const manageBtn = $("manageModsBtn");
const popup = $("managePopup");
const modsList = $("modsList");
const notify = $("notify");
const modsCount = $("modsCount");
const totalMods = $("totalMods");
const sectionsCount = $("sectionsCount");
const manageCount = $("manageCount");
const manageSaveStatus = $("manageSaveStatus");
const mdTabs = $("mdTabs");
const mdSkeleton = $("mdSkeleton");
const mdEmpty = $("mdEmpty");

let currentMods = [];
let pendingMods = [];
let userPlans = [];
let sections = [];
let allMods = [];
let activeSection = "all";
let searchQuery = "";
let isDirty = false;

const BACKEND_URL = "https://ca-backend-app-production.up.railway.app";

/* ============================================================
   AUTH
============================================================ */
async function checkAuth() {
    const result = await window.api.auth.check();
    if (!result.success) {
        window.api.openPage("login.html");
        return false;
    }
    userPlans = result.plans || [];
    return true;
}

/* ============================================================
   FETCH MODS
============================================================ */
async function fetchModsFromServer() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/mods`);
        const data = await res.json();
        if (data.success) {
            sections = data.sections;
            allMods = sections.flatMap(s => s.mods);
            return true;
        }
        return false;
    } catch (err) {
        console.error("Failed to fetch mods:", err);
        return false;
    }
}

/* ============================================================
   NOTIFY
============================================================ */
function showNotify(msg, type = "success") {
    notify.textContent = msg;
    notify.className = `notification show ${type}`;
    clearTimeout(window._notifyTO);
    window._notifyTO = setTimeout(() => notify.classList.remove("show"), 2400);
}

/* ============================================================
   UPDATE STATS
============================================================ */
function updateStats() {
    if (modsCount) modsCount.textContent = allMods.filter(m => currentMods.includes(m.file)).length;
    if (totalMods) totalMods.textContent = allMods.length;
    if (sectionsCount) sectionsCount.textContent = sections.length;
}

/* ============================================================
   TABS
============================================================ */
function renderTabs() {
    mdTabs.innerHTML = `<button class="md-tab active" data-section="all">All</button>`;
    sections.forEach(s => {
        const btn = document.createElement("button");
        btn.className = "md-tab";
        btn.dataset.section = s.title;
        btn.textContent = s.title;
        mdTabs.appendChild(btn);
    });
    mdTabs.addEventListener("click", e => {
        const tab = e.target.closest(".md-tab");
        if (!tab) return;
        $$(".md-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        activeSection = tab.dataset.section;
        renderSections();
    });
}

/* ============================================================
   RENDER SECTIONS
============================================================ */
function renderSections() {
    mdSkeleton.classList.add("hidden");
    modsPreview.innerHTML = "";

    const filteredSections = activeSection === "all"
        ? sections
        : sections.filter(s => s.title === activeSection);

    let totalCards = 0;

    filteredSections.forEach(section => {
        const unlocked = section.requiredPlans.some(p => userPlans.includes(p));

        let modsToShow = section.mods;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            modsToShow = section.mods.filter(m =>
                m.name.toLowerCase().includes(q) ||
                (m.description || "").toLowerCase().includes(q)
            );
        }
        if (!modsToShow.length) return;

        totalCards += modsToShow.length;

        const el = document.createElement("div");
        el.className = "md-block";

        el.innerHTML = `
            <div class="md-block-header">
                <div class="md-block-left">
                    <div class="md-block-icon" style="--md-block-accent: ${unlocked ? '#4f8cff' : '#666'}">
                        ${section.icon || `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"></rect></svg>`}
                    </div>
                    <div>
                        <div class="md-block-title-row">
                            <h2 class="md-block-title">${section.title}</h2>
                            <span class="md-block-badge ${unlocked ? 'md-badge-unlocked' : 'md-badge-locked'}">${unlocked ? 'UNLOCKED' : 'LOCKED'}</span>
                        </div>
                        <p class="md-block-sub">${section.subtitle}</p>
                    </div>
                </div>
                <div class="md-block-count">${modsToShow.length} Mod${modsToShow.length !== 1 ? 's' : ''}</div>
            </div>
            <div class="md-grid"></div>
        `;

        const grid = el.querySelector(".md-grid");

        modsToShow.forEach((mod, idx) => {
            const installed = currentMods.includes(mod.file);
            const card = document.createElement("div");
            card.className = `md-card ${!unlocked ? 'md-card-locked' : ''}`;
            card.style.setProperty("--md-card-delay", `${idx * 0.04}s`);

            card.innerHTML = `
                <div class="md-card-img-wrap">
                    <img src="${mod.img}" alt="${mod.name}" loading="lazy">
                    <div class="md-card-img-overlay"></div>
                    ${installed ? '<div class="md-card-installed-badge">INSTALLED</div>' : ''}
                    ${!unlocked ? `
                        <div class="md-card-lock-overlay">
                            <div class="md-card-lock-icon">
                                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8">
                                    <rect x="6" y="12" width="16" height="10" rx="2"></rect>
                                    <path d="M10 12v-3a4 4 0 0 1 8 0v3"></path>
                                </svg>
                            </div>
                            <div class="md-card-lock-text">
                                Requires <strong>${section.requiredPlans.join(" / ")}</strong>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="md-card-body">
                    <h3 class="md-card-name">${mod.name}</h3>
                    <p class="md-card-desc">${mod.description || 'High quality graphics enhancement for FiveM.'}</p>
                    <button
                        class="md-card-btn ${unlocked ? (installed ? 'md-btn-reinstall' : 'md-btn-install') : 'md-btn-locked'}"
                        ${unlocked ? `data-file="${mod.file}" data-url="${mod.url}" data-name="${mod.name}"` : 'disabled'}
                    >
                        ${unlocked ? (installed ? 'Reinstall' : 'Install Mod') : 'Locked'}
                    </button>
                </div>
            `;

            if (unlocked) {
                card.querySelector(".md-card-btn").addEventListener("click", () => handleInstall(mod.file, mod.url, mod.name));
            }

            grid.appendChild(card);
        });

        modsPreview.appendChild(el);
    });

    if (!totalCards && searchQuery) {
        mdEmpty.classList.remove("hidden");
    } else {
        mdEmpty.classList.add("hidden");
    }

    updateStats();
}

/* ============================================================
   HANDLE INSTALL
============================================================ */
function handleInstall(file, url, name) {
    localStorage.setItem("pending_download", JSON.stringify({
        url, name,
        productId: file,
        type: "mod",
        fileName: file
    }));
    window.api.openPage("downloads.html");
}

/* ============================================================
   OPEN / CLOSE POPUP
============================================================ */
async function openModsPopup() {
    popup.classList.remove("hidden");
    popup.classList.add("popup-opening");
    await syncMods();
    isDirty = false;
    manageSaveStatus.textContent = "No unsaved changes";
}

manageBtn.onclick = openModsPopup;

$("closeManageBtn").onclick = () => {
    popup.classList.add("hidden");
    popup.classList.remove("popup-opening");
};

popup.addEventListener("click", e => {
    if (e.target === popup) {
        popup.classList.add("hidden");
        popup.classList.remove("popup-opening");
    }
});

/* ============================================================
   SYNC MODS
============================================================ */
async function syncMods() {
    try {
        const result = await window.api.getModsList();
        if (!result?.success) return showNotify("Failed to load mods", "error");

        currentMods = Array.isArray(result.files) ? [...result.files] : [];
        pendingMods = [...currentMods];
        updateStats();
        renderModsList();
    } catch {
        showNotify("Sync failed", "error");
    }
}

/* ============================================================
   RENDER MODS LIST (POPUP)
============================================================ */
function renderModsList() {
    modsList.innerHTML = "";

    if (!pendingMods.length) {
        modsList.innerHTML = `<div class="md-manage-empty">No mods installed yet. Click "Add Mod" to get started.</div>`;
        manageCount.textContent = "0";
        return;
    }

    manageCount.textContent = pendingMods.length;

    pendingMods.forEach((file, idx) => {
        const fileName = file.includes("\\") || file.includes("/")
            ? file.split(/[\\\/]/).pop()
            : file;

        const modData = allMods.find(m => m.file === fileName);
        const row = document.createElement("div");
        row.className = "md-manage-row";
        row.style.setProperty("--row-delay", `${idx * 0.03}s`);

        row.innerHTML = `
            <div class="md-manage-row-left">
                <div class="md-manage-row-icon">
                    ${modData?.img
                        ? `<img src="${modData.img}" alt="">`
                        : `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z"></path></svg>`
                    }
                </div>
                <div>
                    <div class="md-manage-row-name">${modData?.name || fileName}</div>
                    <div class="md-manage-row-file">${fileName}</div>
                </div>
            </div>
            <button class="md-manage-remove-btn" data-file="${file}">
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18"></path><path d="M6 6l12 12"></path>
                </svg>
            </button>
        `;

        row.querySelector(".md-manage-remove-btn").addEventListener("click", () => {
            pendingMods = pendingMods.filter(f => f !== file);
            isDirty = true;
            manageSaveStatus.textContent = "⚠️ Unsaved changes";
            renderModsList();
        });

        modsList.appendChild(row);
    });
}

/* ============================================================
   ADD MOD
============================================================ */
$("addModBtn").onclick = async () => {
    const btn = $("addModBtn");
    btn.disabled = true;

    const result = await window.api.addModFile();
    btn.disabled = false;

    if (!result?.success || !result.files?.length) return;

    let addedCount = 0;
    result.files.forEach(filePath => {
        const fileName = filePath.split(/[\\\/]/).pop();
        const alreadyExists = pendingMods.some(f => {
            const existingName = f.includes("\\") || f.includes("/")
                ? f.split(/[\\\/]/).pop()
                : f;
            return existingName === fileName;
        });
        if (!alreadyExists) {
            pendingMods.push(filePath);
            addedCount++;
        }
    });

    if (addedCount > 0) {
        isDirty = true;
        manageSaveStatus.textContent = "⚠️ Unsaved changes";
        renderModsList();
        showNotify(`${addedCount} mod${addedCount > 1 ? 's' : ''} added`, "success");
    } else {
        showNotify("Already in list", "error");
    }
};

/* ============================================================
   DELETE ALL
============================================================ */
$("deleteAllBtn").onclick = () => {
    if (!pendingMods.length) return;
    pendingMods = [];
    isDirty = true;
    manageSaveStatus.textContent = "⚠️ Unsaved changes";
    renderModsList();
    showNotify("All mods removed from list");
};

/* ============================================================
   SAVE
============================================================ */
$("saveModsBtn").onclick = async () => {
    const btn = $("saveModsBtn");
    btn.disabled = true;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg> Saving...`;

    try {
        const result = await window.api.saveMods(pendingMods);
        if (!result?.success) {
            showNotify("Save failed", "error");
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Failed`;
            return;
        }

        currentMods = pendingMods.map(f =>
            f.includes("\\") || f.includes("/")
                ? f.split(/[\\\/]/).pop()
                : f
        );

        isDirty = false;
        manageSaveStatus.textContent = "✓ Saved";
        updateStats();
        renderSections();
        popup.classList.add("hidden");
        popup.classList.remove("popup-opening");
        showNotify("Mods saved successfully ✅");
    } catch (err) {
        console.error(err);
        showNotify("Save failed", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Changes`;
    }
};

/* ============================================================
   SEARCH
============================================================ */
const searchInput = $("modsSearch");
const clearBtn = $("clearSearch");

function toggleClearBtn() {
    if (searchInput.value.trim()) {
        clearBtn.classList.remove("hidden-btn");
    } else {
        clearBtn.classList.add("hidden-btn");
    }
}

function doSearch() {
    searchQuery = searchInput.value.trim();
    toggleClearBtn();
    renderSections();
}

searchInput.addEventListener("input", doSearch);

clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearBtn.classList.add("hidden-btn");
    searchInput.focus();
    renderSections();
});

// Init hidden state
toggleClearBtn();

/* ============================================================
   LOGOUT
============================================================ */
async function logout() {
    await window.api.auth.logout();
    window.api.openPage("login.html");
}

/* ============================================================
   INIT
============================================================ */
(async () => {
    const authed = await checkAuth();
    if (!authed) return;

    const fetched = await fetchModsFromServer();
    if (!fetched) {
        showNotify("Failed to load mods from server", "error");
        mdSkeleton.classList.add("hidden");
        return;
    }

    await syncMods();
    renderTabs();
    renderSections();
})();
