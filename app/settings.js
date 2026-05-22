const notify = document.getElementById("notify");

const pathValue = document.getElementById("pathValue");

const selectPathBtn = document.getElementById("selectPathBtn");
const savePathBtn = document.getElementById("savePathBtn");

const openModsManager = document.getElementById("openModsManager");

const pathStatusText = document.getElementById("pathStatusText");
const pathStatusDot = document.getElementById("pathStatusDot");

const currentFolderName = document.getElementById("currentFolderName");
const currentFolderPath = document.getElementById("currentFolderPath");

const connectionStatus = document.getElementById("connectionStatus");
const connectionDot = document.getElementById("connectionDot");

const systemBadge = document.getElementById("systemBadge");

let currentPath = "";

/* ============================================================
   LOAD SAVED PATH
============================================================ */

async function loadPath() {

    try {

        const result = await window.api.getFiveMPath();

        if (result?.success && result.path) {

            currentPath = result.path;

            pathValue.textContent = result.path;

            updatePathUI(true, result.path);

        } else {

            currentPath = "";

            pathValue.textContent = "No path selected";

            updatePathUI(false);
        }

    } catch (err) {

        console.error(err);

        currentPath = "";

        pathValue.textContent = "Failed to load path";

        updatePathUI(false);
    }
}

/* ============================================================
   UPDATE PATH UI
============================================================ */

function updatePathUI(valid, path = "") {

    if (pathStatusText) {

        pathStatusText.textContent = valid
            ? "FiveM Path Connected"
            : "Path Not Configured";
    }

    if (pathStatusDot) {

        pathStatusDot.style.background = valid
            ? "#00ffae"
            : "#ff4d6a";
    }

    if (systemBadge) {

        systemBadge.textContent = valid
            ? "SYSTEM READY"
            : "SETUP REQUIRED";

        systemBadge.style.color = valid
            ? "#00ffae"
            : "#ffb347";

        systemBadge.style.borderColor = valid
            ? "rgba(0,255,174,0.22)"
            : "rgba(255,179,71,0.22)";

        systemBadge.style.background = valid
            ? "rgba(0,255,174,0.08)"
            : "rgba(255,179,71,0.08)";
    }

    if (currentFolderName) {

        if (!valid || !path) {

            currentFolderName.textContent = "No Folder Selected";

        } else {

            const splitPath = path.split(/[/\\]/);

            currentFolderName.textContent =
                splitPath[splitPath.length - 1] || "FiveM";
        }
    }

    if (currentFolderPath) {

        currentFolderPath.textContent = valid
            ? path
            : "Select your FiveM application data folder";
    }
}

/* ============================================================
   SELECT PATH
============================================================ */

if (selectPathBtn) {

    selectPathBtn.onclick = async () => {

        try {

            const result = await window.api.selectFolder();

            if (!result?.success || !result.path) return;

            currentPath = result.path;

            pathValue.textContent = result.path;

            updatePathUI(true, result.path);

            showNotify("Path selected successfully");

        } catch (err) {

            console.error(err);

            showNotify("Failed to select path", "error");
        }
    };
}

/* ============================================================
   SAVE PATH
============================================================ */

if (savePathBtn) {

    savePathBtn.onclick = async () => {

        try {

            if (!currentPath) {

                showNotify("Select a valid path", "error");
                return;
            }

            savePathBtn.disabled = true;

            savePathBtn.innerText = "Saving...";

            const result = await window.api.saveFiveMPath(currentPath);

            if (result?.success) {

                updatePathUI(true, currentPath);

                showNotify("Path saved successfully");

            } else {

                showNotify("Failed to save path", "error");
            }

        } catch (err) {

            console.error(err);

            showNotify("Save failed", "error");

        } finally {

            savePathBtn.disabled = false;

            savePathBtn.innerText = "Save Path";
        }
    };
}

/* ============================================================
   OPEN MODS MANAGER
============================================================ */

if (openModsManager) {

    openModsManager.onclick = () => {

        window.api.openPage("addons.html");
    };
}

/* ============================================================
   CONNECTION STATUS
============================================================ */

async function checkConnection() {

    try {

        await fetch("https://www.google.com", {
            mode: "no-cors"
        });

        if (connectionStatus) {

            connectionStatus.textContent = "Online";

            connectionStatus.style.color = "#00ffae";
        }

        if (connectionDot) {

            connectionDot.style.background = "#00ffae";
        }

    } catch {

        if (connectionStatus) {

            connectionStatus.textContent = "Offline";

            connectionStatus.style.color = "#ff4d6a";
        }

        if (connectionDot) {

            connectionDot.style.background = "#ff4d6a";
        }
    }
}

/* ============================================================
   NOTIFICATION SYSTEM
============================================================ */

function showNotify(msg, type = "success") {

    if (!notify) return;

    notify.textContent = msg;

    notify.className = `notification show ${type}`;

    clearTimeout(window.notifyTimer);

    window.notifyTimer = setTimeout(() => {

        notify.classList.remove("show");

    }, 2500);
}

/* ============================================================
   AUTO DETECT FULLSCREEN
============================================================ */

window.addEventListener("keydown", (e) => {

    if (e.key === "F11") {

        e.preventDefault();

        window.api.fullscreen();
    }
});

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

    await loadPath();

    await checkConnection();

})();