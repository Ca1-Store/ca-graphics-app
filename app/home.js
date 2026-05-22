/* =========================================================
   ELEMENTS
========================================================= */

const packsCount = document.getElementById("packsCount");
const modsCount = document.getElementById("modsCount");
const reshadeStatus = document.getElementById("reshadeStatus");
const lastUpdate = document.getElementById("lastUpdate");

const welcomeName = document.getElementById("welcomeName");
const welcomePlan = document.getElementById("welcomePlan");

const fivemStatus = document.getElementById("fivemStatus");
const pathsStatus = document.getElementById("pathsStatus");

const connectionStatus = document.getElementById("connectionStatus");
const connectionPill = document.getElementById("connectionPill");
const connectionBar = document.getElementById("connectionBar");

/* =========================================================
   AUTH
========================================================= */

async function checkAuth() {

    const result = await window.api.auth.check();

    if (!result.success) {
        window.api.openPage("login.html");
        return false;
    }

    if (welcomeName) {
        welcomeName.textContent = result.username || "User";
    }

    if (welcomePlan) {

        const plans = result.plans || [];

        welcomePlan.textContent =
            plans.length > 0
                ? plans.join(" + ")
                : "No Subscription";

    }

    return result;

}

/* =========================================================
   PACKS
========================================================= */

async function loadPacksCount() {

    const result = await window.api.auth.check();

    if (!result.success) return;

    const plans = result.plans || [];

    if (packsCount) {
        packsCount.textContent = plans.length;
    }

}

/* =========================================================
   MODS
========================================================= */

async function loadModsCount() {

    const result = await window.api.getModsList();

    if (!result.success) {

        if (modsCount) {
            modsCount.textContent = "0";
        }

        return;
    }

    if (modsCount) {
        modsCount.textContent = result.files.length;
    }

}

/* =========================================================
   RESHADE
========================================================= */

async function loadReShadeStatus() {

    const fivem = await window.api.getFiveMPath();

    if (!fivem.success) {

        reshadeStatus.textContent = "Unavailable";
        reshadeStatus.style.color = "#ff4d6a";

        return;
    }

    try {

        const content = await window.api.readFile(`${fivem.path}/CitizenFX.ini`);

        const enabled = content && content.includes("ReShade5=");

        reshadeStatus.textContent = enabled
            ? "Enabled"
            : "Disabled";

        reshadeStatus.style.color = enabled
            ? "#00ffae"
            : "#ff4d6a";

    } catch {

        reshadeStatus.textContent = "Disabled";
        reshadeStatus.style.color = "#ff4d6a";

    }

}

/* =========================================================
   LAST UPDATE
========================================================= */

function loadLastUpdate() {

    const date = localStorage.getItem("last_update");

    if (lastUpdate) {
        lastUpdate.textContent = date || "No Updates";
    }

}

/* =========================================================
   SYSTEM STATUS
========================================================= */

async function loadSystemStatus() {

    const fivem = await window.api.getFiveMPath();

    /* FiveM */

    if (fivem.success) {

        fivemStatus.textContent = "Ready";
        fivemStatus.className = "status-pill online";

        pathsStatus.textContent = fivem.path;

    } else {

        fivemStatus.textContent = "Not Configured";
        fivemStatus.className = "status-pill offline";

        pathsStatus.textContent = "No Path Selected";

    }

    /* Connection */

    fetch("https://www.google.com", {
        mode: "no-cors"
    })

    .then(() => {

        connectionStatus.textContent = "Connected";

        if (connectionPill) {
            connectionPill.textContent = "Online";
            connectionPill.className = "status-pill online";
        }

        if (connectionBar) {
            connectionBar.style.width = "100%";
        }

    })

    .catch(() => {

        connectionStatus.textContent = "Disconnected";

        if (connectionPill) {
            connectionPill.textContent = "Offline";
            connectionPill.className = "status-pill offline";
        }

        if (connectionBar) {
            connectionBar.style.width = "25%";
        }

    });

}

/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

    await window.api.auth.logout();
    window.api.openPage("login.html");

}

/* =========================================================
   INIT
========================================================= */

async function init() {

    const authed = await checkAuth();

    if (!authed) return;

    await loadPacksCount();
    await loadModsCount();
    await loadReShadeStatus();

    loadLastUpdate();

    await loadSystemStatus();

}

init();