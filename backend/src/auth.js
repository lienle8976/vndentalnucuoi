// Đăng nhập bằng cookie httpOnly chứa JWT; phân quyền theo vai trò (A03, A04)
import jwt from 'jsonwebtoken';
import { q1 } from './db.js';

const PROD = process.env.NODE_ENV === 'production';
const SECRET = process.env.CLINIC_JWT_SECRET;
if (!SECRET) throw new Error('Thiếu CLINIC_JWT_SECRET trong .env');
if (PROD && SECRET.length < 32) throw new Error('CLINIC_JWT_SECRET ở production phải dài ít nhất 32 ký tự');

const COOKIE = 'phien';
const THOI_HAN_GIO = 12;
// Production chạy sau HTTPS → cookie chỉ gửi qua HTTPS. Đặt COOKIE_SECURE=false nếu thử bản production qua http.
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: (process.env.COOKIE_SECURE ?? String(PROD)) === 'true',
  path: '/',
};

export function datPhien(res, nhanVienId) {
  const token = jwt.sign({ id: nhanVienId }, SECRET, { expiresIn: `${THOI_HAN_GIO}h` });
  res.cookie(COOKIE, token, { ...COOKIE_OPTS, maxAge: THOI_HAN_GIO * 3600 * 1000 });
}

export function xoaPhien(res) {
  res.clearCookie(COOKIE, COOKIE_OPTS);
}

export async function taiNguoiDung(id) {
  return q1(
    `SELECT n.id, n.ma_nhan_vien, n.ho_ten, n.ten_dang_nhap, n.email, n.doi_mat_khau_luc,
            coalesce(array_agg(r.vai_tro_ma ORDER BY r.vai_tro_ma) FILTER (WHERE r.vai_tro_ma IS NOT NULL), '{}') AS vai_tro
     FROM nhan_vien n LEFT JOIN nhan_vien_vai_tro r ON r.nhan_vien_id = n.id
     WHERE n.id = $1 AND n.dang_hoat_dong
     GROUP BY n.id`,
    [id],
  );
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ loi: 'Chưa đăng nhập' });
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ loi: 'Phiên đăng nhập đã hết hạn' });
  }
  const user = await taiNguoiDung(payload.id);
  if (!user) return res.status(401).json({ loi: 'Tài khoản không còn hoạt động' });
  req.user = user;
  next();
}

export const coVaiTro = (user, ...roles) => roles.some((r) => user.vai_tro.includes(r));

/** Middleware: chỉ cho phép các vai trò được liệt kê */
export const can = (...roles) => (req, res, next) =>
  coVaiTro(req.user, ...roles)
    ? next()
    : res.status(403).json({ loi: 'Bạn không có quyền thực hiện chức năng này' });
