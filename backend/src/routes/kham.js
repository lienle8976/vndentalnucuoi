// UC20–UC29: chờ khám, phiếu điều trị, kê đơn, vật tư, liệu trình, tái khám, lịch sử sửa phiếu
import { Router } from 'express';
import { q, q1, tx, rong, LoiNghiepVu } from '../db.js';
import { can, coVaiTro } from '../auth.js';

const r = Router();
const BAC_SI = can('BAC_SI', 'QUAN_LY');
r.use(BAC_SI);

// UC20: danh sách chờ khám hôm nay (bác sĩ xem của mình; quản lý xem tất cả hoặc lọc)
r.get('/cho-kham', async (req, res) => {
  let bacSi = rong(req.query.bac_si_id) ?? null;
  if (!coVaiTro(req.user, 'QUAN_LY')) bacSi = req.user.id;
  res.json(await q(
    `SELECT v.*, l.den_luc, p.id AS phieu_id, p.trang_thai AS trang_thai_phieu,
            b.di_ung, date_part('year', age(b.ngay_sinh))::int AS tuoi
     FROM v_lich_hen v JOIN lich_hen l ON l.id = v.id JOIN benh_nhan b ON b.id = v.benh_nhan_id
     LEFT JOIN phieu_dieu_tri p ON p.lich_hen_id = v.id
     WHERE v.ngay = current_date AND v.trang_thai IN ('DA_DEN', 'DANG_KHAM', 'HOAN_THANH')
       AND ($1::bigint IS NULL OR v.bac_si_id = $1)
     ORDER BY (v.trang_thai = 'HOAN_THANH'), l.den_luc NULLS LAST, v.gio_bat_dau`,
    [bacSi],
  ));
});

// UC21: mở phiếu cho lịch đã check-in (đã có thì trả về phiếu cũ)
r.post('/phieu', async (req, res) => {
  const lichHenId = Number(req.body?.lich_hen_id);
  const daCo = await q1(`SELECT id FROM phieu_dieu_tri WHERE lich_hen_id = $1`, [lichHenId]);
  if (daCo) return res.json(daCo);
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO phieu_dieu_tri (lich_hen_id) VALUES ($1) RETURNING id`, [lichHenId]));
  res.status(201).json(row);
});

r.get('/phieu/:id', async (req, res) => {
  const id = Number(req.params.id);
  const phieu = await q1(
    `SELECT p.*, l.gio_bat_dau, g.ma_ghe, bs.ho_ten AS bac_si_chinh, l.dich_vu_du_kien_id, dv.ten AS dich_vu_du_kien,
            l.ghi_chu AS ghi_chu_lich
     FROM phieu_dieu_tri p JOIN lich_hen l ON l.id = p.lich_hen_id JOIN ghe g ON g.id = l.ghe_id
     JOIN nhan_vien bs ON bs.id = p.bac_si_chinh_id JOIN dich_vu dv ON dv.id = l.dich_vu_du_kien_id
     WHERE p.id = $1`, [id]);
  if (!phieu) throw new LoiNghiepVu(404, 'Không tìm thấy phiếu điều trị');

  const [benh_nhan, dong, don_thuoc, vat_tu, chi_dinh, lieu_trinh, goi_y_vat_tu, hoa_don, lich_su_kham] = await Promise.all([
    q1(`SELECT id, ma_benh_nhan, ho_ten, ngay_sinh, date_part('year', age(ngay_sinh))::int AS tuoi, gioi_tinh,
               so_dien_thoai, nguoi_giam_ho, quan_he_giam_ho, tien_su_benh, di_ung, ghi_chu
        FROM benh_nhan WHERE id = $1`, [phieu.benh_nhan_id]),
    q(`SELECT d.*, dv.ten AS dich_vu, dv.ma_dich_vu, n.ho_ten AS bac_si_thuc_hien, lt.ma_lieu_trinh,
              lt.ten AS lieu_trinh, gia_dich_vu(d.dich_vu_id, $2) AS don_gia_tham_khao
       FROM dong_dieu_tri d JOIN dich_vu dv ON dv.id = d.dich_vu_id JOIN nhan_vien n ON n.id = d.bac_si_thuc_hien_id
       LEFT JOIN lieu_trinh lt ON lt.id = d.lieu_trinh_id
       WHERE d.phieu_dieu_tri_id = $1 ORDER BY d.id`, [id, phieu.ngay_kham]),
    q(`SELECT t.*, m.ten, m.don_vi_tinh, m.ton_kho, gia_thuoc(t.thuoc_id, $2) AS don_gia
       FROM don_thuoc t JOIN thuoc_vat_tu m ON m.id = t.thuoc_id
       WHERE t.phieu_dieu_tri_id = $1 ORDER BY t.id`, [id, phieu.ngay_kham]),
    q(`SELECT v.*, m.ten, m.don_vi_tinh, m.ton_kho, m.nguong_toi_thieu
       FROM vat_tu_su_dung v JOIN thuoc_vat_tu m ON m.id = v.thuoc_vat_tu_id
       WHERE v.phieu_dieu_tri_id = $1 ORDER BY m.ten`, [id]),
    q(`SELECT c.*, dv.ten AS dich_vu,
              (SELECT l.ngay FROM lich_hen l WHERE l.chi_dinh_tai_kham_id = c.id
                 AND l.trang_thai NOT IN ('DA_HUY', 'KHONG_DEN') ORDER BY l.ngay LIMIT 1) AS da_dat_ngay
       FROM chi_dinh_tai_kham c LEFT JOIN dich_vu dv ON dv.id = c.dich_vu_id
       WHERE c.phieu_dieu_tri_id = $1 ORDER BY c.id`, [id]),
    q(`SELECT lt.id, lt.ma_lieu_trinh, lt.ten, lt.so_buoi_du_kien, lt.gia_tron_goi, bs.ho_ten AS bac_si_phu_trach,
              (SELECT coalesce(max(d.buoi_thu), 0) FROM dong_dieu_tri d WHERE d.lieu_trinh_id = lt.id) AS buoi_lon_nhat
       FROM lieu_trinh lt JOIN nhan_vien bs ON bs.id = lt.bac_si_phu_trach_id
       WHERE lt.benh_nhan_id = $1 AND lt.trang_thai = 'DANG_THUC_HIEN' ORDER BY lt.id`, [phieu.benh_nhan_id]),
    q(`SELECT * FROM goi_y_vat_tu($1)`, [id]),
    q1(`SELECT id, ma_hoa_don, trang_thai, tong_tien, da_thu FROM hoa_don
        WHERE phieu_dieu_tri_id = $1 AND trang_thai <> 'DA_HUY'`, [id]),
    q(`SELECT p.id, p.ma_phieu, p.ngay_kham, p.chan_doan, bs.ho_ten AS bac_si,
              (SELECT string_agg(dv.ten || ' (' || d.rang || ')', '; ' ORDER BY d.id)
               FROM dong_dieu_tri d JOIN dich_vu dv ON dv.id = d.dich_vu_id WHERE d.phieu_dieu_tri_id = p.id) AS cong_viec
       FROM phieu_dieu_tri p JOIN nhan_vien bs ON bs.id = p.bac_si_chinh_id
       WHERE p.benh_nhan_id = $1 AND p.id <> $2 ORDER BY p.ngay_kham DESC LIMIT 10`, [phieu.benh_nhan_id, id]),
  ]);
  res.json({ phieu, benh_nhan, dong, don_thuoc, vat_tu, chi_dinh, lieu_trinh, goi_y_vat_tu, hoa_don, lich_su_kham });
});

// Chẩn đoán, ghi chú (sửa được cả sau khi hoàn tất — A24)
r.patch('/phieu/:id', async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `UPDATE phieu_dieu_tri SET chan_doan = coalesce($2, chan_doan), ghi_chu = coalesce($3, ghi_chu)
     WHERE id = $1 RETURNING id`, [Number(req.params.id), b.chan_doan ?? null, b.ghi_chu ?? null]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy phiếu');
  res.json(row);
});

// Dòng điều trị: dịch vụ + răng + bác sĩ thực hiện (QĐ1, UC25) + liệu trình (UC23)
r.post('/phieu/:id/dong', async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO dong_dieu_tri (phieu_dieu_tri_id, dich_vu_id, rang, so_luong, bac_si_thuc_hien_id,
                                lieu_trinh_id, buoi_thu, ghi_chu)
     VALUES ($1,$2,$3,coalesce($4, 1),$5,$6,$7,$8) RETURNING id`,
    [Number(req.params.id), b.dich_vu_id, b.rang, rong(b.so_luong), rong(b.bac_si_thuc_hien_id),
     rong(b.lieu_trinh_id), rong(b.lieu_trinh_id) ? rong(b.buoi_thu) : null, rong(b.ghi_chu)],
  ));
  res.status(201).json(row);
});

r.put('/phieu/:id/dong/:dongId', async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `UPDATE dong_dieu_tri SET dich_vu_id = $3, rang = $4, so_luong = coalesce($5, 1), bac_si_thuc_hien_id = $6,
            lieu_trinh_id = $7, buoi_thu = $8, ghi_chu = $9
     WHERE id = $2 AND phieu_dieu_tri_id = $1 RETURNING id`,
    [Number(req.params.id), Number(req.params.dongId), b.dich_vu_id, b.rang, rong(b.so_luong),
     b.bac_si_thuc_hien_id, rong(b.lieu_trinh_id), rong(b.lieu_trinh_id) ? rong(b.buoi_thu) : null, rong(b.ghi_chu)],
  ));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy dòng điều trị');
  res.json(row);
});

r.delete('/phieu/:id/dong/:dongId', async (req, res) => {
  await tx(req, (c) => c.q(`DELETE FROM dong_dieu_tri WHERE id = $2 AND phieu_dieu_tri_id = $1`,
    [Number(req.params.id), Number(req.params.dongId)]));
  res.json({ ok: true });
});

// UC22: kê đơn thuốc
r.post('/phieu/:id/thuoc', async (req, res) => {
  const b = req.body ?? {};
  if (!b.thuoc_id || !b.lieu_dung || !b.so_luong) throw new LoiNghiepVu(400, 'Chọn thuốc, ghi liều dùng và số lượng');
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO don_thuoc (phieu_dieu_tri_id, thuoc_id, lieu_dung, so_luong, ghi_chu)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [Number(req.params.id), b.thuoc_id, b.lieu_dung, b.so_luong, rong(b.ghi_chu)]));
  res.status(201).json(row);
});

r.delete('/phieu/:id/thuoc/:tid', async (req, res) => {
  await tx(req, (c) => c.q(`DELETE FROM don_thuoc WHERE id = $2 AND phieu_dieu_tri_id = $1`,
    [Number(req.params.id), Number(req.params.tid)]));
  res.json({ ok: true });
});

// UC26: vật tư — áp gợi ý theo định mức, sửa số lượng, thêm / bỏ
r.post('/phieu/:id/vat-tu/goi-y', async (req, res) => {
  const row = await tx(req, (c) => c.q1(`SELECT ap_dung_goi_y_vat_tu($1) AS so_dong`, [Number(req.params.id)]));
  res.json(row);
});

r.put('/phieu/:id/vat-tu', async (req, res) => {
  const b = req.body ?? {};
  if (!b.thuoc_vat_tu_id || !(Number(b.so_luong) > 0)) throw new LoiNghiepVu(400, 'Chọn vật tư và số lượng > 0');
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO vat_tu_su_dung (phieu_dieu_tri_id, thuoc_vat_tu_id, so_luong, ghi_chu)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (phieu_dieu_tri_id, thuoc_vat_tu_id) DO UPDATE SET so_luong = EXCLUDED.so_luong,
       ghi_chu = coalesce(EXCLUDED.ghi_chu, vat_tu_su_dung.ghi_chu)
     RETURNING id`,
    [Number(req.params.id), b.thuoc_vat_tu_id, b.so_luong, rong(b.ghi_chu)]));
  res.json(row);
});

r.delete('/phieu/:id/vat-tu/:vid', async (req, res) => {
  await tx(req, (c) => c.q(`DELETE FROM vat_tu_su_dung WHERE id = $2 AND phieu_dieu_tri_id = $1`,
    [Number(req.params.id), Number(req.params.vid)]));
  res.json({ ok: true });
});

// UC27: chỉ định tái khám
r.post('/phieu/:id/chi-dinh', async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO chi_dinh_tai_kham (phieu_dieu_tri_id, sau_so_ngay, ngay_du_kien, dich_vu_id, ghi_chu)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [Number(req.params.id), rong(b.sau_so_ngay), rong(b.ngay_du_kien), rong(b.dich_vu_id), rong(b.ghi_chu)]));
  res.status(201).json(row);
});

r.delete('/phieu/:id/chi-dinh/:cid', async (req, res) => {
  await tx(req, (c) => c.q(`DELETE FROM chi_dinh_tai_kham WHERE id = $2 AND phieu_dieu_tri_id = $1
                            AND NOT EXISTS (SELECT 1 FROM lich_hen WHERE chi_dinh_tai_kham_id = $2)`,
    [Number(req.params.id), Number(req.params.cid)]));
  res.json({ ok: true });
});

// Hoàn tất phiếu → lịch Hoàn thành, trừ kho, cảnh báo dưới ngưỡng (UC21 bước 5–6, UC42)
r.post('/phieu/:id/hoan-tat', async (req, res) => {
  const row = await tx(req, (c) => c.q1(
    `UPDATE phieu_dieu_tri SET trang_thai = 'HOAN_TAT' WHERE id = $1 AND trang_thai = 'DANG_LAP' RETURNING id`,
    [Number(req.params.id)]));
  if (!row) throw new LoiNghiepVu(400, 'Phiếu không tồn tại hoặc đã hoàn tất');
  res.json(row);
});

// UC29: lịch sử chỉnh sửa phiếu
r.get('/phieu/:id/lich-su', async (req, res) => {
  res.json(await q(
    `SELECT s.id, s.bang, s.ban_ghi_id, s.hanh_dong, s.gia_tri_cu, s.gia_tri_moi, s.thoi_diem, n.ho_ten AS nguoi_sua
     FROM lich_su_sua_phieu s LEFT JOIN nhan_vien n ON n.id = s.nhan_vien_id
     WHERE s.phieu_dieu_tri_id = $1 ORDER BY s.thoi_diem DESC, s.id DESC`, [Number(req.params.id)]));
});

// UC24: tạo liệu trình + kế hoạch các đợt thanh toán (tổng các đợt = giá trọn gói)
r.post('/lieu-trinh', async (req, res) => {
  const b = req.body ?? {};
  const dots = Array.isArray(b.dots) ? b.dots : [];
  if (!b.benh_nhan_id || !b.ten || !b.so_buoi_du_kien || !b.gia_tron_goi || !dots.length) {
    throw new LoiNghiepVu(400, 'Nhập tên, số buổi, giá trọn gói và ít nhất một đợt thanh toán');
  }
  const row = await tx(req, async (c) => {
    const lt = await c.q1(
      `INSERT INTO lieu_trinh (benh_nhan_id, bac_si_phu_trach_id, dich_vu_id, ten, so_buoi_du_kien, gia_tron_goi, ghi_chu)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, ma_lieu_trinh`,
      [b.benh_nhan_id, b.bac_si_phu_trach_id ?? req.user.id, rong(b.dich_vu_id), b.ten, b.so_buoi_du_kien,
       b.gia_tron_goi, rong(b.ghi_chu)]);
    for (const [i, d] of dots.entries()) {
      await c.q(`INSERT INTO dot_thanh_toan (lieu_trinh_id, dot_so, so_tien, ngay_du_kien, ghi_chu) VALUES ($1,$2,$3,$4,$5)`,
        [lt.id, i + 1, d.so_tien, rong(d.ngay_du_kien), rong(d.ghi_chu)]);
    }
    return lt;
  });
  res.status(201).json(row);
});

// Kết thúc / hủy liệu trình
r.patch('/lieu-trinh/:id', async (req, res) => {
  const b = req.body ?? {};
  if (!['HOAN_THANH', 'DA_HUY'].includes(b.trang_thai)) throw new LoiNghiepVu(400, 'Trạng thái không hợp lệ');
  const row = await tx(req, (c) => c.q1(
    `UPDATE lieu_trinh SET trang_thai = $2, ly_do_huy = $3 WHERE id = $1 RETURNING id`,
    [Number(req.params.id), b.trang_thai, b.trang_thai === 'DA_HUY' ? rong(b.ly_do_huy) : null]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy liệu trình');
  res.json(row);
});

export default r;
