// UC01 Đăng nhập, UC02 Đổi mật khẩu
import { Router } from 'express';
import { q1 } from '../db.js';
import { datPhien, xoaPhien, taiNguoiDung, requireAuth } from '../auth.js';

const r = Router();

r.post('/dang-nhap', async (req, res) => {
  const { ten_dang_nhap, mat_khau } = req.body ?? {};
  if (!ten_dang_nhap || !mat_khau) return res.status(400).json({ loi: 'Nhập tên đăng nhập và mật khẩu' });
  // So mật khẩu ngay trong DB bằng crypt() (bcrypt)
  const nv = await q1(
    `UPDATE nhan_vien SET dang_nhap_cuoi_luc = now()
     WHERE lower(ten_dang_nhap) = lower($1) AND dang_hoat_dong AND mat_khau_hash = crypt($2, mat_khau_hash)
     RETURNING id`,
    [ten_dang_nhap, mat_khau],
  );
  if (!nv) return res.status(401).json({ loi: 'Sai tên đăng nhập hoặc mật khẩu' });
  datPhien(res, nv.id);
  res.json(await taiNguoiDung(nv.id));
});

r.post('/dang-xuat', (_req, res) => {
  xoaPhien(res);
  res.json({ ok: true });
});

r.get('/toi', requireAuth, (req, res) => res.json(req.user));

r.post('/doi-mat-khau', requireAuth, async (req, res) => {
  const { mat_khau_cu, mat_khau_moi } = req.body ?? {};
  if (!mat_khau_moi || mat_khau_moi.length < 8) {
    return res.status(400).json({ loi: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
  }
  const ok = await q1(
    `UPDATE nhan_vien SET mat_khau_hash = crypt($3, gen_salt('bf', 10)), doi_mat_khau_luc = now()
     WHERE id = $1 AND mat_khau_hash = crypt($2, mat_khau_hash) RETURNING id`,
    [req.user.id, mat_khau_cu ?? '', mat_khau_moi],
  );
  if (!ok) return res.status(400).json({ loi: 'Mật khẩu hiện tại không đúng' });
  res.json({ ok: true });
});

export default r;
