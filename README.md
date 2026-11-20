# FREE.A web (Node + Postgres/SQLite)

Co so du lieu: **Postgres** khi co bien `DATABASE_URL` (Render), con lai dung **SQLite** (`data/feelia.db`) de chay local khong can cai gi them.

## Chay local
```
run-local.bat            # hoac: npm install && npm start
```
- Cua hang: http://localhost:3000
- Don hang: http://localhost:3000/admin
- San pham, gia, ma giam gia, anh, nhap hang loat: http://localhost:3000/#quan-tri
- Mat khau local mac dinh: `admin123` (doi bang bien moi truong `ADMIN_PASSWORD`)
- Xoa thu muc `data/` de nap lai du lieu mau tu `index.html`.
- Sua `src/app.js`, `src/*.css`, `src/tpl.html` roi F5 la thay ngay (khi chua dat NODE_ENV=production).
- Muon thu Postgres o local: dat `DATABASE_URL=postgres://user:pass@host:5432/db` truoc khi chay.

## Deploy len Render
1. Render > New > Blueprint > chon repo nay (dung `render.yaml`). Render tao 2 thu: database `free-a-db` (Postgres) va web service `free-a`. Link web: https://free-a.onrender.com
2. `ADMIN_PASSWORD` do Render tu sinh: Dashboard > `free-a` > Environment.
3. Xem va quan ly du lieu: Dashboard > `free-a-db` > Connect (lay thong tin ket noi cho DBeaver/pgAdmin/psql). Cac bang: `meta`, `products`, `orders`, `assets`.
4. Sau deploy: mo `/admin`, dang nhap, tai anh san pham lai (anh cu tren nen tang cu khong di theo repo).

Goi free: Postgres bi xoa sau 30 ngay (nang goi truoc han hoac tai ban sao luu o `/api/backup`); web service ngu sau 15 phut khong co truy cap, lan mo dau cham ~30 giay.

## Cau truc
- `server/server.js` API + dung trang tu `src/` + du lieu DB
- `server/db.js` Postgres/SQLite: san pham, don hang, anh, cau hinh
- `server/shim.js` noi trang quan tri cu voi API moi
- `server/admin.html` trang quan ly don hang
