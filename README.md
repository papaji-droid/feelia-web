# FREE.A web (Node + SQLite)

## Chay local
```
run-local.bat            # hoac: npm install && npm start
```
- Cua hang: http://localhost:3000
- Don hang: http://localhost:3000/admin
- San pham, gia, ma giam gia, anh, nhap hang loat: http://localhost:3000/#quan-tri
- Mat khau local mac dinh: `admin123` (doi bang bien moi truong `ADMIN_PASSWORD`)
- Du lieu: `data/feelia.db` (SQLite). Xoa thu muc `data/` de nap lai du lieu mau tu `index.html`.
- Sua `src/app.js`, `src/*.css`, `src/tpl.html` roi F5 la thay ngay (khi chua dat NODE_ENV=production).

## Deploy len Render
1. Day repo len GitHub, Render > New > Blueprint > chon repo (dung `render.yaml`).
2. Plan `starter` + Persistent Disk `/var/data` de SQLite khong mat du lieu (plan free khong co disk).
3. `ADMIN_PASSWORD` duoc Render tu sinh: xem o Environment cua service.
4. Sau deploy: mo `/admin`, dang nhap, tai anh san pham lai (anh cu tren nen tang cu khong di theo repo).

## Cau truc
- `server/server.js` API + dung trang tu `src/` + du lieu DB
- `server/db.js` SQLite: san pham, don hang, anh, cau hinh
- `server/shim.js` noi trang quan tri cu voi API moi
- `server/admin.html` trang quan ly don hang
