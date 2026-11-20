# Quản trị web FREE.A: prompt và hướng dẫn cho agent

Tài liệu này dành cho mọi phiên Claude (chat, Cowork) làm việc với trang bán hàng FREE.A. Đọc trước khi sửa trang.

## 1. Trang nằm ở đâu

- Trang bán hàng kiêm quản trị (từ 20/11/2026): https://free-a.onrender.com, chạy trên Render (máy chủ Node, dữ liệu trong Postgres). Mã nguồn: repo `papaji-droid/feelia-web`, xem README.
- Trang quản trị sản phẩm mở bằng đuôi `#quan-tri`, trang quản lý đơn hàng ở `/admin`. Đăng nhập bằng mật khẩu quản trị (biến `ADMIN_PASSWORD` trên Render).
- Bản cũ trên claude.ai (https://claude.ai/artifact/CaoC55EGrg7Sv3QH2Dik4p) không còn dùng; dữ liệu ban đầu đã được chép sang máy chủ mới.
- Phòng thử đồ 3D: tạm ngưng theo yêu cầu chủ shop (14/11/2026). Đã gỡ link khỏi trang bán hàng. Không gắn lại khi chưa được yêu cầu.
- Trang tự lưu phiên bản mới mỗi khi chủ shop bấm Lưu. Trước khi sửa mã trang, luôn đọc bản đang chạy và giữ nguyên khối `store` và `media` của bản đó (sản phẩm và ảnh chủ shop đã thêm).

## 2. Prompt đã dùng để dựng trang quản trị

> Bạn là lập trình viên của shop thời trang nữ FREE.A. Hãy thêm trang quản trị vào chính trang bán hàng, mở bằng địa chỉ #quan-tri, chỉ người có quyền sửa trang mới thấy.
> 1. Một nguồn dữ liệu duy nhất: sản phẩm, giá, size, màu, mã giảm giá và thông tin shop nằm trong một khối dữ liệu ở đầu trang. Trang bán hàng chỉ đọc từ khối này.
> 2. Sản phẩm: thêm, sửa, tạm ẩn, xóa. Mỗi món có mã, tên, danh mục, giá, giá khi giảm, size, màu, chất liệu, mô tả, nhãn và ảnh.
> 3. Cửa hàng: tên, dòng thông báo, câu tiêu đề, số điện thoại, Zalo, giờ làm việc, phí giao hàng, mức miễn phí giao hàng, ngày hết giảm giá, ảnh bìa.
> 4. Mã giảm giá: thêm, sửa, xóa. Giảm theo phần trăm hoặc miễn phí giao hàng, có đơn tối thiểu.
> 5. Sửa là bản nháp. Chỉ khi bấm "Lưu và đưa lên web" khách mới thấy. Có nút bỏ thay đổi.
> 6. Dùng tốt trên điện thoại, giữ đúng màu và phông của FREE.A.
> 7. An toàn: chữ nhập vào luôn hiển thị dạng văn bản. Kiểm tra tên, giá, size trước khi nhận.
> 8. Để agent làm việc được: mỗi sản phẩm một dòng dữ liệu, có số phiên bản rev, kèm tài liệu hướng dẫn.
> Không làm: thanh toán online, tự nhận đơn, đánh giá giả.

## 3. Prompt công cụ gán logo lên ảnh sản phẩm

> Mỗi ảnh sản phẩm thêm vào cửa hàng FREE.A phải tự động:
> 1. Cắt khung 4:5 giữ trọn người mẫu (cập nhật 20/11/2026, xem mục 4c): nhận diện người, không bao giờ cắt đầu; người toàn thân không vừa khung thì nới nền hai bên; ảnh không có người thì cắt quanh bộ đồ như cũ.
> 2. Tìm chỗ đặt logo đẹp nhất: nền phẳng nhất, không che bộ đồ, mặt, tay chân, không đè lên chữ có sẵn, ở gần người mẫu, ưu tiên đường một phần ba và góc trên hoặc dưới.
> 3. Chọn màu logo: giữ màu vàng đồng gốc nếu đủ tương phản với nền. Nếu không, dùng màu kem trên nền tối, nâu đậm trên nền sáng. Nền rối thì thêm bóng mờ.
> 4. In đúng logo FREE.A (chữ FREE.A có chim, BY THUÝ AN, STYLING STUDIO). Cỡ mặc định 34% bề ngang ảnh. Có kiểu chỉ chữ FREE.A.
> 5. Lưu bản gốc đã cắt và bản đã gán logo, để dời logo về sau không mất chất lượng.
> 6. Xóa chữ thừa: người dùng tô lên chữ, trang tự dò đúng nét chữ trong vùng tô (không xóa cả vùng), tính ngược ra màu gốc hoặc để AI vẽ lại đúng các nét đó, có hoàn tác.
> 7. Có nút gán lại logo cho mọi ảnh khi đổi logo, kiểu hoặc cỡ.
> 8. Tốc độ: phần xử lý dưới 0,1 giây mỗi ảnh. Thời gian còn lại là tải ảnh lên kho.
> Watermark có sẵn chỉ được xóa theo mục 4b, với ảnh nhà sỉ đã cho phép dùng.

## 4. Nhập hàng loạt: gom ảnh thành sản phẩm

Trang không đoán được ảnh nào thuộc món nào hay giá bao nhiêu chỉ từ hình. Thông tin phải đi kèm theo một trong ba cách sau (dùng kết hợp được). Quản trị, Sản phẩm, nút **Nhập hàng loạt**. Trang luôn cho xem trước kết quả gom trước khi tạo.

1. **Mỗi món một thư mục** (trên máy tính): tên thư mục là tên món, có thể kèm giá, ví dụ `Váy lụa 389k/1.jpg, 2.jpg`. Chọn thư mục mẹ.
2. **Tên file chung có số thứ tự**: `SP001-1.jpg`, `SP001-2.jpg`, `SP002-1.jpg`. Có thể ghi tên và giá trong tên file: `vay-hoa-nhi-459k-1.jpg`. Phần trước số thứ tự cuối cùng là khóa gom ảnh.
3. **Bảng giá** (file .xlsx, .csv hoặc dán từ Excel, Google Sheets). Dòng đầu là tên cột. Cột trang hiểu: Mã, Tên, Giá, Giá giảm, Size, Màu, Danh mục, Chất liệu, Mô tả, Ảnh. Dòng khớp với ảnh khi: Mã trùng mã trong tên file (SP001), hoặc cột Ảnh ghi tên file của món đó (`DSC_77.jpg, DSC_78.jpg`).

Quy tắc khác:
- Giá đọc được: `459k`, `459.000`, `459.000đ`, `459000`.
- Món chưa có giá được tạo ở trạng thái ẩn.
- Mã trùng với sản phẩm đã có: không tạo món mới, mà thêm ảnh vào món đó và cập nhật các cột có trong bảng. Dùng để bổ sung ảnh hoặc đổi giá hàng loạt.
- Ảnh tên do máy ảnh đặt (IMG_1234.jpg) không gom được, mỗi ảnh thành một món riêng.
- Dòng trong bảng không có ảnh khớp thì chưa tạo, trang liệt kê để kiểm tra.
- Mỗi món tối đa 8 ảnh, ảnh đầu là ảnh chính.

### Prompt Cowork chuẩn bị hàng từ Zalo

> Quy trình chuẩn bị hàng FREE.A từ Zalo. Chỉ đọc, không đăng bài, không nhắn tin, không xóa gì trên Zalo.
> 1. Mở chat.zalo.me đang đăng nhập sẵn trong Chrome. Chưa đăng nhập thì dừng và báo tôi.
> 2. Đọc Nhật ký. Mỗi bài đăng có ảnh quần áo là một sản phẩm. Đánh mã theo thứ tự SP001, SP002…
> 3. Lưu ảnh của mỗi bài vào D:\Feelia\nhap-hang\<tên nhà sỉ>\ với tên SP001-1.jpg, SP001-2.jpg… đúng mã của bài đó. Mỗi nhà sỉ một thư mục riêng, để dùng đúng mẫu xóa watermark.
> 4. Tạo D:\Feelia\nhap-hang\bang-gia.csv, cột: Mã, Tên, Giá, Giá giảm, Size, Màu, Danh mục, Mô tả. Lấy giá, size, màu từ chữ trong bài. Không có thì để trống, không tự đoán giá.
> 5. Báo lại: số bài, số ảnh, những mã còn thiếu giá, ảnh của nhà sỉ nào.
>
> Sau đó chủ shop mở Quản trị, Nhập hàng loạt, chọn ảnh của từng nhà sỉ và file bang-gia.csv, chọn mẫu xóa watermark của nhà sỉ đó, xem trước rồi bấm nút.

## 4b. Xóa watermark có sẵn theo mẫu nhà sỉ

Chủ shop xác nhận (15/11/2026): ảnh lấy từ các cửa hàng sỉ mà shop nhập hàng, đã được họ đồng ý cho dùng. Lưu ý đã báo chủ shop: được dùng ảnh chưa chắc là được xóa watermark, nên ưu tiên xin nhà sỉ bộ ảnh gốc không logo.

### Cách làm (viết lại 20/11/2026, mã ở `src/imgtools.js`)

Bản cũ khoanh khung chữ nhật rồi lấp cả khung, làm mất chi tiết áo và đôi khi chọn nhầm vùng. Bản mới:

1. **Học mẫu từ nhiều ảnh của cùng nhà sỉ** (ít nhất 5, nên từ 10 ảnh, cùng khổ). Watermark là thứ duy nhất giống hệt nhau trên mọi ảnh, nên trang tính được độ đục (alpha) và màu của watermark **tại từng điểm ảnh**: so phần tần số cao của các ảnh để tìm chỗ có watermark, đoán nền bên dưới từ các điểm xung quanh, rồi hồi quy bền trên tất cả ảnh. Hai lượt: lượt đầu vùng rộng để tìm đủ cả bóng đổ, quầng sáng; lượt hai ôm sát nét để alpha không bị lệch.
2. **Chống báo nhầm**: một điểm chỉ được coi là watermark khi có ý nghĩa thống kê (ít ảnh thì ngưỡng khắt khe hơn), nằm trong một cụm thành nét, và xuất hiện trên gần như **từng** ảnh (nét nền studio lặp lại ở vài ảnh sẽ bị loại).
3. **Xóa**: chỗ watermark mờ được tính ngược phép trộn `ảnh = alpha*màu + (1-alpha)*gốc` để lấy lại đúng màu ảnh gốc (không vẽ đè). Chỗ watermark gần như đặc hoặc bị cháy sáng (không còn thông tin gốc), cùng viền 2 điểm quanh đó, do AI vẽ lại: mô hình MI-GAN (Picsart AI Research, giấy phép MIT, 28 MB) chạy ngay trong trình duyệt, tải một lần, có kiểm tra mã băm SHA-256. Không tải được AI thì dùng vá mảng PatchMatch.
4. **Từng ảnh khi nhập**: trang tự dời mẫu tới ±2 điểm ảnh cho khớp, và kiểm tra ảnh có đúng watermark đó không (so giả thuyết có/không có watermark). Ảnh không có watermark của mẫu thì để nguyên.
5. Mẫu lưu thành một ảnh PNG trong kho ảnh (nửa trái là màu, nửa phải là độ đục), dữ liệu cửa hàng chỉ giữ đường dẫn. Mẫu cũ dạng khung chữ nhật vẫn dùng được (trang dò nét chữ trong từng khung), nhưng nên bấm Sửa mẫu để học lại.

Đo trên bộ thử 7 kiểu watermark × 14 ảnh (chữ trắng mờ, có bóng đổ, chữ đen + logo góc, chữ đặc viền đen, logo màu chuyển sắc, chữ lặp chéo kín ảnh, chữ quầng sáng), nén JPEG như Zalo, so với ảnh gốc sạch: vùng watermark đạt 23 đến 33 dB (cách cũ 12 đến 21 dB, nhiều bộ còn tệ hơn để nguyên), sát mức lý tưởng khi biết trước watermark thật (logo màu còn vượt, vì mẫu học từ ảnh thật bắt được cả hiệu ứng nén JPEG); số điểm bị sửa ngoài watermark trên cả 14 ảnh từ 0 đến khoảng 1.500 (cách cũ 300 nghìn đến 3,8 triệu điểm); không ảnh sạch nào bị xóa nhầm. Watermark lặp kín ảnh được nhận ra lưới lặp và lấp cả những đoạn khó thấy. Ảnh bị cắt khác khổ (vuông, cắt bớt) vẫn tự dò ra chỗ watermark.

### Giới hạn

- Watermark phải giống nhau giữa các ảnh (cùng chữ, cùng chỗ theo tỉ lệ khung). Nhà sỉ đặt watermark mỗi ảnh một chỗ thì xóa tay từng ảnh trong khung Chỉnh ảnh.
- Phần watermark đặc phủ lên chi tiết phức tạp (mặt, hoa văn) do AI vẽ lại nên là phỏng đoán hợp lý, không phải ảnh gốc thật. Ảnh gốc không logo từ nhà sỉ vẫn đẹp nhất.
- Chữ lặp chéo rất mờ trên nền sáng có thể sót vài đoạn (trên nền sáng gần như không thấy).
- Ít ảnh (5 đến 9) thì kém chính xác hơn; từ 10 ảnh trở lên mới đạt chất lượng như số đo ở trên.
- AI vẽ lại cần mạng lần đầu (tải mô hình 28 MB) và chậm hơn: ảnh có watermark đặc mất khoảng 3 đến 6 giây mỗi ảnh.
- Khi nhập, chỉ chọn ảnh của đúng nhà sỉ ứng với mẫu đang chọn.

## 4c. Cắt khung 4:5 giữ trọn người mẫu

Bản cũ chọn khung theo độ nổi bật nên hay cắt mất đầu ở ảnh dọc cao. Bản mới (20/11/2026):

1. Nhận diện người bằng MediaPipe (EfficientDet-Lite0 của Google, giấy phép Apache 2.0), chạy trong trình duyệt, khoảng 0,1 giây mỗi ảnh. Bỏ qua người nhỏ phía sau (khán giả), giữ những người đủ lớn.
2. Không bao giờ cắt đầu: khung luôn chứa đỉnh đầu và chừa khoảng trống phía trên.
3. Ảnh dọc cao hơn 4:5 mà người toàn thân không vừa: nới nền hai bên (tối đa 22% bề ngang). Nền nới thêm do AI vẽ tiếp rồi làm mờ dần như xóa phông; không có AI thì soi gương nền rồi làm mờ. Nới tối đa vẫn không đủ thì mới cắt bớt phía chân.
4. Người nhỏ trong ảnh: phóng vào cho người chiếm khoảng 90% chiều cao, nhưng không phóng quá 1,25 lần.
5. Không thấy người (ảnh trải phẳng quần áo, không có mạng): cắt theo độ nổi bật như cũ.

## 5. Cấu trúc trang

Máy chủ (`server/`) dựng trang mỗi lần có người mở, từ các phần trong `src/` và dữ liệu trong cơ sở dữ liệu:

1. Khối `<script type="application/json" id="store">`: toàn bộ dữ liệu cửa hàng (bảng `meta` và `products`).
2. CSS (`src/base.css`, `src/admin.css`), khuôn giao diện (`src/tpl.html`).
3. Khối `id="media"` chứa ảnh bìa và logo dạng base64, rồi mã chạy trang (`src/app.js`).
4. Ảnh sản phẩm và ảnh mẫu watermark nằm trong kho ảnh (bảng `assets`), gọi bằng `/_blob/<id>`.
5. `src/imgtools.js` (xóa watermark, AI vẽ lại, nhận diện người): phục vụ ở `/imgtools.js`, chỉ trang quản trị tải khi cần.

Khối `store` có dạng, mỗi mục một dòng:

```
{"v":1,"rev":2,
"shop":{...},
"brand":{"st":"f","sz":34},
"wm":[{"id":"w1abc","name":"Xưởng ABC","v":2,"m":"a:<id>","rw":1080,"rh":1440,"x":171,"y":824,"w":733,"h":316,"n":14}],
"vouchers":[
{"code":"FREEA10","pct":10,"max":50000},
{"code":"FREESHIP","ship":1,"min":199000}
],
"looks":[
{"name":"Đi làm thanh lịch","ids":[4,7],"off":10}
],
"products":[
{"id":1,"sku":"SP001","name":"...","cat":"Váy","shape":"dress","price":459000,"sale":369000,"sizes":["S","M","L"],"colors":[["Nâu mocha","#9a7459"]],"mat":"...","desc":"...","tag":"Mới","photos":[{"s":"a:<id>","o":"a:<id>","m":{...}}]},
...
]}
```

Ý nghĩa các trường:

- `shop`: name, by, title (tên trên tab trình duyệt), desc, phone, zalo (https), hours, shipFee, freeShip, saleEnd (hết giờ này giá giảm tự tắt), tryon (để trống, phòng thử đồ đang tạm ngưng), bank, notice (dòng thông báo trên cùng), headline, intro.
- `brand`: cài đặt logo trên ảnh. st là "f" (logo đầy đủ) hoặc "s" (chỉ chữ FREE.A). sz là cỡ logo theo % bề ngang ảnh, từ 18 đến 60.
- `wm`: mẫu xóa watermark theo nhà sỉ, tối đa 30. Kiểu mới (`v:2`): id, name, m (ảnh mẫu PNG trong kho: nửa trái màu watermark, nửa phải độ đục từng điểm), rw×rh (khổ ảnh gốc đã học), x, y, w, h (khung chứa watermark trên khổ đó), n (số ảnh đã học). Kiểu cũ: r là danh sách vùng [x, y, rộng, cao] theo tỉ lệ khung ảnh (0 đến 1). Agent không tự tạo hay sửa mẫu, chỉ tạo qua trang quản trị.
- `vouchers`: code (chữ hoa và số), pct (% giảm) và max (giảm tối đa), hoặc ship:1 (miễn phí giao hàng); min là đơn tối thiểu.
- `looks`: bộ phối sẵn. ids là mã sản phẩm, off là % giảm khi mua cả bộ. Bộ nào có sản phẩm bị ẩn hoặc xóa sẽ tự ẩn.
- `products`: id (số, không trùng), sku (mã sản phẩm, không trùng, dùng khi nhập hàng loạt), name, cat, shape (kiểu hình minh họa khi chưa có ảnh), pat, price, sale (phải nhỏ hơn price), sizes, colors, mat, desc, tag, hidden:true (tạm ẩn), photos (tối đa 8 ảnh, ảnh đầu là ảnh chính). Mỗi ảnh: s là bản đã gán logo, o là bản gốc đã cắt (đã xóa watermark nếu có mẫu), m là vị trí logo (x, y, w theo tỉ lệ ảnh; v, vm màu logo; st kiểu; a=1 nếu vị trí tự động). Sản phẩm đứng trước hiện trước.

## 6. Cách agent sửa dữ liệu

1. Chỉ đọc phần đầu trang (khoảng 60 dòng đầu, nhiều hơn nếu có nhiều sản phẩm). Không đọc cả trang: khối ảnh và mã ở cuối rất nặng.
2. Sửa bằng cách thay đúng dòng cần đổi trong khối `store`. Giữ mỗi mục một dòng, JSON phải hợp lệ, dấu phẩy cuối dòng đúng chỗ.
3. Mỗi lần sửa, tăng `"rev"` thêm 1 trong cùng lần lưu, để bản nháp đang mở ở máy khác không ghi đè nhầm.
4. Không sửa khối `media`, CSS, khuôn giao diện hay mã chạy trang khi chỉ cần đổi dữ liệu.
5. Ảnh sản phẩm: chỉ thêm qua trang quản trị (Thêm ảnh hoặc Nhập hàng loạt). Agent không tự sửa trường `photos` và không chèn ảnh lấy từ nơi khác.
6. Trang đang công khai: lưu xong là khách thấy ngay. Kiểm tra kỹ trước khi lưu, và báo lại cho chủ shop đã đổi gì.

## 7. Việc nào cần chủ shop duyệt

- Cần duyệt trước: đổi giá, tạo hoặc sửa mã giảm giá, xóa sản phẩm, đổi số điện thoại, Zalo, thông tin chuyển khoản, đổi phí giao hàng, dọn kho ảnh, tạo mẫu xóa watermark cho nhà sỉ mới.
- Được làm rồi báo lại: sửa lỗi chính tả, viết lại mô tả, đặt tên và danh mục cho sản phẩm vừa nhập (vẫn để ẩn), sắp xếp lại thứ tự, chuẩn bị ảnh và bảng giá cho Nhập hàng loạt.
- Không bao giờ làm: đánh giá giả, số lượt bán giả, dùng ảnh của shop khác, xóa watermark trên ảnh không phải của nhà sỉ đã cho phép, tự đoán giá, thu thập thông tin thanh toán của khách.

## 8. Phân việc theo phòng

- Sản phẩm: chuẩn bị ảnh và bảng giá (mỗi nhà sỉ một thư mục), nhập hàng loạt, đặt tên, giá, size cho sản phẩm mới, bộ phối sẵn.
- Marketing: dòng thông báo, câu tiêu đề, mã giảm giá (sau khi duyệt), ngày hết giảm giá, kiểu và cỡ logo trên ảnh.
- CSKH: nội dung trả lời tự động và câu hỏi hay gặp (hiện nằm trong mã chạy trang, sửa cần CEO làm).
- Tài chính: đề xuất giá, phí giao hàng, mức miễn phí giao hàng.

## 9. Giới hạn hiện tại

- Đơn hàng lưu vào cơ sở dữ liệu, xem ở `/admin`; khách vẫn gửi nội dung đơn qua Zalo để shop xác nhận. Chưa có báo đơn mới qua email hay Zalo.
- Chưa có thanh toán online, quản lý kho hàng, tên miền riêng.
- Kho ảnh tối đa 5000 file. Mỗi ảnh sản phẩm dùng 2 file, nên chứa được khoảng 2500 ảnh. Sau khi gán lại logo hàng loạt, bản cũ thành ảnh thừa: dọn bằng nút trong mục Cửa hàng.
- Xóa watermark theo mẫu chỉ áp dụng khi nhập hàng loạt. Ảnh đã nhập trước đó muốn xóa thì dùng khung Chỉnh ảnh, Tô để xóa chữ (một ảnh lẻ không có ảnh khác để so nên kém chính xác hơn xóa theo mẫu).
- Logo đang dùng được dựng lại từ ảnh bìa (chữ FREE.A và chim lấy từ ảnh, hai dòng chữ nhỏ gõ lại bằng phông Montserrat). Khi có file logo gốc PNG nền trong suốt, thay ở mục Cửa hàng, Đổi logo.
- 12 sản phẩm ban đầu là mẫu thử có hình minh họa, giá và bảng size do Claude đề xuất, chờ chủ shop thay bằng hàng thật.
