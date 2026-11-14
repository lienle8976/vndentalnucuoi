// UC09 Xếp ca trực, UC10 Xem lịch trực
import { Router } from 'express';
import { q, tx, rong, laNgay, LoiNghiepVu } from '../db.js';
import { can, coVaiTro } from '../auth.js';

const r = Router();

r.get('/', async (req, res) => {
  const tu = laNgay(req.query.tu);
  const den = laNgay(req.query.den);
  res.json(await q(
    `SELECT c.id, c.nhan_vien_id, n.ho_ten, c.vai_tro_ma, c.ngay, c.gio_bat_dau, c.gio_ket_thuc, c.ten_ca, c.ghi_chu,
            EXISTS (SELECT 1 FROM chot_ket k WHERE k.ca_truc_id = c.id) AS da_chot_ket
     FROM ca_truc c JOIN nhan_vien n ON n.id = c.nhan_vien_id
     WHERE c.ngay BETWEEN coalesce($1::date, current_date) AND coalesce($2::date, current_date + 6)
     ORDER BY c.ngay, c.vai_tro_ma, c.gio_bat_dau, n.ho_ten`,
    [tu, den],
  ));
});

// Ca lễ tân dùng để gắn phiếu thu / chốt két: của tôi (lễ tân) hoặc mọi ca (quản lý), 7 ngày gần nhất
r.get('/le-tan', async (req, res) => {
  const tatCa = coVaiTro(req.user, 'QUAN_LY');
  res.json(await q(
    `SELECT c.id, c.ngay, c.gio_bat_dau, c.gio_ket_thuc, c.ten_ca, c.nhan_vien_id, n.ho_ten,
            (k.id IS NOT NULL) AS da_chot_ket,
            (c.ngay = current_date AND localtime BETWEEN c.gio_bat_dau AND c.gio_ket_thuc) AS dang_dien_ra
     FROM ca_truc c JOIN nhan_vien n ON n.id = c.nhan_vien_id
     LEFT JOIN chot_ket k ON k.ca_truc_id = c.id
     WHERE c.vai_tro_ma = 'LE_TAN' AND c.ngay BETWEEN current_date - 7 AND current_date
       AND ($1 OR c.nhan_vien_id = $2)
     ORDER BY c.ngay DESC, c.gio_bat_dau`,
    [tatCa, req.user.id],
  ));
});

// Thêm ca cho một hoặc nhiều ngày
r.post('/', can('QUAN_LY'), async (req, res) => {
  const b = req.body ?? {};
  const ngays = Array.isArray(b.ngays) ? b.ngays.filter(laNgay) : [laNgay(b.ngay)].filter(Boolean);
  if (!b.nhan_vien_id || !b.vai_tro_ma || !ngays.length || !b.gio_bat_dau || !b.gio_ket_thuc) {
    throw new LoiNghiepVu(400, 'Chọn nhân viên, vai trò, ngày và giờ bắt đầu/kết thúc');
  }
  const rows = await tx(req, async (c) => {
    const out = [];
    for (const ngay of ngays) {
      out.push(await c.q1(
        `INSERT INTO ca_truc (nhan_vien_id, vai_tro_ma, ngay, gio_bat_dau, gio_ket_thuc, ten_ca, ghi_chu)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [b.nhan_vien_id, b.vai_tro_ma, ngay, b.gio_bat_dau, b.gio_ket_thuc, rong(b.ten_ca), rong(b.ghi_chu)],
      ));
    }
    return out;
  });
  res.status(201).json({ so_ca: rows.length });
});

r.delete('/:id', can('QUAN_LY'), async (req, res) => {
  const row = await tx(req, (c) => c.q1(`DELETE FROM ca_truc WHERE id = $1 RETURNING id`, [Number(req.params.id)]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy ca');
  res.json({ ok: true });
});

export default r;
