// UC03 tài khoản & phân quyền; UC43 danh mục chung (ghế, lý do hủy, giờ mở cửa, ngày nghỉ, tỷ lệ ăn chia)
import { Router } from 'express';
import { q, tx, rong, cauUpdate, LoiNghiepVu } from '../db.js';
import { can } from '../auth.js';

const r = Router();
r.use(can('QUAN_LY'));

const VAI_TRO = ['LE_TAN', 'BAC_SI', 'QUAN_LY'];

r.get('/nhan-vien', async (_req, res) => {
  res.json(await q(
    `SELECT n.id, n.ma_nhan_vien, n.ho_ten, n.so_dien_thoai, n.email, n.ten_dang_nhap, n.ban_thoi_gian,
            n.dang_hoat_dong, n.dang_nhap_cuoi_luc, n.doi_mat_khau_luc,
            coalesce(array_agg(r.vai_tro_ma ORDER BY r.vai_tro_ma) FILTER (WHERE r.vai_tro_ma IS NOT NULL), '{}') AS vai_tro
     FROM nhan_vien n LEFT JOIN nhan_vien_vai_tro r ON r.nhan_vien_id = n.id
     GROUP BY n.id ORDER BY n.dang_hoat_dong DESC, n.ma_nhan_vien`));
});

async function ghiVaiTro(c, id, vaiTro) {
  const ds = (Array.isArray(vaiTro) ? vaiTro : []).filter((v) => VAI_TRO.includes(v));
  if (!ds.length) throw new LoiNghiepVu(400, 'Chọn ít nhất một vai trò');
  await c.q(`DELETE FROM nhan_vien_vai_tro WHERE nhan_vien_id = $1`, [id]);
  for (const v of ds) await c.q(`INSERT INTO nhan_vien_vai_tro (nhan_vien_id, vai_tro_ma) VALUES ($1, $2)`, [id, v]);
}

r.post('/nhan-vien', async (req, res) => {
  const b = req.body ?? {};
  if (!b.ma_nhan_vien || !b.ho_ten || !b.ten_dang_nhap || !b.mat_khau) {
    throw new LoiNghiepVu(400, 'Nhập mã, họ tên, tên đăng nhập và mật khẩu');
  }
  if (b.mat_khau.length < 8) throw new LoiNghiepVu(400, 'Mật khẩu phải có ít nhất 8 ký tự');
  const row = await tx(req, async (c) => {
    const nv = await c.q1(
      `INSERT INTO nhan_vien (ma_nhan_vien, ho_ten, so_dien_thoai, email, ten_dang_nhap, mat_khau_hash, ban_thoi_gian)
       VALUES ($1,$2,$3,$4,$5,crypt($6, gen_salt('bf', 10)),coalesce($7,false)) RETURNING id`,
      [b.ma_nhan_vien, b.ho_ten, rong(b.so_dien_thoai), rong(b.email), b.ten_dang_nhap, b.mat_khau, b.ban_thoi_gian]);
    await ghiVaiTro(c, nv.id, b.vai_tro);
    return nv;
  });
  res.status(201).json(row);
});

r.put('/nhan-vien/:id', async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body ?? {};
  if (id === req.user.id && b.dang_hoat_dong === false) throw new LoiNghiepVu(400, 'Không tự khóa tài khoản đang dùng');
  await tx(req, async (c) => {
    const cu = cauUpdate('nhan_vien', ['ma_nhan_vien', 'ho_ten', 'so_dien_thoai', 'email', 'ten_dang_nhap',
      'ban_thoi_gian', 'dang_hoat_dong'], b, id);
    if (cu) await c.q(cu.sql, cu.params);
    if (b.vai_tro) await ghiVaiTro(c, id, b.vai_tro);
  });
  res.json({ ok: true });
});

r.post('/nhan-vien/:id/dat-lai-mat-khau', async (req, res) => {
  const mk = req.body?.mat_khau_moi ?? '';
  if (mk.length < 8) throw new LoiNghiepVu(400, 'Mật khẩu phải có ít nhất 8 ký tự');
  await tx(req, (c) => c.q(`UPDATE nhan_vien SET mat_khau_hash = crypt($2, gen_salt('bf', 10)), doi_mat_khau_luc = NULL WHERE id = $1`,
    [Number(req.params.id), mk]));
  res.json({ ok: true });
});

// UC43: danh mục chung
r.get('/danh-muc', async (_req, res) => {
  const [ghe, ly_do_huy, gio_mo_cua, ngay_nghi, ty_le_an_chia] = await Promise.all([
    q(`SELECT * FROM ghe ORDER BY ma_ghe`),
    q(`SELECT l.*, (SELECT count(*) FROM lich_hen h WHERE h.ly_do_huy_id = l.id) AS so_lan_dung FROM ly_do_huy l ORDER BY l.id`),
    q(`SELECT * FROM gio_mo_cua ORDER BY thu`),
    q(`SELECT * FROM ngay_nghi WHERE ngay >= current_date - 30 ORDER BY ngay`),
    q(`SELECT t.*, n.ho_ten,
              (t.hieu_luc_tu = (SELECT max(x.hieu_luc_tu) FROM ty_le_an_chia x
                                WHERE x.bac_si_id = t.bac_si_id AND x.hieu_luc_tu <= current_date)) AS dang_ap_dung
       FROM ty_le_an_chia t JOIN nhan_vien n ON n.id = t.bac_si_id ORDER BY n.ho_ten, t.hieu_luc_tu DESC`),
  ]);
  res.json({ ghe, ly_do_huy, gio_mo_cua, ngay_nghi, ty_le_an_chia });
});

r.post('/ghe', async (req, res) => {
  const b = req.body ?? {};
  res.status(201).json(await tx(req, (c) => c.q1(`INSERT INTO ghe (ma_ghe, ten) VALUES ($1, $2) RETURNING id`, [b.ma_ghe, b.ten])));
});
r.put('/ghe/:id', async (req, res) => {
  const cu = cauUpdate('ghe', ['ma_ghe', 'ten', 'dang_hoat_dong'], req.body ?? {}, Number(req.params.id));
  res.json(await tx(req, (c) => c.q1(cu.sql, cu.params)));
});

r.post('/ly-do-huy', async (req, res) => {
  res.status(201).json(await tx(req, (c) => c.q1(`INSERT INTO ly_do_huy (ten) VALUES ($1) RETURNING id`, [req.body?.ten])));
});
r.put('/ly-do-huy/:id', async (req, res) => {
  const cu = cauUpdate('ly_do_huy', ['ten', 'dang_hoat_dong'], req.body ?? {}, Number(req.params.id));
  res.json(await tx(req, (c) => c.q1(cu.sql, cu.params)));
});

r.put('/gio-mo-cua/:thu', async (req, res) => {
  const cu = cauUpdate('gio_mo_cua', ['gio_mo', 'gio_dong', 'nghi'], req.body ?? {}, Number(req.params.thu), 'thu');
  res.json(await tx(req, (c) => c.q1(cu.sql, cu.params)));
});

r.post('/ngay-nghi', async (req, res) => {
  const b = req.body ?? {};
  const daCoLich = await q(`SELECT count(*)::int AS n FROM lich_hen WHERE ngay = $1 AND trang_thai IN ('DA_DAT','DA_NHAC')`, [b.ngay]);
  if (daCoLich[0].n > 0) throw new LoiNghiepVu(400, `Ngày này còn ${daCoLich[0].n} lịch hẹn chưa hủy. Hãy đổi/hủy các lịch đó trước`);
  res.status(201).json(await tx(req, (c) => c.q1(`INSERT INTO ngay_nghi (ngay, ly_do) VALUES ($1, $2) RETURNING ngay`, [b.ngay, b.ly_do])));
});
r.delete('/ngay-nghi/:ngay', async (req, res) => {
  await tx(req, (c) => c.q(`DELETE FROM ngay_nghi WHERE ngay = $1`, [req.params.ngay]));
  res.json({ ok: true });
});

r.post('/ty-le-an-chia', async (req, res) => {
  const b = req.body ?? {};
  res.status(201).json(await tx(req, (c) => c.q1(
    `INSERT INTO ty_le_an_chia (bac_si_id, ty_le, hieu_luc_tu, ghi_chu) VALUES ($1,$2,$3,$4) RETURNING id`,
    [b.bac_si_id, b.ty_le, b.hieu_luc_tu, rong(b.ghi_chu)])));
});

export default r;
