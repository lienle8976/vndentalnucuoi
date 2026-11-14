-- =====================================================================
-- ClinicCyberDB — 03. View & hàm báo cáo
--   * Màn hình hằng ngày: nhắc lịch, chờ khám, công nợ, tồn kho
--   * Tám câu hỏi của quản lý (UC45.1–UC45.8), chia tiền bác sĩ (UC44)
-- Chạy sau 02_trigger_ham.sql
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

-- =====================================================================
-- MÀN HÌNH HẰNG NGÀY
-- =====================================================================

-- UC11: lịch hẹn đầy đủ thông tin (thay sổ A3)
CREATE VIEW v_lich_hen AS
SELECT l.id, l.ngay, l.gio_bat_dau, l.gio_ket_thuc, l.trang_thai,
       g.ma_ghe, l.ghe_id,
       l.bac_si_id, bs.ho_ten AS bac_si,
       l.benh_nhan_id, bn.ma_benh_nhan, bn.ho_ten AS benh_nhan, bn.ngay_sinh, bn.so_dien_thoai,
       bn.nguoi_giam_ho,
       dv.ten AS dich_vu_du_kien, l.ghi_chu, l.nguon
FROM lich_hen l
JOIN ghe g        ON g.id = l.ghe_id
JOIN nhan_vien bs ON bs.id = l.bac_si_id
JOIN benh_nhan bn ON bn.id = l.benh_nhan_id
JOIN dich_vu dv   ON dv.id = l.dich_vu_du_kien_id;

-- UC16: danh sách cần nhắc = lịch ngày mai chưa hủy, kèm kết quả nhắc gần nhất
CREATE VIEW v_danh_sach_nhac_lich AS
SELECT v.*, nl.hinh_thuc AS lan_nhac_cuoi_hinh_thuc, nl.ket_qua AS lan_nhac_cuoi_ket_qua,
       nl.thoi_diem AS lan_nhac_cuoi_luc
FROM v_lich_hen v
LEFT JOIN LATERAL (
    SELECT hinh_thuc, ket_qua, thoi_diem FROM nhac_lich
    WHERE lich_hen_id = v.id ORDER BY thoi_diem DESC LIMIT 1
) nl ON true
WHERE v.ngay = current_date + 1
  AND v.trang_thai IN ('DA_DAT', 'DA_NHAC');

-- UC20: danh sách chờ khám hôm nay (đã check-in) — lọc theo bac_si_id ở ứng dụng
CREATE VIEW v_danh_sach_cho_kham AS
SELECT v.*, l.den_luc
FROM v_lich_hen v JOIN lich_hen l ON l.id = v.id
WHERE v.ngay = current_date AND v.trang_thai IN ('DA_DEN', 'DANG_KHAM')
ORDER BY l.den_luc;

-- Phiếu: danh sách mọi bác sĩ tham gia (QĐ1 — "hồ sơ vẫn ghi hai tên")
CREATE VIEW v_phieu_dieu_tri AS
SELECT p.id, p.ma_phieu, p.ngay_kham, l.gio_bat_dau, g.ma_ghe, p.trang_thai,
       p.benh_nhan_id, bn.ma_benh_nhan, bn.ho_ten AS benh_nhan,
       p.bac_si_chinh_id, bs.ho_ten AS bac_si_chinh,
       (SELECT string_agg(DISTINCT n.ho_ten, ', ')
        FROM dong_dieu_tri d JOIN nhan_vien n ON n.id = d.bac_si_thuc_hien_id
        WHERE d.phieu_dieu_tri_id = p.id) AS cac_bac_si_thuc_hien,
       p.chan_doan, p.ghi_chu, p.hoan_tat_luc
FROM phieu_dieu_tri p
JOIN lich_hen l   ON l.id = p.lich_hen_id
JOIN ghe g        ON g.id = l.ghe_id
JOIN benh_nhan bn ON bn.id = p.benh_nhan_id
JOIN nhan_vien bs ON bs.id = p.bac_si_chinh_id;

-- Phiếu hoàn tất nhưng chưa lập hóa đơn (lễ tân cần làm)
CREATE VIEW v_phieu_cho_lap_hoa_don AS
SELECT v.*
FROM v_phieu_dieu_tri v
WHERE v.trang_thai = 'HOAN_TAT'
  AND NOT EXISTS (SELECT 1 FROM hoa_don h WHERE h.phieu_dieu_tri_id = v.id AND h.trang_thai <> 'DA_HUY')
  AND (EXISTS (SELECT 1 FROM dong_dieu_tri d WHERE d.phieu_dieu_tri_id = v.id AND d.lieu_trinh_id IS NULL)
       OR EXISTS (SELECT 1 FROM don_thuoc t WHERE t.phieu_dieu_tri_id = v.id));

-- Chỉ định tái khám chưa đặt lịch (A17)
CREATE VIEW v_tai_kham_chua_dat AS
SELECT c.id AS chi_dinh_id, p.benh_nhan_id, bn.ho_ten AS benh_nhan, bn.so_dien_thoai,
       coalesce(c.ngay_du_kien, p.ngay_kham + c.sau_so_ngay) AS ngay_du_kien,
       dv.ten AS dich_vu, c.ghi_chu, p.bac_si_chinh_id
FROM chi_dinh_tai_kham c
JOIN phieu_dieu_tri p ON p.id = c.phieu_dieu_tri_id
JOIN benh_nhan bn     ON bn.id = p.benh_nhan_id
LEFT JOIN dich_vu dv  ON dv.id = c.dich_vu_id
WHERE NOT EXISTS (SELECT 1 FROM lich_hen l
                  WHERE l.chi_dinh_tai_kham_id = c.id AND l.trang_thai NOT IN ('DA_HUY', 'KHONG_DEN'));

-- UC30: bảng giá đang hiệu lực hôm nay
CREATE VIEW v_bang_gia_hien_hanh AS
SELECT dv.id AS dich_vu_id, dv.ma_dich_vu, dv.ten, dv.nhom, dv.don_vi_tinh, dv.la_lieu_trinh,
       gia_dich_vu(dv.id, current_date) AS don_gia
FROM dich_vu dv
WHERE dv.dang_hoat_dong;

-- Hồ sơ bệnh nhân: lần khám gần nhất (A27, A31) và lịch sắp tới
CREATE VIEW v_benh_nhan_tong_quan AS
SELECT bn.id, bn.ma_benh_nhan, bn.ho_ten, bn.ngay_sinh,
       date_part('year', age(bn.ngay_sinh))::int AS tuoi,
       bn.so_dien_thoai, bn.nguoi_giam_ho, bn.quan_he_giam_ho, bn.nguon_ho_so, bn.dang_hoat_dong,
       greatest(k.lan_kham_cuoi_he_thong, bn.ngay_kham_gan_nhat_giay) AS lan_kham_cuoi,
       s.lich_sap_toi
FROM benh_nhan bn
LEFT JOIN LATERAL (
    SELECT max(l.ngay) AS lan_kham_cuoi_he_thong
    FROM lich_hen l WHERE l.benh_nhan_id = bn.id AND l.trang_thai = 'HOAN_THANH'
) k ON true
LEFT JOIN LATERAL (
    SELECT min(l.ngay + l.gio_bat_dau) AS lich_sap_toi
    FROM lich_hen l
    WHERE l.benh_nhan_id = bn.id AND l.ngay >= current_date AND l.trang_thai IN ('DA_DAT', 'DA_NHAC')
) s ON true;


-- =====================================================================
-- DOANH THU — định nghĩa A28
--   Doanh thu = Σ thanh_tien các dòng hóa đơn đã chốt, theo ngày làm dịch vụ
--   Thực thu  = tiền đã nhận (thanh_toan)
-- =====================================================================
CREATE VIEW v_doanh_thu_dong AS
SELECT d.id AS dong_hoa_don_id, h.id AS hoa_don_id, h.ma_hoa_don, h.loai AS loai_hoa_don,
       d.loai_dong, d.bac_si_id, d.ngay_thuc_hien,
       date_trunc('month', d.ngay_thuc_hien)::date AS thang,
       d.mo_ta, d.thanh_tien
FROM dong_hoa_don d JOIN hoa_don h ON h.id = d.hoa_don_id
WHERE h.trang_thai = 'DA_CHOT';

-- UC45.1 — Câu 1: mỗi bác sĩ làm ra bao nhiêu tiền trong tháng
CREATE VIEW v_doanh_thu_bac_si_thang AS
SELECT d.thang, d.bac_si_id, n.ho_ten AS bac_si,
       sum(d.thanh_tien)                                          AS doanh_thu,
       sum(d.thanh_tien) FILTER (WHERE d.loai_dong = 'DICH_VU')        AS tu_dich_vu,
       sum(d.thanh_tien) FILTER (WHERE d.loai_dong = 'DOT_LIEU_TRINH') AS tu_lieu_trinh,
       sum(d.thanh_tien) FILTER (WHERE d.loai_dong = 'THUOC')          AS tu_thuoc,
       count(*) AS so_dong
FROM v_doanh_thu_dong d JOIN nhan_vien n ON n.id = d.bac_si_id
GROUP BY d.thang, d.bac_si_id, n.ho_ten;

-- Thực thu theo tháng (hiển thị cạnh doanh thu — A28)
CREATE VIEW v_thuc_thu_thang AS
SELECT date_trunc('month', t.thoi_diem)::date AS thang,
       sum(t.so_tien)                                             AS thuc_thu,
       sum(t.so_tien) FILTER (WHERE t.hinh_thuc = 'TIEN_MAT')     AS tien_mat,
       sum(t.so_tien) FILTER (WHERE t.hinh_thuc = 'CHUYEN_KHOAN') AS chuyen_khoan,
       count(*) AS so_phieu_thu
FROM thanh_toan t
GROUP BY 1;

-- UC45.8 — Câu 8: doanh thu tăng/giảm bao nhiêu % so với tháng trước (cả phòng khám)
CREATE VIEW v_so_sanh_doanh_thu_thang AS
WITH thang AS (
    SELECT generate_series(
               (SELECT min(thang) FROM v_doanh_thu_dong),
               date_trunc('month', current_date)::date,
               interval '1 month')::date AS thang
),
dt AS (
    SELECT t.thang, coalesce(sum(d.thanh_tien), 0) AS doanh_thu
    FROM thang t LEFT JOIN v_doanh_thu_dong d ON d.thang = t.thang
    GROUP BY t.thang
)
SELECT dt.thang, dt.doanh_thu,
       lag(dt.doanh_thu) OVER (ORDER BY dt.thang) AS doanh_thu_thang_truoc,
       round(100.0 * (dt.doanh_thu - lag(dt.doanh_thu) OVER (ORDER BY dt.thang))
             / nullif(lag(dt.doanh_thu) OVER (ORDER BY dt.thang), 0), 1) AS thay_doi_pct,
       coalesce(tt.thuc_thu, 0) AS thuc_thu
FROM dt LEFT JOIN v_thuc_thu_thang tt ON tt.thang = dt.thang;

-- UC45.8 theo từng bác sĩ cho một tháng
CREATE FUNCTION so_sanh_doanh_thu_bac_si(p_thang date DEFAULT current_date)
RETURNS TABLE (bac_si_id bigint, bac_si text, doanh_thu numeric, doanh_thu_thang_truoc numeric, thay_doi_pct numeric)
LANGUAGE sql STABLE AS $$
    WITH ky AS (SELECT date_trunc('month', p_thang)::date AS nay,
                       (date_trunc('month', p_thang) - interval '1 month')::date AS truoc)
    SELECT n.id, n.ho_ten,
           coalesce(sum(d.thanh_tien) FILTER (WHERE d.thang = ky.nay), 0),
           coalesce(sum(d.thanh_tien) FILTER (WHERE d.thang = ky.truoc), 0),
           round(100.0 * (coalesce(sum(d.thanh_tien) FILTER (WHERE d.thang = ky.nay), 0)
                        - coalesce(sum(d.thanh_tien) FILTER (WHERE d.thang = ky.truoc), 0))
                 / nullif(sum(d.thanh_tien) FILTER (WHERE d.thang = ky.truoc), 0), 1)
    FROM ky
    JOIN nhan_vien_vai_tro r ON r.vai_tro_ma = 'BAC_SI'
    JOIN nhan_vien n ON n.id = r.nhan_vien_id
    LEFT JOIN v_doanh_thu_dong d ON d.bac_si_id = n.id AND d.thang IN (ky.nay, ky.truoc)
    GROUP BY n.id, n.ho_ten
    ORDER BY 3 DESC
$$;

-- UC44 — chia tiền theo bác sĩ (A29): mỗi dòng nhân với tỷ lệ có hiệu lực vào ngày làm
CREATE FUNCTION chia_tien_bac_si(p_thang date DEFAULT current_date)
RETURNS TABLE (bac_si_id bigint, bac_si text, doanh_thu numeric, tien_duoc_chia numeric, ty_le_ap_dung text)
LANGUAGE sql STABLE AS $$
    SELECT n.id, n.ho_ten,
           sum(d.thanh_tien),
           round(sum(d.thanh_tien * coalesce(t.ty_le, 0) / 100)),
           string_agg(DISTINCT coalesce(t.ty_le::text || '%', 'chưa cấu hình'), ', ')
    FROM v_doanh_thu_dong d
    JOIN nhan_vien n ON n.id = d.bac_si_id
    LEFT JOIN LATERAL (
        SELECT ty_le FROM ty_le_an_chia
        WHERE bac_si_id = d.bac_si_id AND hieu_luc_tu <= d.ngay_thuc_hien
        ORDER BY hieu_luc_tu DESC LIMIT 1
    ) t ON true
    WHERE d.thang = date_trunc('month', p_thang)::date
    GROUP BY n.id, n.ho_ten
    ORDER BY 3 DESC
$$;


-- =====================================================================
-- UC45.2 — Câu 2: ghế nào trống nhiều nhất, khung giờ nào (A30)
--   Trống = khung mở cửa không có lịch ở trạng thái Đã đến / Đang khám / Hoàn thành
-- =====================================================================
CREATE FUNCTION cong_suat_ghe(p_tu date, p_den date)
RETURNS TABLE (ma_ghe text, khung_gio time, so_khung bigint, so_khung_su_dung bigint,
               so_khung_trong bigint, ty_le_trong_pct numeric)
LANGUAGE sql STABLE AS $$
    WITH ngay AS (
        SELECT d::date AS ngay FROM generate_series(p_tu, p_den, interval '1 day') AS d
        WHERE NOT EXISTS (SELECT 1 FROM ngay_nghi n WHERE n.ngay = d::date)
    ),
    khung AS (
        SELECT n.ngay, k::time AS gio
        FROM ngay n
        JOIN gio_mo_cua g ON g.thu = extract(isodow FROM n.ngay) AND NOT g.nghi
        CROSS JOIN LATERAL generate_series(n.ngay + g.gio_mo, n.ngay + g.gio_dong - interval '30 minutes',
                                           interval '30 minutes') AS k
    ),
    o AS (
        SELECT gh.ma_ghe, k.gio,
               EXISTS (SELECT 1 FROM lich_hen l
                       WHERE l.ghe_id = gh.id AND l.ngay = k.ngay AND l.gio_bat_dau = k.gio
                         AND l.trang_thai IN ('DA_DEN', 'DANG_KHAM', 'HOAN_THANH')) AS su_dung
        FROM khung k CROSS JOIN ghe gh
        WHERE gh.dang_hoat_dong
    )
    SELECT o.ma_ghe, o.gio, count(*), count(*) FILTER (WHERE su_dung), count(*) FILTER (WHERE NOT su_dung),
           round(100.0 * count(*) FILTER (WHERE NOT su_dung) / count(*), 1)
    FROM o
    GROUP BY o.ma_ghe, o.gio
    ORDER BY 6 DESC, o.ma_ghe, o.gio
$$;


-- =====================================================================
-- UC45.3 — Câu 3: bệnh nhân quá 6 tháng chưa quay lại (A31)
-- =====================================================================
CREATE VIEW v_benh_nhan_qua_6_thang AS
SELECT id AS benh_nhan_id, ma_benh_nhan, ho_ten, ngay_sinh, so_dien_thoai, nguoi_giam_ho,
       lan_kham_cuoi, (current_date - lan_kham_cuoi) AS so_ngay_chua_quay_lai
FROM v_benh_nhan_tong_quan
WHERE dang_hoat_dong
  AND lan_kham_cuoi < current_date - interval '6 months'
  AND lich_sap_toi IS NULL
ORDER BY lan_kham_cuoi;


-- =====================================================================
-- UC45.4 — Câu 4: việc gì hay bị hủy lịch nhất, vì lý do gì (A10, A12)
-- =====================================================================
CREATE VIEW v_thong_ke_huy_lich AS
SELECT date_trunc('month', l.ngay)::date AS thang,
       dv.ten AS dich_vu, ld.ten AS ly_do, l.ben_huy,
       count(*) AS so_lan_huy
FROM lich_hen l
JOIN dich_vu dv   ON dv.id = l.dich_vu_du_kien_id
JOIN ly_do_huy ld ON ld.id = l.ly_do_huy_id
WHERE l.trang_thai = 'DA_HUY'
GROUP BY 1, 2, 3, 4;


-- =====================================================================
-- UC45.5 / UC36 — Câu 5: tổng nợ, chia theo từng người
-- =====================================================================
CREATE VIEW v_cong_no_benh_nhan AS
SELECT bn.id AS benh_nhan_id, bn.ma_benh_nhan, bn.ho_ten, bn.so_dien_thoai,
       count(*)            AS so_hoa_don_con_no,
       sum(h.con_no)       AS tong_no,
       min(h.ngay_lap)     AS no_tu_ngay
FROM hoa_don h JOIN benh_nhan bn ON bn.id = h.benh_nhan_id
WHERE h.trang_thai = 'DA_CHOT' AND h.con_no > 0
GROUP BY bn.id, bn.ma_benh_nhan, bn.ho_ten, bn.so_dien_thoai
ORDER BY tong_no DESC;


-- =====================================================================
-- UC45.6 — Câu 6: liệu trình nào đang dở, còn mấy buổi
-- =====================================================================
CREATE VIEW v_lieu_trinh_dang_do AS
SELECT lt.id AS lieu_trinh_id, lt.ma_lieu_trinh, lt.ten,
       lt.benh_nhan_id, bn.ho_ten AS benh_nhan, bn.so_dien_thoai,
       lt.bac_si_phu_trach_id, bs.ho_ten AS bac_si_phu_trach,
       lt.ngay_bat_dau, lt.so_buoi_du_kien,
       coalesce(b.so_buoi_da_lam, 0)                                   AS so_buoi_da_lam,
       greatest(lt.so_buoi_du_kien - coalesce(b.so_buoi_da_lam, 0), 0) AS so_buoi_con_lai,
       b.buoi_gan_nhat,
       lt.gia_tron_goi,
       coalesce(tien.da_lap_hoa_don, 0) AS da_lap_hoa_don,
       coalesce(tien.da_thu, 0)         AS da_thu
FROM lieu_trinh lt
JOIN benh_nhan bn ON bn.id = lt.benh_nhan_id
JOIN nhan_vien bs ON bs.id = lt.bac_si_phu_trach_id
LEFT JOIN LATERAL (
    SELECT count(DISTINCT d.buoi_thu) AS so_buoi_da_lam, max(p.ngay_kham) AS buoi_gan_nhat
    FROM dong_dieu_tri d JOIN phieu_dieu_tri p ON p.id = d.phieu_dieu_tri_id
    WHERE d.lieu_trinh_id = lt.id AND p.trang_thai = 'HOAN_TAT'
) b ON true
LEFT JOIN LATERAL (
    SELECT sum(h.tong_tien) AS da_lap_hoa_don, sum(h.da_thu) AS da_thu
    FROM dot_thanh_toan dt JOIN hoa_don h ON h.dot_thanh_toan_id = dt.id AND h.trang_thai = 'DA_CHOT'
    WHERE dt.lieu_trinh_id = lt.id
) tien ON true
WHERE lt.trang_thai = 'DANG_THUC_HIEN';


-- =====================================================================
-- UC45.7 / UC42 — Câu 7: thuốc, vật tư sắp hết (A32)
-- =====================================================================
CREATE VIEW v_canh_bao_ton_kho AS
SELECT m.id, m.ma, m.ten, m.loai, m.don_vi_tinh, m.ton_kho, m.nguong_toi_thieu,
       m.nguong_toi_thieu - m.ton_kho AS thieu_so_voi_nguong,
       -- Trung bình dùng mỗi ngày trong 30 ngày qua → ước lượng số ngày còn dùng được
       round(x.dung_30_ngay / 30.0, 2) AS dung_tb_ngay,
       CASE WHEN coalesce(x.dung_30_ngay, 0) > 0
            THEN floor(greatest(m.ton_kho, 0) / (x.dung_30_ngay / 30.0)) END AS uoc_tinh_con_ngay
FROM thuoc_vat_tu m
LEFT JOIN LATERAL (
    SELECT -sum(g.so_luong) AS dung_30_ngay
    FROM giao_dich_kho g
    WHERE g.thuoc_vat_tu_id = m.id AND g.loai IN ('XUAT_DIEU_TRI', 'XUAT_DON_THUOC')
      AND g.thoi_diem >= now() - interval '30 days'
) x ON true
WHERE m.dang_hoat_dong AND m.ton_kho <= m.nguong_toi_thieu
ORDER BY (m.ton_kho / nullif(m.nguong_toi_thieu, 0)) NULLS FIRST;


-- =====================================================================
-- UC46 — lịch sử chốt két
-- =====================================================================
CREATE VIEW v_lich_su_chot_ket AS
SELECT ck.id, c.ngay, c.ten_ca, c.gio_bat_dau, c.gio_ket_thuc,
       lt.ho_ten AS le_tan_ca, nv.ho_ten AS nguoi_chot,
       ck.tien_dau_ca, ck.tien_mat_thu_trong_ca, ck.tien_mat_dem_duoc, ck.chenh_lech, ck.giai_trinh,
       ck.tong_chuyen_khoan, ck.so_giao_dich_chuyen_khoan, ck.chot_luc
FROM chot_ket ck
JOIN ca_truc c    ON c.id = ck.ca_truc_id
JOIN nhan_vien lt ON lt.id = c.nhan_vien_id
JOIN nhan_vien nv ON nv.id = ck.nhan_vien_id;

COMMIT;
