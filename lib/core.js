/* منطق نقي (بدون Electron) — قابل للاختبار */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SAFE_FILE = /^[\w\-. ()]{1,120}\.(rpf|zip|ini|xml|asi|dll|meta|ytd)$/i;
const APP_PAGES = new Set(["index.html","login.html","addons.html","versions.html","customize.html","downloads.html",
  "settings.html","performance.html","install.html","news.html","profiles.html","diagnostics.html","admin.html","splash.html","sounds.html"]);
const EXTERNAL_HOSTS = ["discord.com", "discord.gg", "github.com", "www.discord.com"];
const MAX_ZIP_ENTRIES = 60000;

function safeFileName(n) {
  const b = path.basename(String(n || "")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim();
  if (!SAFE_FILE.test(b) || b.startsWith(".")) return null;
  return b;
}
function isHttpUrl(u) { try { const x = new URL(String(u)); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; } }
function isAllowedExternal(u) {
  try { const x = new URL(String(u)); return x.protocol === "https:" && EXTERNAL_HOSTS.includes(x.hostname.toLowerCase()); } catch { return false; }
}
function isAppPage(p) { return typeof p === "string" && APP_PAGES.has(p); }
function v4PathOk(p) {
  return typeof p === "string" && p.length < 400 && p.startsWith("/api/v4/") && !/\.\.|\/\/|\\|[\r\n\0\s]/.test(p.slice(1));
}
function sha256File(file) {
  return new Promise((res, rej) => {
    const h = crypto.createHash("sha256");
    fs.createReadStream(file).on("data", (d) => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej);
  });
}
/* فحص أسماء مدخلات الـ zip قبل الاستخراج (zip-slip) */
function zipEntriesSafe(names) {
  if (!Array.isArray(names)) return { ok: false, reason: "invalid" };
  if (names.length > MAX_ZIP_ENTRIES) return { ok: false, reason: "too-many" };
  for (const raw of names) {
    const n = String(raw).replace(/\\/g, "/");
    if (n.includes("\0") || n.startsWith("/") || /^[a-zA-Z]:/.test(n) || n.split("/").includes("..")) return { ok: false, reason: "unsafe:" + n.slice(0, 80) };
  }
  return { ok: true };
}
function needBytes(size) { const s = Number(size) > 0 ? Number(size) : 300 * 1024 * 1024; return Math.ceil(s * 2.5 + 200 * 1024 * 1024); }
function sizeLabel(b) { b = Number(b) || 0; if (b >= 1073741824) return (b / 1073741824).toFixed(2) + " GB"; if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB"; return Math.max(1, Math.round(b / 1024)) + " KB"; }
/* حفظ الجلسة: يقبل cipher={encrypt(str)->Buffer, decrypt(Buffer)->str} أو null */
function encodeSession(obj, cipher) {
  const s = JSON.stringify(obj);
  if (!cipher) return JSON.stringify({ v: 1, plain: s });
  return JSON.stringify({ v: 2, enc: cipher.encrypt(s).toString("base64") });
}
function decodeSession(text, cipher) {
  try {
    const j = JSON.parse(text);
    if (j && j.v === 2 && cipher) return JSON.parse(cipher.decrypt(Buffer.from(j.enc, "base64")));
    if (j && j.v === 1) return JSON.parse(j.plain);
    if (j && j.token) return j; // legacy plain format
  } catch {}
  return null;
}
module.exports = { SAFE_FILE, safeFileName, isHttpUrl, isAllowedExternal, isAppPage, v4PathOk, sha256File, zipEntriesSafe, needBytes, sizeLabel, encodeSession, decodeSession, APP_PAGES };
