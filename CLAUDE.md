# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong dự án này.

## Tổng quan dự án

<!-- Mô tả ngắn: dự án web làm gì, dành cho ai -->

## Công nghệ sử dụng

<!-- Ví dụ: framework, ngôn ngữ, CSS, database, hosting -->

## Lệnh thường dùng

```bash
# Database (PostgreSQL) + pgAdmin trong Docker
docker compose up -d
# pgAdmin: http://localhost:5050 — đăng nhập bằng PGADMIN_EMAIL / PGADMIN_PASSWORD trong .env

# CSDL phòng khám ClinicCyberDB (user chủ: CLINIC_DB_ADMIN_USER / _PASSWORD trong .env)
bash database/ClinicCyberDB/cai_dat.sh            # cài mới
bash database/ClinicCyberDB/cai_dat.sh --lam-lai  # xóa và cài lại từ đầu

# Web phòng khám: backend Node.js (:4000) + frontend Next.js (:3001) — chạy từ thư mục gốc, xem README.md
npm run install:all     # lần đầu
npm run dev             # chạy cả backend + frontend (tài khoản mẫu: quanly / DoiMatKhau@2026)

# Web storedb (Node.js + Express) — http://localhost:3000
cd web && npm install   # lần đầu
npm start               # hoặc: npm run dev (tự khởi động lại khi sửa code)
```

## Cấu trúc thư mục

```
.claude/
├── agents/          # Subagent
├── commands/        # Slash command
├── skills/          # Skill
├── hooks/           # Script chạy tự động (khai báo trong settings.json)
├── output-styles/   # Kiểu trả lời tùy chỉnh
└── docs/            # Tài liệu dự án
    ├── api/            # Đặc tả API
    ├── architecture/   # Kiến trúc hệ thống
    ├── conventions/    # Quy ước code
    ├── requirements/   # Yêu cầu, use case (use-case.md)
    └── ui-ux/          # Thiết kế giao diện (man-hinh-tong-quan.drawio: sơ đồ + wireframe màn hình)
database/
├── quyet-dinh.md    # Quyết định thiết kế CSDL
└── ClinicCyberDB/   # CSDL phòng khám (xem README.md): 00 tạo DB → 01 bảng → 02 trigger/hàm → 03 view báo cáo → 04 dữ liệu mẫu
backend/             # Node.js Express (:4000): src/routes/* theo nhóm use case, kết nối ClinicCyberDB
frontend/            # Next.js App Router (:3001): app/(app)/* các màn hình, components/, lib/
pgadmin/servers.json # Khai báo sẵn server "Local Postgres (Docker)" cho pgAdmin
docker-compose.yml   # PostgreSQL 18 (phong_kham_db) + pgAdmin 4 (phong_kham_pgadmin, cổng 5050)
package.json         # Lệnh chung ở gốc: db:up, db:setup, install:all, dev (backend + frontend), build, start
README.md            # Cách chạy, màn hình ↔ use case
web/                 # Web hiển thị sản phẩm storedb (Express + pg, đọc ../.env)
├── server.js        # API: /api/health, /api/categories, /api/products?category=
└── public/index.html
```

<!-- Bổ sung cấu trúc mã nguồn khi có -->

## Quy ước code

<!-- Đặt tên, định dạng, cách tổ chức component, commit message... -->

## Tài liệu tham khảo

Tài liệu chi tiết nằm trong [.claude/docs/](.claude/docs/).

- Use case & giả định: [.claude/docs/requirements/use-case.md](.claude/docs/requirements/use-case.md)
- Kiến trúc tổng thể: [.claude/docs/architecture/overview.md](.claude/docs/architecture/overview.md)
- Kiến trúc dữ liệu: [.claude/docs/architecture/database.md](.claude/docs/architecture/database.md)
- Quyết định thiết kế CSDL: [database/quyet-dinh.md](database/quyet-dinh.md)
- CSDL ClinicCyberDB (bảng, luật, báo cáo): [database/ClinicCyberDB/README.md](database/ClinicCyberDB/README.md)
- Web phòng khám (màn hình ↔ use case, cách chạy): [README.md](README.md)
- Sơ đồ màn hình + wireframe: [.claude/docs/ui-ux/man-hinh-tong-quan.drawio](.claude/docs/ui-ux/man-hinh-tong-quan.drawio)

## Lưu ý quan trọng

<!-- Những điều Claude cần tránh hoặc phải luôn làm -->
- Cấu trúc dự án theo mẫu của thầy: `backend/`, `frontend/`, `database/`, `pgadmin/servers.json`, `docker-compose.yml`, `.env`, `package.json` ở thư mục gốc (lệnh chạy chung). Không gom vào thư mục con kiểu `clinic/api`, `clinic/web`.
- Không ghi mật khẩu vào file SQL/script; lấy từ `.env` (đã gitignore).
- ClinicCyberDB: ứng dụng phải `SET LOCAL app.nhan_vien_id = '<id>'` trong mỗi transaction để ghi người thao tác.
