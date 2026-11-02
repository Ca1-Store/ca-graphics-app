const { ic, esc } = window.CA;
const btn = document.getElementById("loginBtn");
const statusEl = document.getElementById("loginStatus");
const LABEL = `${ic("discord")}تسجيل الدخول عبر Discord`;

function setStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = `login-status show ${type}`;
}
function reset() { btn.disabled = false; btn.innerHTML = LABEL; }

async function loginWithDiscord() {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>جاري الاتصال...';
    setStatus("أكمل تسجيل الدخول في النافذة المنبثقة...", "loading");
    try {
        const r = await window.api.auth.login();
        if (r && r.success) {
            const plans = Array.isArray(r.plans) ? r.plans.join(" + ") : (r.plan || "");
            btn.innerHTML = ic("check") + "تم تسجيل الدخول";
            setStatus(`أهلاً ${r.username}! نسختك: ${plans || "بدون اشتراك"}`, "success");
            try { sessionStorage.removeItem("ca_user"); } catch {}
            setTimeout(() => window.api.openPage("splash.html"), 1100);
        } else {
            setStatus((r && r.message) || "فشل تسجيل الدخول", "error");
            reset();
        }
    } catch {
        setStatus("خطأ في الاتصال، حاول مرة أخرى", "error");
        reset();
    }
}
btn.addEventListener("click", loginWithDiscord);
window.loginWithDiscord = loginWithDiscord;
