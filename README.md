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

## Xu ly anh (trang quan tri)
- `src/imgtools.js`: xoa watermark theo mau nha si (hoc alpha + mau tung diem anh tu nhieu anh, tinh nguoc phep tron),
  AI ve lai cho watermark dac (MI-GAN, MIT), cat khung 4:5 giu tron nguoi mau (MediaPipe, Apache 2.0). Chi tai khi admin dung.
- Mo hinh AI tai tu CDN (HuggingFace, Google) lan dau, kiem tra ma bam, luu dem trong trinh duyet. Muon tu luu tru:
  dat `migan_pipeline_v2.onnx` va `efficientdet_lite0.tflite` vao thu muc `models/` (server phuc vu o `/models/...`).
- Trang gui header COOP/COEP (credentialless) de AI chay nhieu luong trong trinh duyet.
- Chi tiet thuat toan va so do chat luong: `docs/quan-tri-web-free-a.md` muc 4b, 4c.

## Cau truc
- `server/server.js` API + dung trang tu `src/` + du lieu DB
- `server/db.js` Postgres/SQLite: san pham, don hang, anh, cau hinh
- `server/shim.js` noi trang quan tri cu voi API moi
- `server/admin.html` trang quan ly don hang
