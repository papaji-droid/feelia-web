"use strict";
// Co so du lieu SQLite (node:sqlite co san trong Node >= 22.13, khong can cai them goi native).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, "feelia.db");
const db = new DatabaseSync(FILE);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  pos INTEGER NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  pay TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  voucher TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  items TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
`);

const q = (sql) => db.prepare(sql);
const tx = (fn) => {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; }
  catch (e) { try { db.exec("ROLLBACK"); } catch (_) {} throw e; }
};

const getMeta = (k, d) => {
  const r = q("SELECT value FROM meta WHERE key = ?").get(k);
  if (!r) return d;
  try { return JSON.parse(r.value); } catch (_) { return d; }
};
const setMeta = (k, v) =>
  q("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, JSON.stringify(v));

/* ---------- cua hang ---------- */
function getStore() {
  const products = q("SELECT data FROM products ORDER BY pos").all().map((r) => JSON.parse(r.data));
  return {
    v: 1,
    rev: getMeta("rev", 0),
    shop: getMeta("shop", {}),
    brand: getMeta("brand", { st: "f", sz: 34 }),
    wm: getMeta("wm", []),
    vouchers: getMeta("vouchers", []),
    looks: getMeta("looks", []),
    products,
  };
}
const getMedia = () => getMeta("media", { cover: "", logo0: "", logo: "", p: {} });
const currentRev = () => getMeta("rev", 0);

function saveStore(store, media) {
  tx(() => {
    setMeta("shop", store.shop || {});
    setMeta("brand", store.brand || { st: "f", sz: 34 });
    setMeta("wm", store.wm || []);
    setMeta("vouchers", store.vouchers || []);
    setMeta("looks", store.looks || []);
    setMeta("media", media);
    q("DELETE FROM products").run();
    const ins = q("INSERT INTO products(id,pos,data) VALUES(?,?,?)");
    (store.products || []).forEach((p, i) => ins.run(p.id, i, JSON.stringify(p)));
    setMeta("rev", currentRev() + 1);
  });
  return currentRev();
}

/* ---------- anh ---------- */
function putAsset(buf, mime) {
  const id = crypto.randomBytes(16).toString("base64url");
  q("INSERT INTO assets(id,mime,bytes,data) VALUES(?,?,?,?)").run(id, mime, buf.length, buf);
  return id;
}
const getAsset = (id) => q("SELECT mime, data FROM assets WHERE id = ?").get(id);
const delAsset = (id) => q("DELETE FROM assets WHERE id = ?").run(id).changes > 0;
const listAssets = () => q("SELECT id, bytes FROM assets ORDER BY created_at").all();

/* ---------- don hang ---------- */
function addOrder(o) {
  const r = q(
    "INSERT OR IGNORE INTO orders(code,name,phone,address,pay,note,voucher,total,items,text) VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).run(o.code, o.name, o.phone, o.address, o.pay, o.note, o.voucher, o.total, JSON.stringify(o.items), o.text);
  return r.changes > 0;
}
const listOrders = (limit = 500) =>
  q("SELECT * FROM orders ORDER BY id DESC LIMIT ?").all(limit).map((r) => ({ ...r, items: JSON.parse(r.items) }));
const setOrderStatus = (id, status) => q("UPDATE orders SET status = ? WHERE id = ?").run(status, id).changes > 0;
const deleteOrder = (id) => q("DELETE FROM orders WHERE id = ?").run(id).changes > 0;

/* ---------- du lieu mau: lan chay dau lay tu index.html trong repo ---------- */
function seedIfEmpty() {
  if (getMeta("rev", null) !== null) return false;
  const file = path.join(__dirname, "..", "index.html");
  if (!fs.existsSync(file)) { setMeta("rev", 1); setMeta("shop", { name: "FREE.A" }); return true; }
  const html = fs.readFileSync(file, "utf8");
  const grab = (id) => {
    const m = html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'));
    return m ? JSON.parse(m[1]) : null;
  };
  const store = grab("store") || {};
  const media = grab("media") || { cover: "", logo0: "", logo: "", p: {} };
  // Anh "a:<id>" nam trong kho anh cua nen tang cu, khong co trong repo => bo, nhap lai anh bang trang quan tri.
  let dropped = 0;
  (store.products || []).forEach((p) => {
    if (!p.photos) return;
    const keep = p.photos.filter((x) => !(String(x.s).startsWith("a:") || String(x.o).startsWith("a:")));
    dropped += p.photos.length - keep.length;
    if (keep.length) p.photos = keep; else delete p.photos;
  });
  saveStore(store, media);
  setMeta("rev", 1);
  console.log(`[seed] ${store.products.length} san pham, ${(store.vouchers || []).length} ma giam gia. Bo ${dropped} anh tham chieu kho anh cu (khong con file).`);
  return true;
}

module.exports = {
  FILE, DATA_DIR, seedIfEmpty, getStore, getMedia, currentRev, saveStore,
  putAsset, getAsset, delAsset, listAssets,
  addOrder, listOrders, setOrderStatus, deleteOrder,
  counts: () => ({
    products: q("SELECT COUNT(*) n FROM products").get().n,
    orders: q("SELECT COUNT(*) n FROM orders").get().n,
    assets: q("SELECT COUNT(*) n FROM assets").get().n,
  }),
};
