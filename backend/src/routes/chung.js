// Danh mục dùng chung cho các form + số liệu trang chủ
import { Router } from 'express';
import { q, q1 } from '../db.js';

const r = Router();

// Dữ liệu cho dropdown: ghế, dịch vụ (kèm giá hiện hành), bác sĩ, lễ tân, lý do hủy, thuốc/vật tư
r.get('/danh-muc', async (_req, res) => {
  const [ghe, dich_vu, bac_si, le_tan, ly_do_huy, mat_hang, gio_mo_cua] = await Promise.all([
    q(`SELECT id, ma_ghe, ten FROM ghe WHERE dang_hoat_dong ORDER BY ma_ghe`),
    q(`SELECT id, ma_dich_vu, ten, nhom, don_vi_tinh, la_lieu_trinh, gia_dich_vu(id) AS don_gia
       FROM dich_vu WHERE dang_hoat_dong ORDER BY nhom, ten`),
    q(`SELECT n.id, n.ho_ten, n.ban_thoi_gian FROM nhan_vien n
       JOIN nhan_vien_vai_tro r ON r.nhan_vien_id = n.id AND r.vai_tro_ma = 'BAC_SI'
       WHERE n.dang_hoat_dong ORDER BY n.ho_ten`),
    q(`SELECT n.id, n.ho_ten FROM nhan_vien n
       JOIN nhan_vien_vai_tro r ON r.nhan_vien_id = n.id AND r.vai_tro_ma = 'LE_TAN'
       WHERE n.dang_hoat_dong ORDER BY n.ho_ten`),
    q(`SELECT id, ten FROM ly_do_huy WHERE dang_hoat_dong ORDER BY id`),
    q(`SELECT id, ma, ten, loai, don_vi_tinh, ton_kho, nguong_toi_thieu,
              CASE WHEN loai = 'THUOC' THEN gia_thuoc(id) END AS don_gia
       FROM thuoc_vat_tu WHERE dang_hoat_dong ORDER BY loai, ten`),
    q(`SELECT * FROM gio_mo_cua ORDER BY thu`),
  ]);
  res.json({ ghe, dich_vu, bac_si, le_tan, ly_do_huy, mat_hang, gio_mo_cua });
});

// Trang chủ: số việc cần làm theo vai trò
r.get('/tong-quan', async (req, res) => {
  const row = await q1(
    `SELECT
       (SELECT count(*) FROM lich_hen WHERE ngay = current_date AND trang_thai <> 'DA_HUY')                       AS lich_hom_nay,
       (SELECT count(*) FROM lich_hen WHERE ngay = current_date AND trang_thai IN ('DA_DEN', 'DANG_KHAM'))       AS dang_cho_kham,
       (SELECT count(*) FROM lich_hen WHERE ngay = current_date AND trang_thai = 'HOAN_THANH')                   AS da_kham_xong,
       (SELECT count(*) FROM lich_hen WHERE ngay = current_date AND trang_thai IN ('DA_DEN', 'DANG_KHAM')
                                       AND bac_si_id = $1)                                                        AS cho_kham_cua_toi,
       (SELECT count(*) FROM v_danh_sach_nhac_lich
         WHERE lan_nhac_cuoi_ket_qua IS NULL OR lan_nhac_cuoi_ket_qua NOT IN ('XAC_NHAN', 'SMS_DA_GUI'))           AS can_nhac_lich,
       (SELECT count(*) FROM v_phieu_cho_lap_hoa_don)                                                             AS phieu_cho_lap_hd,
       (SELECT count(*) FROM hoa_don WHERE trang_thai = 'NHAP')                                                   AS hoa_don_nhap,
       (SELECT count(*) FROM v_canh_bao_ton_kho)                                                                  AS canh_bao_kho,
       (SELECT coalesce(sum(tong_no), 0) FROM v_cong_no_benh_nhan)                                                AS tong_cong_no,
       (SELECT doanh_thu FROM v_so_sanh_doanh_thu_thang WHERE thang = date_trunc('month', current_date)::date)   AS doanh_thu_thang,
       (SELECT thay_doi_pct FROM v_so_sanh_doanh_thu_thang WHERE thang = date_trunc('month', current_date)::date) AS doanh_thu_thay_doi_pct,
       (SELECT count(*) FROM v_benh_nhan_qua_6_thang)                                                             AS qua_6_thang`,
    [req.user.id],
  );
  res.json(row);
});

export default r;
