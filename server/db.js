"use strict";
// Co so du lieu: Postgres khi co DATABASE_URL (Render), nguoc lai SQLite file (chay local).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PG_URL = process.env.DATABASE_URL || "";
if (!PG_URL && process.env.NODE_ENV === "production") {
  console.error("Thieu bien moi truong DATABASE_URL (ket noi Postgres). Tren Render: dong bo lai Blueprint de tao database free-a-db, hoac dat DATABASE_URL = Internal Database URL cua database.");
  process.exit(1);
}
const KIND = PG_URL ? "postgres" : "sqlite";
let DESC = "";
let conn; // { all, get, run, tx }

if (PG_URL) {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: PG_URL,
    ssl: process.env.PGSSL === "1" ? { rejectUnauthorized: false } : undefined, // URL ngoai cua Render can SSL; URL noi bo thi khong
    max: 5,
  });
  const conv = (sql) => { let i = 0; return sql.replace(/\?/g, () => "$" + ++i); };
  const wrap = (c) => ({
    all: async (s, p = []) => (await c.query(conv(s), p)).rows,
    get: async (s, p = []) => (await c.query(conv(s), p)).rows[0],
    run: async (s, p = []) => ({ changes: (await c.query(conv(s), p)).rowCount }),
  });
  conn = {
    ...wrap(pool),
    exec: (s) => pool.query(s),
    tx: async (fn) => {
      const c = await pool.connect();
      try { await c.query("BEGIN"); const r = await fn(wrap(c)); await c.query("COMMIT"); return r; }
      catch (e) { try { await c.query("ROLLBACK"); } catch (_) {} throw e; }
      finally { c.release(); }
    },
  };
  try { DESC = "Postgres " + new URL(PG_URL).host; } catch (_) { DESC = "Postgres"; }
} else {
  const { DatabaseSync } = require("node:sqlite"); // co san trong Node >= 22.13
  const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const FILE = path.join(DATA_DIR, "feelia.db");
  const sdb = new DatabaseSync(FILE);
  const wrap = () => ({
    all: async (s, p = []) => sdb.prepare(s).all(...p),
    get: async (s, p = []) => sdb.prepare(s).get(...p),
    run: async (s, p = []) => ({ changes: sdb.prepare(s).run(...p).changes }),
  });
  let queue = Promise.resolve(); // SQLite chi co 1 ket noi: cho giao dich xep hang
  conn = {
    ...wrap(),
    exec: async (s) => sdb.exec(s),
    tx: (fn) => {
      const job = queue.then(async () => {
        sdb.exec("BEGIN IMMEDIATE");
        try { const r = await fn(wrap()); sdb.exec("COMMIT"); return r; }
        catch (e) { try { sdb.exec("ROLLBACK"); } catch (_) {} throw e; }
      });
      queue = job.catch(() => {});
      return job;
    },
  };
  DESC = "SQLite " + FILE;
}

const NOW = PG_URL ? "to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI:SS')" : "datetime('now')";
const BIN = PG_URL ? "BYTEA" : "BLOB";
const SERIAL = PG_URL ? "SERIAL PRIMARY KEY" : "INTEGER PRIMARY KEY AUTOINCREMENT";

async function init() {
  if (!PG_URL) await conn.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const stmts = [
    "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, pos INTEGER NOT NULL, data TEXT NOT NULL)",
    `CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes INTEGER NOT NULL, data ${BIN} NOT NULL, created_at TEXT NOT NULL DEFAULT (${NOW}))`,
    `CREATE TABLE IF NOT EXISTS orders (
      id ${SERIAL}, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL,
      pay TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', voucher TEXT NOT NULL DEFAULT '', total INTEGER NOT NULL DEFAULT 0,
      items TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (${NOW}))`,
    "CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC)",
  ];
  for (const s of stmts) await conn.exec(s);
  await seedIfEmpty();
}

const getMeta = async (c, k, d) => {
  const r = await c.get("SELECT value FROM meta WHERE key = ?", [k]);
  if (!r) return d;
  try { return JSON.parse(r.value); } catch (_) { return d; }
};
const setMeta = (c, k, v) =>
  c.run("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [k, JSON.stringify(v)]);

/* ---------- cua hang ---------- */
async function getStore() {
  const products = (await conn.all("SELECT data FROM products ORDER BY pos")).map((r) => JSON.parse(r.data));
  return {
    v: 1,
    rev: await getMeta(conn, "rev", 0),
    shop: await getMeta(conn, "shop", {}),
    brand: await getMeta(conn, "brand", { st: "f", sz: 34 }),
    wm: await getMeta(conn, "wm", []),
    vouchers: await getMeta(conn, "vouchers", []),
    looks: await getMeta(conn, "looks", []),
    products,
  };
}
const getMedia = () => getMeta(conn, "media", { cover: "", logo0: "", logo: "", p: {} });
const currentRev = () => getMeta(conn, "rev", 0);

// Luu trong 1 giao dich; neu baseRev khong con khop (nguoi khac vua luu) thi tra ve null.
function saveStore(store, media, baseRev) {
  return conn.tx(async (c) => {
    const rev = await getMeta(c, "rev", 0);
    if (baseRev != null && baseRev !== rev) return null;
    await setMeta(c, "shop", store.shop || {});
    await setMeta(c, "brand", store.brand || { st: "f", sz: 34 });
    await setMeta(c, "wm", store.wm || []);
    await setMeta(c, "vouchers", store.vouchers || []);
    await setMeta(c, "looks", store.looks || []);
    await setMeta(c, "media", media);
    await c.run("DELETE FROM products");
    let i = 0;
    for (const p of store.products || []) await c.run("INSERT INTO products(id,pos,data) VALUES(?,?,?)", [p.id, i++, JSON.stringify(p)]);
    await setMeta(c, "rev", rev + 1);
    return rev + 1;
  });
}

/* ---------- anh ---------- */
async function putAsset(buf, mime) {
  const id = crypto.randomBytes(16).toString("base64url");
  await conn.run("INSERT INTO assets(id,mime,bytes,data) VALUES(?,?,?,?)", [id, mime, buf.length, buf]);
  return id;
}
const getAsset = (id) => conn.get("SELECT mime, data FROM assets WHERE id = ?", [id]);
const delAsset = async (id) => (await conn.run("DELETE FROM assets WHERE id = ?", [id])).changes > 0;
const listAssets = () => conn.all("SELECT id, bytes FROM assets ORDER BY created_at");

/* ---------- don hang ---------- */
async function addOrder(o) {
  const r = await conn.run(
    "INSERT INTO orders(code,name,phone,address,pay,note,voucher,total,items,text) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO NOTHING",
    [o.code, o.name, o.phone, o.address, o.pay, o.note, o.voucher, o.total, JSON.stringify(o.items), o.text]
  );
  return r.changes > 0;
}
const listOrders = async (limit = 500) =>
  (await conn.all("SELECT * FROM orders ORDER BY id DESC LIMIT ?", [limit])).map((r) => ({ ...r, items: JSON.parse(r.items) }));
const setOrderStatus = async (id, status) => (await conn.run("UPDATE orders SET status = ? WHERE id = ?", [status, id])).changes > 0;
const deleteOrder = async (id) => (await conn.run("DELETE FROM orders WHERE id = ?", [id])).changes > 0;

async function counts() {
  const n = async (t) => (await conn.get(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM ${t}`)).n;
  return { products: await n("products"), orders: await n("orders"), assets: await n("assets") };
}

/* ---------- du lieu mau: lan chay dau (DB trong) lay tu index.html trong repo ---------- */
async function seedIfEmpty() {
  if ((await getMeta(conn, "rev", null)) !== null) return false;
  const file = path.join(__dirname, "..", "index.html");
  if (!fs.existsSync(file)) { await setMeta(conn, "rev", 1); await setMeta(conn, "shop", { name: "FREE.A" }); return true; }
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
  await saveStore(store, media, null);
  console.log(`[seed] ${store.products.length} san pham, ${(store.vouchers || []).length} ma giam gia. Bo ${dropped} anh tham chieu kho anh cu (khong con file).`);
  return true;
}

module.exports = {
  KIND, DESC, init, getStore, getMedia, currentRev, saveStore,
  putAsset, getAsset, delAsset, listAssets,
  addOrder, listOrders, setOrderStatus, deleteOrder, counts,
};
