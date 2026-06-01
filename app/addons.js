const modsPreview = document.getElementById("modsPreview");
const manageBtn = document.getElementById("manageModsBtn");
const popup = document.getElementById("managePopup");
const modsList = document.getElementById("modsList");
const notify = document.getElementById("notify");
const modsCount = document.getElementById("modsCount");

let currentMods = [];  // أسماء الملفات فقط (مثل "European_Roads.rpf")
let pendingMods = [];  // نفس الشيء - أسماء أو paths كاملة للجديدة
let userPlans = [];

/* ============================================================
   AUTH CHECK
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
   MODS DATA
============================================================ */
const sections = [
    {
        title: "Roads",
        subtitle: "تحتاج أي نسخة",
        icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17L9 3l6 14"/><path d="M6 11h6"/></svg>`,
        requiredPlans: ["CA-1", "CA-2", "CA-3" ,"CA-4"],
        mods: [
            { name: "European Roads", file: "European_Roads.rpf", img: "../assets/Europe.png", url: "http://213.199.63.97/European_Roads.rpf" },
            { name: "German Roads", file: "German_Roads.rpf", img: "../assets/German_Roads.png", url: "http://213.199.63.97/German_Roads.rpf" },
            { name: "NVE Roads", file: "Ls_Roads_Pack.rpf", img: "../assets/nve.png", url: "http://213.199.63.97/Ls_Roads_Pack.rpf" },
            { name: "Liberty Roads", file: "Liberty_Roads.rpf", img: "../assets/Liberty.png", url: "http://213.199.63.97/Liberty_Roads.rpf" }
        ]
    },
    {
        title: "Vegetation",
        subtitle: "تحتاج النسخة الثانية أو الثالثة",
        icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22V12"/><path d="M12 12C12 7 7 4 7 4s0 5 5 8"/><path d="M12 12c0-5 5-8 5-8s0 5-5 8"/></svg>`,
        requiredPlans: ["CA-2", "CA-3" ,"CA-4"],
        mods: [
            { name: "Vegetation", file: "CA_Vegetation.rpf", img: "../assets/Extra.png", url: "http://213.199.63.97/CA_Vegetation.rpf" },
            { name: "Extra Vegetation", file: "CA_Extra_Vegetation.rpf", img: "../assets/Extra.png", url: "http://213.199.63.97/CA_Extra_Vegetation.rpf" },
            { name: "Sandy Shores Vegetation", file: "CA_Sandy_Shores_Vegetation.rpf", img: "../assets/Sandy.png", url: "http://213.199.63.97/CA_Sandy_Shores_Vegetation.rpf" }
        ]
    },
    {
        title: "Addons",
        subtitle: "تحتاج النسخة الثانية أو الثالثة",
        icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="5" height="5"/><rect x="10" y="3" width="5" height="5"/><rect x="3" y="10" width="5" height="5"/><rect x="10" y="10" width="5" height="5"/></svg>`,
        requiredPlans: ["CA-2", "CA-3" ,"CA-4"],
        mods: [
            { name: "Halloween Content Pack", file: "CA_Halloween_Pack.rpf", img: "../assets/Halloween Content Pack.jpg", url: "http://213.199.63.97/CA_Halloween_Pack.rpf" },
            { name: "Christmas Content Pack", file: "CA_Christmas_Pack.rpf", img: "../assets/Christmas Content Pack.jpg", url: "http://213.199.63.97/CA_Christmas_Pack.rpf" },
            { name: "Weather FOGGY", file: "CA_Foggy.rpf", img: "../assets/Foggy_Deep Weather.jpg", url: "http://213.199.63.97/CA_Foggy.rpf" },
            { name: "Volumetric Clouds", file: "CA_Volumetric_Clouds.rpf", img: "../assets/vol.png", url: "http://213.199.63.97/CA_Volumetric_Clouds.rpf" },
            { name: "Snowy Mount Chiliad", file: "CA_Snowy_Mount_Chilliad.rpf", img: "../assets/Mount.png", url: "http://213.199.63.97/CA_Snowy_Mount_Chilliad.rpf" }
        ]
    }
];

const allMods = sections.flatMap(s => s.mods);

/* ============================================================
   NOTIFY
============================================================ */
function showNotify(msg, type = "success") {
    notify.textContent = msg;
    notify.className = `notification show ${type}`;
    clearTimeout(window.notifyTimeout);
    window.notifyTimeout = setTimeout(() => notify.classList.remove("show"), 2200);
}

/* ============================================================
   UPDATE COUNT
============================================================ */
function updateModsCount() {
    if (!modsCount) return;
    modsCount.textContent = allMods.filter(m => currentMods.includes(m.file)).length;
}

/* ============================================================
   RENDER SECTIONS
============================================================ */
function renderSections() {

    modsPreview.innerHTML = "";

    sections.forEach(section => {

        const unlocked = section.requiredPlans.some(p => userPlans.includes(p));

        const sectionEl = document.createElement("div");

        sectionEl.style = `
            margin-bottom:42px;
            position:relative;
        `;

        sectionEl.innerHTML = `

            <!-- SECTION HEADER -->
            <div style="
                display:flex;
                align-items:center;
                justify-content:space-between;
                margin-bottom:22px;
                gap:20px;
                flex-wrap:wrap;
            ">

                <div style="
                    display:flex;
                    align-items:center;
                    gap:16px;
                ">

                    <div style="
                        width:54px;
                        height:54px;
                        border-radius:18px;
                        background:${unlocked
                            ? 'linear-gradient(135deg, rgba(79,140,255,.25), rgba(0,255,174,.12))'
                            : 'rgba(255,255,255,.05)'
                        };
                        border:${unlocked
                            ? '1px solid rgba(79,140,255,.25)'
                            : '1px solid rgba(255,255,255,.04)'
                        };
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        color:${unlocked ? '#9fc0ff' : '#666'};
                        backdrop-filter:blur(10px);
                        box-shadow:${unlocked
                            ? '0 0 30px rgba(79,140,255,.12)'
                            : 'none'
                        };
                    ">
                        ${section.icon}
                    </div>

                    <div>

                        <div style="
                            display:flex;
                            align-items:center;
                            gap:10px;
                            flex-wrap:wrap;
                        ">

                            <h2 style="
                                margin:0;
                                font-size:24px;
                                font-weight:800;
                                color:${unlocked ? '#fff' : '#666'};
                                letter-spacing:-0.02em;
                            ">
                                ${section.title}
                            </h2>

                            ${!unlocked ? `
                                <div style="
                                    padding:6px 12px;
                                    border-radius:999px;
                                    background:rgba(255,77,109,.12);
                                    border:1px solid rgba(255,77,109,.18);
                                    color:#ff8ba2;
                                    font-size:11px;
                                    font-weight:700;
                                    letter-spacing:.08em;
                                ">
                                    LOCKED
                                </div>
                            ` : `
                                <div style="
                                    padding:6px 12px;
                                    border-radius:999px;
                                    background:rgba(0,255,174,.12);
                                    border:1px solid rgba(0,255,174,.12);
                                    color:#7dffd2;
                                    font-size:11px;
                                    font-weight:700;
                                    letter-spacing:.08em;
                                ">
                                    UNLOCKED
                                </div>
                            `}

                        </div>

                        <div style="
                            font-size:13px;
                            color:#7d8496;
                            margin-top:6px;
                            font-weight:500;
                        ">
                            ${section.subtitle}
                        </div>

                    </div>

                </div>

                <div style="
                    color:#5e6678;
                    font-size:13px;
                    font-weight:600;
                    padding:10px 16px;
                    border-radius:14px;
                    background:rgba(255,255,255,.03);
                    border:1px solid rgba(255,255,255,.04);
                ">
                    ${section.mods.length} Mods
                </div>

            </div>

            <!-- GRID -->
            <div class="section-grid" style="
                display:grid;
                grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
                gap:22px;
            "></div>

        `;

        const grid = sectionEl.querySelector(".section-grid");

        section.mods.forEach(mod => {

            const installed = currentMods.includes(mod.file);

            const card = document.createElement("div");

            card.className = "pack-card";

            card.style = `
                position:relative;
                overflow:hidden;
                border-radius:26px;
                background:linear-gradient(
                    180deg,
                    rgba(255,255,255,.05),
                    rgba(255,255,255,.025)
                );
                border:1px solid rgba(255,255,255,.06);
                backdrop-filter:blur(18px);
                transition:.28s ease;
                cursor:${unlocked ? 'pointer' : 'not-allowed'};
                opacity:${unlocked ? '1' : '.65'};
                box-shadow:0 10px 35px rgba(0,0,0,.35);
            `;

            card.onmouseenter = () => {
                if (!unlocked) return;

                card.style.transform = "translateY(-6px)";
                card.style.borderColor = "rgba(79,140,255,.22)";
                card.style.boxShadow = "0 18px 45px rgba(79,140,255,.12)";
            };

            card.onmouseleave = () => {
                card.style.transform = "translateY(0px)";
                card.style.borderColor = "rgba(255,255,255,.06)";
                card.style.boxShadow = "0 10px 35px rgba(0,0,0,.35)";
            };

            card.innerHTML = `

                <!-- IMAGE -->
                <div style="
                    position:relative;
                    overflow:hidden;
                    height:180px;
                ">

                    <img src="${mod.img}" style="
                        width:100%;
                        height:100%;
                        object-fit:cover;
                        display:block;
                    ">

                    <div style="
                        position:absolute;
                        inset:0;
                        background:linear-gradient(
                            to top,
                            rgba(8,10,16,.95),
                            rgba(8,10,16,.15)
                        );
                    "></div>

                    ${installed ? `
                        <div style="
                            position:absolute;
                            top:14px;
                            right:14px;
                            padding:8px 12px;
                            border-radius:999px;
                            background:rgba(0,255,174,.15);
                            border:1px solid rgba(0,255,174,.2);
                            color:#7dffd2;
                            font-size:11px;
                            font-weight:700;
                            backdrop-filter:blur(8px);
                        ">
                            INSTALLED
                        </div>
                    ` : ""}

                    ${!unlocked ? `
                        <div style="
                            position:absolute;
                            inset:0;
                            background:rgba(8,10,16,.72);
                            display:flex;
                            flex-direction:column;
                            align-items:center;
                            justify-content:center;
                            gap:14px;
                            color:#fff;
                            backdrop-filter:blur(5px);
                        ">

                            <div style="
                                width:62px;
                                height:62px;
                                border-radius:18px;
                                background:rgba(255,255,255,.08);
                                display:flex;
                                align-items:center;
                                justify-content:center;
                            ">
                                <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8">
                                    <rect x="6" y="12" width="16" height="10" rx="2"></rect>
                                    <path d="M10 12v-3a4 4 0 0 1 8 0v3"></path>
                                </svg>
                            </div>

                            <div style="
                                text-align:center;
                                font-size:13px;
                                color:#d2d6df;
                                line-height:1.7;
                                padding:0 18px;
                            ">
                                Requires:
                                <br>
                                <span style="
                                    color:#fff;
                                    font-weight:700;
                                ">
                                    ${section.requiredPlans.join(" / ")}
                                </span>
                            </div>

                        </div>
                    ` : ""}

                </div>

                <!-- BODY -->
                <div style="
                    padding:20px;
                ">

                    <div style="
                        display:flex;
                        align-items:flex-start;
                        justify-content:space-between;
                        gap:10px;
                        margin-bottom:14px;
                    ">

                        <div>

                            <div style="
                                font-size:17px;
                                font-weight:800;
                                color:#fff;
                                line-height:1.4;
                            ">
                                ${mod.name}
                            </div>

                            <div style="
                                margin-top:8px;
                                color:#7b8497;
                                font-size:13px;
                                line-height:1.7;
                            ">
                                High quality graphics enhancement package for FiveM.
                            </div>

                        </div>

                    </div>

                    <button
                        class="pack-btn"
                        ${unlocked
                            ? `onclick="handleMod('${mod.file}', '${mod.url}', '${mod.name}')"`
                            : "disabled"
                        }
                        style="
                            width:100%;
                            height:48px;
                            border:none;
                            border-radius:16px;
                            font-size:14px;
                            font-weight:700;
                            transition:.25s ease;
                            cursor:${unlocked ? 'pointer' : 'not-allowed'};
                            background:${unlocked
                                ? 'linear-gradient(135deg,#4f8cff,#6ea8ff)'
                                : 'rgba(255,255,255,.05)'
                            };
                            color:${unlocked ? '#fff' : '#777'};
                            box-shadow:${unlocked
                                ? '0 10px 25px rgba(79,140,255,.18)'
                                : 'none'
                            };
                        "
                    >
                        ${unlocked
                            ? installed
                                ? "Reinstall Mod"
                                : "Install Mod"
                            : "Locked"
                        }
                    </button>

                </div>

            `;

            grid.appendChild(card);

        });

        modsPreview.appendChild(sectionEl);

    });

}
/* ============================================================
   HANDLE INSTALL
============================================================ */
async function handleMod(file, url, name) {
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
window.openModsPopup = async () => {
    popup.classList.remove("hidden");
    await syncMods();
};

if (manageBtn) manageBtn.onclick = window.openModsPopup;

const closeBtn = document.getElementById("closeManageBtn");
if (closeBtn) closeBtn.onclick = () => popup.classList.add("hidden");

/* ============================================================
   SYNC MODS - يجيب أسماء الملفات من مجلد mods
============================================================ */
async function syncMods() {
    try {
        const result = await window.api.getModsList();
        if (!result?.success) return showNotify("Failed to load mods", "error");

        // currentMods = أسماء الملفات فقط (بدون path)
        currentMods = Array.isArray(result.files) ? [...result.files] : [];
        pendingMods = [...currentMods];

        updateModsCount();
        renderModsList();
    } catch {
        showNotify("Sync failed", "error");
    }
}

/* ============================================================
   RENDER MODS LIST
============================================================ */
function renderModsList() {
    modsList.innerHTML = "";

    if (!pendingMods.length) {
        modsList.innerHTML = `<div style="padding:25px;text-align:center;color:#777;">No mods installed</div>`;
        return;
    }

    pendingMods.forEach(file => {
        // استخرج اسم الملف فقط للعرض
        const fileName = file.includes("\\") || file.includes("/")
            ? file.split(/[\\\/]/).pop()
            : file;

        const modData = allMods.find(m => m.file === fileName);
        const row = document.createElement("div");
        row.style = "display:flex;justify-content:space-between;align-items:center;padding:10px;margin-bottom:8px;border-radius:12px;background:rgba(255,255,255,.03);";

        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;overflow:hidden;">
                <span style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;">${fileName}</span>
            </div>
            <button class="card-btn delete">Remove</button>
        `;

        row.querySelector("button").onclick = () => {
            pendingMods = pendingMods.filter(f => f !== file);
            renderModsList();
            showNotify("Removed from list");
        };

        modsList.appendChild(row);
    });
}

/* ============================================================
   ADD MOD - يدعم أكثر من ملف مرة وحدة
============================================================ */
document.getElementById("addModBtn").onclick = async () => {
    const btn = document.getElementById("addModBtn");
    btn.disabled = true;

    const result = await window.api.addModFile();
    btn.disabled = false;

    if (!result?.success || !result.files?.length) return;

    let addedCount = 0;

    result.files.forEach(filePath => {
        const fileName = filePath.split(/[\\\/]/).pop();

        // تحقق إذا موجود بالفعل (بالاسم)
        const alreadyExists = pendingMods.some(f => {
            const existingName = f.includes("\\") || f.includes("/")
                ? f.split(/[\\\/]/).pop()
                : f;
            return existingName === fileName;
        });

        if (!alreadyExists) {
            pendingMods.push(filePath); // نحفظ الـ path الكامل
            addedCount++;
        }
    });

    if (addedCount > 0) {
        renderModsList();
        showNotify(`تمت إضافة ${addedCount} ملف`, "success");
    } else {
        showNotify("الملفات موجودة بالفعل", "error");
    }
};

/* ============================================================
   DELETE ALL
============================================================ */
document.getElementById("deleteAllBtn").onclick = () => {
    pendingMods = [];
    renderModsList();
    showNotify("All removed from list");
};

/* ============================================================
   SAVE - يرسل القائمة كما هي (أسماء + paths)
   main.js يتكفل بالتفريق
============================================================ */
document.getElementById("saveModsBtn").onclick = async () => {
    const btn = document.getElementById("saveModsBtn");
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        const result = await window.api.saveMods(pendingMods);

        if (!result?.success) {
            showNotify("Save failed", "error");
            return;
        }

        // بعد الحفظ، نحدّث currentMods بأسماء الملفات فقط
        currentMods = pendingMods.map(f =>
            f.includes("\\") || f.includes("/")
                ? f.split(/[\\\/]/).pop()
                : f
        );

        updateModsCount();
        renderSections();
        popup.classList.add("hidden");
        showNotify("Saved successfully");

    } catch (err) {
        console.error(err);
        showNotify("Save failed", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }
};

/* ============================================================
   SEARCH
============================================================ */
document.getElementById("modsSearch")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll(".pack-card").forEach(card => {
        const name = card.querySelector(".pack-name")?.textContent?.toLowerCase() || "";
        card.style.display = name.includes(q) ? "" : "none";
    });
});

/* ============================================================
   INIT
============================================================ */
(async () => {
    const authed = await checkAuth();
    if (!authed) return;
    await syncMods();
    renderSections();
})();