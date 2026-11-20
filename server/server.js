"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const db = require("./db");

const PROD = process.env.NODE_ENV === "production";
const PORT = +process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
if (PROD && !ADMIN_PASSWORD) { console.error("Thieu bien moi truong ADMIN_PASSWORD."); process.exit(1); }
const PASS = ADMIN_PASSWORD || "admin123"; // chi dung khi chay local
const SECRET = process.env.SESSION_SECRET || crypto.createHash("sha256").update("feelia|" + PASS).digest("hex");
const SRC = path.join(__dirname, "..", "src");
const read = (f) => fs.readFileSync(f, "utf8");


/* ---------- dung trang ban hang tu src/ + du lieu trong DB ---------- */
const FONTS = "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&display=swap";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
const jsonIn = (o) => JSON.stringify(o).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
let parts = null;
function loadParts() {
  return {
    css: read(path.join(SRC, "base.css")) + read(path.join(SRC, "admin.css")),
    tpl: read(path.join(SRC, "tpl.html")),
    js: read(path.join(SRC, "app.js")),
    shim: read(path.join(__dirname, "shim.js")),
  };
}
async function renderPage() {
  if (!parts || !PROD) parts = loadParts(); // khi dev, sua src/ la thay ngay
  const s = await db.getStore(), m = await db.getMedia();
  const t = esc(s.shop.title || s.shop.name || "FREE.A"), d = esc(s.shop.desc || "");
  return '<!DOCTYPE html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>' + t + '</title>\n<meta name="description" content="' + d + '">\n<meta property="og:title" content="' + t + '">\n<meta property="og:description" content="' + d + '">\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="' + esc(FONTS) + '" rel="stylesheet">\n<script type="application/json" id="store">\n' + jsonIn(s) + '\n</script>\n<style id="css">' + parts.css + '</style>\n</head>\n<body>\n<template id="tpl">' + parts.tpl + '</template>\n<script type="application/json" id="media">' + jsonIn(m) + '</script>\n<script>' + parts.shim + '</script>\n<script id="app">' + parts.js + '</script>\n</body>\n</html>\n';
}

/* ---------- phien dang nhap (cookie ky HMAC) ---------- */
const sign = (v) => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
function makeToken() { const b = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 864e5 })).toString("base64url"); return b + "." + sign(b); }
function validToken(t) {
  if (typeof t !== "string") return false;
  const [b, sig] = t.split(".");
  if (!b || !sig) return false;
  const want = sign(b);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return false;
  try { return JSON.parse(Buffer.from(b, "base64url").toString()).exp > Date.now(); } catch (_) { return false; }
}
const cookieOf = (req, name) => {
  const m = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : "";
};
const isAdmin = (req) => validToken(cookieOf(req, "fa_s"));
const needAdmin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ code: "not_writer" }));
function sameOrigin(req, res, next) {
  const o = req.headers.origin;
  if (o && new URL(o).host !== req.headers.host) return res.status(403).json({ code: "not_writer" });
  next();
}

/* gioi han so lan goi theo IP, trong bo nho */
function limiter(max, windowMs) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now(), k = req.ip, a = (hits.get(k) || []).filter((t) => now - t < windowMs);
    if (a.length >= max) return res.status(429).json({ code: "rate_limited" });
    a.push(now); hits.set(k, a);
    if (hits.size > 5000) for (const [key, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(key);
    next();
  };
}

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => { res.set("X-Content-Type-Options", "nosniff"); res.set("Referrer-Policy", "same-origin"); next(); });

app.get("/healthz", ah(async (req, res) => res.json({ ok: true, db: db.KIND, ...(await db.counts()) })));
app.get("/", ah(async (req, res) => { res.set("Cache-Control", "no-store").type("html").send(await renderPage()); }));
app.get("/admin", (req, res) => res.set("Cache-Control", "no-store").sendFile(path.join(__dirname, "admin.html")));

app.get("/_blob/:id", ah(async (req, res) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(req.params.id)) return res.sendStatus(404);
  const a = await db.getAsset(req.params.id);
  if (!a) return res.sendStatus(404);
  res.set("Cache-Control", "public, max-age=31536000, immutable").type(a.mime).send(Buffer.from(a.data));
}));

/* ---------- API ---------- */
app.get("/api/me", (req, res) => res.set("Cache-Control", "no-store").json({ admin: isAdmin(req) }));

app.post("/api/login", sameOrigin, limiter(10, 10 * 60e3), express.json({ limit: "2kb" }), (req, res) => {
  const given = Buffer.from(String(req.body && req.body.password || ""));
  const want = Buffer.from(PASS);
  const ok = given.length === want.length && crypto.timingSafeEqual(given, want);
  if (!ok) return res.status(401).json({ code: "bad_password" });
  res.set("Set-Cookie", `fa_s=${encodeURIComponent(makeToken())}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 86400}${PROD ? "; Secure" : ""}`);
  res.json({ ok: true });
});
app.post("/api/logout", sameOrigin, (req, res) => {
  res.set("Set-Cookie", `fa_s=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${PROD ? "; Secure" : ""}`);
  res.json({ ok: true });
});

// Luu cua hang (san pham, ma giam gia, thong tin shop, anh bia/logo).
app.post("/api/publish", sameOrigin, needAdmin, express.json({ limit: "40mb" }), ah(async (req, res) => {
  const { baseRev, store, media } = req.body || {};
  if (!store || typeof store !== "object" || !Array.isArray(store.products) || !store.shop || typeof store.shop !== "object")
    return res.status(400).json({ code: "invalid_content" });
  if (store.products.length > 5000) return res.status(413).json({ code: "too_large" });
  const ids = new Set();
  for (const p of store.products) {
    if (!p || !Number.isInteger(p.id) || p.id <= 0 || ids.has(p.id)) return res.status(400).json({ code: "invalid_content" });
    ids.add(p.id);
  }
  const m = media && typeof media === "object" ? media : { cover: "", logo0: "", logo: "", p: {} };
  const rev = await db.saveStore(store, m, baseRev);
  if (rev === null) return res.status(409).json({ code: "conflict" });
  res.json({ ok: true, rev });
}));

app.post("/api/assets", sameOrigin, needAdmin, express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "8mb" }), ah(async (req, res) => {
  const mime = req.headers["content-type"];
  if (!Buffer.isBuffer(req.body) || !req.body.length || !/^image\/(jpeg|png|webp)$/.test(mime || "")) return res.status(400).json({ code: "invalid_content" });
  res.json({ id: await db.putAsset(req.body, mime) });
}));
app.get("/api/assets", needAdmin, ah(async (req, res) => {
  const assets = await db.listAssets();
  res.json({ assets, usage: { files: assets.length, bytes: assets.reduce((n, a) => n + a.bytes, 0) } });
}));
app.delete("/api/assets/:id", sameOrigin, needAdmin, ah(async (req, res) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(req.params.id)) return res.sendStatus(404);
  res.json({ ok: await db.delAsset(req.params.id) });
}));

// Khach dat hang
const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
app.post("/api/orders", sameOrigin, limiter(20, 3600e3), express.json({ limit: "64kb" }), ah(async (req, res) => {
  const b = req.body || {};
  const o = {
    code: str(b.code, 20), name: str(b.name, 100), phone: str(b.phone, 10), address: str(b.address, 300),
    pay: str(b.pay, 80), note: str(b.note, 300), voucher: str(b.voucher, 20).toUpperCase().replace(/[^A-Z0-9]/g, ""),
    total: Math.max(0, Math.round(+b.total || 0)), text: str(b.text, 4000),
    items: (Array.isArray(b.items) ? b.items : []).slice(0, 50).map((i) => ({
      id: Math.round(+i.id) || 0, ci: Math.max(0, Math.round(+i.ci) || 0), size: str(i.size, 20), qty: Math.min(99, Math.max(1, Math.round(+i.qty) || 1)),
    })),
  };
  if (!/^FA\d{6}-\d{3}$/.test(o.code) || o.name.length < 2 || !/^0\d{9}$/.test(o.phone) || o.address.length < 10 || !o.items.length)
    return res.status(400).json({ code: "invalid_content" });
  await db.addOrder(o);
  res.json({ ok: true });
}));
const STATUS = ["new", "confirmed", "shipping", "done", "cancelled"];
app.get("/api/orders", needAdmin, ah(async (req, res) => res.set("Cache-Control", "no-store").json({ orders: await db.listOrders(), counts: await db.counts() })));
app.patch("/api/orders/:id", sameOrigin, needAdmin, express.json({ limit: "1kb" }), ah(async (req, res) => {
  const s = req.body && req.body.status;
  if (!STATUS.includes(s)) return res.status(400).json({ code: "invalid_content" });
  res.json({ ok: await db.setOrderStatus(+req.params.id, s) });
}));
app.delete("/api/orders/:id", sameOrigin, needAdmin, ah(async (req, res) => res.json({ ok: await db.deleteOrder(+req.params.id) })));

// Tai ban sao luu co so du lieu: JSON gom cua hang + don hang (khong gom anh).
app.get("/api/backup", needAdmin, ah(async (req, res) => {
  res.set("Content-Disposition", 'attachment; filename="feelia-backup.json"').json({ store: await db.getStore(), orders: await db.listOrders(100000) });
}));

app.use((err, req, res, next) => {
  if (err && err.type === "entity.too.large") return res.status(413).json({ code: "too_large" });
  if (err) console.error(err);
  res.status(err && err.status ? err.status : 500).json({ code: "upstream_error" });
});

db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`FREE.A chay tai http://localhost:${PORT}  (quan tri: /admin, san pham: /#quan-tri)`);
    console.log("DB: " + db.DESC);
    if (!ADMIN_PASSWORD) console.log("Chua dat ADMIN_PASSWORD: dang dung mat khau local mac dinh 'admin123'.");
  });
}).catch((e) => { console.error("Khong khoi tao duoc co so du lieu:", e); process.exit(1); });
