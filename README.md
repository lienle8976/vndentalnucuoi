# Web quản lý Nha khoa Nụ Cười Việt

```
Trình duyệt ──► frontend (Next.js, :3001) ──/api/*──► backend (Node.js Express, :4000) ──► PostgreSQL ClinicCyberDB
```

## Chạy

```
backend/     Node.js Express (API :4000)
frontend/    Next.js (giao diện :3001)
database/    Script SQL ClinicCyberDB + quyết định thiết kế
pgadmin/     servers.json cho pgAdmin
```

Chạy từ thư mục gốc:

```bash
npm run db:up          # docker compose up -d → PostgreSQL + pgAdmin (:5050)
npm run db:setup       # lần đầu: tạo DB + dữ liệu mẫu   (npm run db:reset để cài lại)
npm run install:all    # cài thư viện gốc + backend + frontend
npm run dev            # chạy cùng lúc backend → http://localhost:4000/api/health
                       #                 frontend → http://localhost:3001
# bản build: npm run build && npm start
# chạy riêng: npm run dev:backend  /  npm run dev:frontend
```

Cấu hình lấy từ `.env` ở thư mục gốc: `CLINIC_DB_ADMIN_USER`, `CLINIC_DB_ADMIN_PASSWORD`, `CLINIC_API_PORT`, `CLINIC_JWT_SECRET`.
Nếu API chạy ở nơi khác, đặt `CLINIC_API_URL` khi chạy web.

Tài khoản mẫu (mật khẩu `DoiMatKhau@2026`): `quanly` (Quản lý), `bs.long`, `bs.quan`, `bs.ha`, `bs.tam` (Bác sĩ), `lt.anh`, `lt.chau` (Lễ tân).

## Màn hình ↔ use case

Sơ đồ + wireframe: [.claude/docs/ui-ux/man-hinh-tong-quan.drawio](.claude/docs/ui-ux/man-hinh-tong-quan.drawio) (mở bằng draw.io / extension *Draw.io Integration* trong VS Code).

| Màn hình | Đường dẫn | UC | Vai trò |
|---|---|---|---|
| Đăng nhập · Đổi mật khẩu | `/dang-nhap`, `/doi-mat-khau` | UC01, UC02 | Tất cả |
| Trang chủ | `/` | — | Tất cả |
| Lịch hẹn theo ngày (lưới ghế × khung) | `/lich-hen` | UC11, UC14, UC15, UC18, UC19 | Tất cả (thao tác: LT, QL) |
| Đặt / đổi lịch | `/lich-hen/dat` | UC12, UC13, UC14 | LT, QL |
| Nhắc lịch | `/lich-hen/nhac-lich` | UC16, UC17 | LT, QL |
| Bệnh nhân: tra cứu, mới, hồ sơ | `/benh-nhan`, `/benh-nhan/moi`, `/benh-nhan/[id]` | UC04–UC08 | Tất cả (sửa: LT, QL) |
| Ca trực | `/ca-truc` | UC09, UC10 | Tất cả (xếp ca: QL) |
| Chờ khám · Phiếu điều trị · Lịch sử sửa | `/kham`, `/kham/phieu/[id]`, `.../lich-su` | UC20–UC29 | BS, QL |
| Thanh toán · Hóa đơn · In | `/thanh-toan`, `/thanh-toan/hoa-don/[id]`, `/in/hoa-don/[id]` | UC31–UC35 | LT, QL |
| Công nợ · Chốt két | `/thanh-toan/cong-no`, `/thanh-toan/chot-ket` | UC36, UC37 | LT, QL |
| Bảng giá | `/bang-gia` | UC30, UC38 | Tất cả (sửa: QL) |
| Kho · Định mức | `/kho`, `/kho/dinh-muc` | UC39–UC42 | QL |
| Báo cáo | `/bao-cao` | UC44, UC45.1–45.8, UC46 | QL |
| Nhân viên · Danh mục chung | `/quan-tri/nhan-vien`, `/quan-tri/danh-muc` | UC03, UC43 | QL |

## Ghi chú kỹ thuật

- Mọi thao tác ghi chạy trong transaction có `SET LOCAL app.nhan_vien_id` → trigger DB ghi người thao tác, lịch sử sửa phiếu.
- Luật nghiệp vụ nằm trong DB (trigger); API trả lỗi tiếng Việt; `RAISE WARNING` (vd. tồn kho dưới ngưỡng) được trả về trong trường `canh_bao` và hiện thành thông báo.
- Chưa làm: gửi SMS qua cổng thật (hiện chỉ lưu nội dung tin và ghi “Đã gửi SMS”), tải lên ảnh scan hồ sơ giấy (chỉ xem danh sách).
