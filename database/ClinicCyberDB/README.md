# ClinicCyberDB

CSDL PostgreSQL cho hệ thống quản lý Nha khoa Nụ Cười Việt. Thiết kế dựa trên
[use-case.md](../../.claude/docs/requirements/use-case.md) và [quyet-dinh.md](../quyet-dinh.md).

## Cài đặt

```bash
docker compose up -d
bash database/ClinicCyberDB/cai_dat.sh            # cài mới
bash database/ClinicCyberDB/cai_dat.sh --lam-lai  # xóa database + user cũ rồi cài lại
```

Script đọc `.env`: `POSTGRES_USER` (superuser), `CLINIC_DB_ADMIN_USER`, `CLINIC_DB_ADMIN_PASSWORD`.
User admin (`LienAdmin`) là chủ sở hữu database và mọi bảng, nhưng không phải superuser của server.

| File | Nội dung |
|---|---|
| `00_tao_database.sql` | Tạo user admin + database (chạy bằng superuser) |
| `01_schema.sql` | 32 bảng, ràng buộc, chỉ mục |
| `02_trigger_ham.sql` | Trigger giữ luật nghiệp vụ + hàm nghiệp vụ |
| `03_view_bao_cao.sql` | View màn hình hằng ngày + 8 câu hỏi quản lý |
| `04_du_lieu_mau.sql` | Danh mục, nhân viên, ca trực 14 ngày tới, bệnh nhân và lịch mẫu |

Mật khẩu tài khoản nhân viên mẫu (đăng nhập ứng dụng): `DoiMatKhau@2026`.

## Ứng dụng phải làm gì

Trong mỗi transaction, đặt id nhân viên đang đăng nhập. Các cột `tao_boi`, `huy_boi`, `nhan_vien_id`
và nhật ký sửa sẽ tự lấy giá trị này:

```sql
BEGIN;
SET LOCAL app.nhan_vien_id = '6';
-- ... thao tác ...
COMMIT;
```

## Nhóm bảng ↔ use case

| Nhóm | Bảng | UC |
|---|---|---|
| Tài khoản | `vai_tro`, `nhan_vien`, `nhan_vien_vai_tro`, `ty_le_an_chia` | UC01–03, UC44 |
| Danh mục chung | `ghe`, `gio_mo_cua`, `ngay_nghi`, `ly_do_huy` | UC43 |
| Ca trực | `ca_truc` | UC09–10 |
| Bệnh nhân | `benh_nhan`, `tai_lieu_ho_so` | UC04–08 |
| Lịch hẹn | `lich_hen`, `lich_su_lich_hen`, `nhac_lich` | UC11–19 |
| Khám & điều trị | `phieu_dieu_tri`, `dong_dieu_tri`, `don_thuoc`, `vat_tu_su_dung`, `chi_dinh_tai_kham`, `lieu_trinh`, `dot_thanh_toan`, `lich_su_sua_phieu` | UC20–29 |
| Giá & kho | `dich_vu`, `bang_gia_dich_vu`, `thuoc_vat_tu`, `bang_gia_thuoc`, `dinh_muc_vat_tu`, `giao_dich_kho` | UC30, UC38–42 |
| Thanh toán | `hoa_don`, `dong_hoa_don`, `thanh_toan`, `chot_ket` | UC31–37 |

## Luật được database tự giữ (trigger / ràng buộc)

- Một lịch = 1 bác sĩ + 1 ghế + 1 khung 30 phút. Không trùng ghế, không trùng bác sĩ.
  Chỉ đặt trong giờ mở cửa và trong ca trực của bác sĩ.
- Trạng thái lịch chuyển đúng thứ tự (A11). Chỉ hủy được khi *Đã đặt / Đã nhắc*, phải có lý do,
  bên hủy, người hủy và thời điểm.
- Phiếu điều trị tự lấy bệnh nhân, bác sĩ, ngày từ lịch hẹn (A16). Răng theo FDI hoặc mã vùng (A15).
  Khi hoàn tất phiếu, hệ thống trừ kho vật tư và thuốc, rồi cảnh báo nếu tồn dưới ngưỡng.
- Mọi lần thêm, sửa, xóa trên phiếu đều ghi vào `lich_su_sua_phieu` (người, lúc, giá trị cũ → mới).
  Hóa đơn của phiếu đã thu tiền thì khóa các dòng dịch vụ (A24).
- Bảng giá không ghi đè (A21). Hóa đơn đã chốt thì giữ nguyên giá. Giảm giá tổng được phân bổ xuống
  từng dòng khi chốt, và luôn có `tong_tien = Σ thanh_tien` (QĐ3).
- Mỗi lần thu tiền không vượt số còn nợ (A22). Hóa đơn chỉ hủy được khi chưa thu đồng nào (A23).
  Ca đã chốt két thì không thu thêm được.
- Tổng các đợt của liệu trình = giá trọn gói (A20). Không xóa cứng bệnh nhân, lịch, phiếu, hóa đơn (A26).

## Hàm & view chính

| Mục đích | Đối tượng |
|---|---|
| Tìm khung trống (UC12) | `tim_khung_trong(ngay, bac_si_id NULL = ai cũng được)` |
| Gợi ý / áp vật tư theo định mức (UC26) | `goi_y_vat_tu(phieu)`, `ap_dung_goi_y_vat_tu(phieu)` |
| Lập, chốt, hủy hóa đơn (UC31–33) | `lap_hoa_don_luot_kham(phieu)`, `lap_hoa_don_dot_lieu_trinh(dot)`, `chot_hoa_don(hd)`, `huy_hoa_don(hd, ly_do)` |
| Chia tiền trả gộp (A22) | `goi_y_phan_bo_thanh_toan(benh_nhan, so_tien)` |
| Kiểm kê (UC41) | `kiem_ke(mat_hang, ton_thuc_te, ly_do)` |
| Màn hình hằng ngày | `v_lich_hen`, `v_danh_sach_nhac_lich`, `v_danh_sach_cho_kham`, `v_phieu_cho_lap_hoa_don`, `v_tai_kham_chua_dat`, `v_bang_gia_hien_hanh`, `v_benh_nhan_tong_quan` |
| Câu 1 – doanh thu bác sĩ | `v_doanh_thu_bac_si_thang` |
| Câu 2 – công suất ghế | `cong_suat_ghe(tu, den)` |
| Câu 3 – quá 6 tháng chưa quay lại | `v_benh_nhan_qua_6_thang` |
| Câu 4 – hủy lịch | `v_thong_ke_huy_lich` |
| Câu 5 – công nợ | `v_cong_no_benh_nhan` |
| Câu 6 – liệu trình đang dở | `v_lieu_trinh_dang_do` |
| Câu 7 – sắp hết hàng | `v_canh_bao_ton_kho` |
| Câu 8 – so với tháng trước | `v_so_sanh_doanh_thu_thang`, `so_sanh_doanh_thu_bac_si(thang)` |
| Chia tiền bác sĩ (UC44) | `chia_tien_bac_si(thang)` |
| Chốt két (UC46) | `v_lich_su_chot_ket` |
