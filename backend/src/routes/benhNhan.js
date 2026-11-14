// UC04–UC08: tra cứu, đăng ký, cập nhật, xem hồ sơ bệnh nhân, chuyển hồ sơ giấy
import { Router } from 'express';
import { q, q1, tx, rong, cauUpdate, LoiNghiepVu } from '../db.js';
import { can, coVaiTro } from '../auth.js';

const r = Router();

const COT_BENH_NHAN = [
  'ho_ten', 'ngay_sinh', 'gioi_tinh', 'so_dien_thoai', 'dia_chi', 'nguoi_giam_ho', 'quan_he_giam_ho',
  'tien_su_benh', 'di_ung', 'ghi_chu', 'dang_hoat_dong', 'ly_do_ngung',
];

// UC04: tìm theo SĐT, mã BN, hoặc tên (không dấu, gần đúng)
r.get('/', async (req, res) => {
  const tu = String(req.query.q ?? '').trim();
  const rows = await q(
    `SELECT t.id, t.ma_benh_nhan, t.ho_ten, t.ngay_sinh, t.tuoi, t.so_dien_thoai, t.nguoi_giam_ho,
            t.quan_he_giam_ho, t.nguon_ho_so, t.dang_hoat_dong, t.lan_kham_cuoi, t.lich_sap_toi,
            coalesce(cn.tong_no, 0) AS cong_no
     FROM v_benh_nhan_tong_quan t
     LEFT JOIN v_cong_no_benh_nhan cn ON cn.benh_nhan_id = t.id
     WHERE $1 = ''
        OR t.so_dien_thoai LIKE $1 || '%'
        OR t.ma_benh_nhan ILIKE '%' || $1 || '%'
        OR khong_dau(t.ho_ten) LIKE '%' || khong_dau($1) || '%'
     ORDER BY (t.so_dien_thoai = $1) DESC, t.ho_ten
     LIMIT 50`,
    [tu],
  );
  res.json(rows);
});

// QĐ2: những người đang dùng SĐT này
r.get('/kiem-tra-sdt', async (req, res) => {
  res.json(await q(
    `SELECT id, ma_benh_nhan, ho_ten, ngay_sinh, nguoi_giam_ho FROM benh_nhan WHERE so_dien_thoai = $1 ORDER BY ngay_sinh`,
    [String(req.query.sdt ?? '')],
  ));
});

// UC05 + UC08: đăng ký bệnh nhân mới (cảnh báo khi SĐT đã có người dùng)
r.post('/', can('LE_TAN', 'QUAN_LY'), async (req, res) => {
  const b = req.body ?? {};
  if (!b.ho_ten?.trim() || !b.ngay_sinh || !b.so_dien_thoai) {
    throw new LoiNghiepVu(400, 'Họ tên, ngày sinh và số điện thoại là bắt buộc');
  }
  const trung = await q(
    `SELECT id, ma_benh_nhan, ho_ten, ngay_sinh, nguoi_giam_ho FROM benh_nhan WHERE so_dien_thoai = $1 ORDER BY ngay_sinh`,
    [b.so_dien_thoai],
  );
  if (trung.length && !b.xac_nhan_nguoi_khac) {
    return res.status(409).json({
      loi: 'Số điện thoại này đã có người dùng. Kiểm tra lại, nếu đúng là người khác thì xác nhận để tạo mới.',
      can_xac_nhan: true,
      trung,
    });
  }
  const giay = b.nguon_ho_so === 'HO_SO_GIAY';
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO benh_nhan (ho_ten, ngay_sinh, gioi_tinh, so_dien_thoai, dia_chi, nguoi_giam_ho, quan_he_giam_ho,
                            tien_su_benh, di_ung, ghi_chu, nguon_ho_so, so_ho_so_giay, ngay_kham_gan_nhat_giay)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, ma_benh_nhan`,
    [b.ho_ten.trim(), b.ngay_sinh, rong(b.gioi_tinh), b.so_dien_thoai, rong(b.dia_chi), rong(b.nguoi_giam_ho),
     rong(b.quan_he_giam_ho), rong(b.tien_su_benh), rong(b.di_ung), rong(b.ghi_chu),
     giay ? 'HO_SO_GIAY' : 'MOI', giay ? rong(b.so_ho_so_giay) : null, giay ? rong(b.ngay_kham_gan_nhat_giay) : null],
  ));
  res.status(201).json(row);
});

// UC07: hồ sơ bệnh nhân. Lễ tân xem thông tin hành chính + công nợ; bác sĩ, quản lý xem đủ bệnh án
r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const bn = await q1(
    `SELECT b.*, t.tuoi, t.lan_kham_cuoi, t.lich_sap_toi, coalesce(cn.tong_no, 0) AS cong_no
     FROM benh_nhan b JOIN v_benh_nhan_tong_quan t ON t.id = b.id
     LEFT JOIN v_cong_no_benh_nhan cn ON cn.benh_nhan_id = b.id
     WHERE b.id = $1`,
    [id],
  );
  if (!bn) throw new LoiNghiepVu(404, 'Không tìm thấy bệnh nhân');
  const xemBenhAn = coVaiTro(req.user, 'BAC_SI', 'QUAN_LY');

  const [lich_hen, hoa_don, lieu_trinh, tai_lieu, cung_sdt, phieu] = await Promise.all([
    q(`SELECT v.id, v.ngay, v.gio_bat_dau, v.ma_ghe, v.bac_si, v.dich_vu_du_kien, v.trang_thai, v.ghi_chu,
              ld.ten AS ly_do_huy
       FROM v_lich_hen v JOIN lich_hen l ON l.id = v.id LEFT JOIN ly_do_huy ld ON ld.id = l.ly_do_huy_id
       WHERE v.benh_nhan_id = $1 ORDER BY v.ngay DESC, v.gio_bat_dau DESC`, [id]),
    q(`SELECT id, ma_hoa_don, loai, ngay_lap, tong_tien, da_thu, con_no, trang_thai
       FROM hoa_don WHERE benh_nhan_id = $1 ORDER BY ngay_lap DESC, id DESC`, [id]),
    q(`SELECT lt.id, lt.ma_lieu_trinh, lt.ten, lt.so_buoi_du_kien, lt.gia_tron_goi, lt.trang_thai, lt.ngay_bat_dau,
              lt.ngay_ket_thuc, bs.ho_ten AS bac_si_phu_trach,
              (SELECT count(DISTINCT d.buoi_thu) FROM dong_dieu_tri d JOIN phieu_dieu_tri p ON p.id = d.phieu_dieu_tri_id
               WHERE d.lieu_trinh_id = lt.id AND p.trang_thai = 'HOAN_TAT') AS so_buoi_da_lam,
              (SELECT coalesce(sum(h.da_thu), 0) FROM dot_thanh_toan dt
               JOIN hoa_don h ON h.dot_thanh_toan_id = dt.id AND h.trang_thai = 'DA_CHOT'
               WHERE dt.lieu_trinh_id = lt.id) AS da_thu
       FROM lieu_trinh lt JOIN nhan_vien bs ON bs.id = lt.bac_si_phu_trach_id
       WHERE lt.benh_nhan_id = $1 ORDER BY lt.ngay_bat_dau DESC`, [id]),
    q(`SELECT id, ten_file, duong_dan, mo_ta, tai_len_luc FROM tai_lieu_ho_so WHERE benh_nhan_id = $1 ORDER BY id`, [id]),
    q(`SELECT id, ma_benh_nhan, ho_ten, ngay_sinh FROM benh_nhan WHERE so_dien_thoai = $1 AND id <> $2`, [bn.so_dien_thoai, id]),
    xemBenhAn
      ? q(`SELECT v.id, v.ma_phieu, v.ngay_kham, v.gio_bat_dau, v.ma_ghe, v.trang_thai, v.bac_si_chinh,
                  v.cac_bac_si_thuc_hien, v.chan_doan,
                  (SELECT string_agg(dv.ten || ' (' || d.rang || ')', '; ' ORDER BY d.id)
                   FROM dong_dieu_tri d JOIN dich_vu dv ON dv.id = d.dich_vu_id
                   WHERE d.phieu_dieu_tri_id = v.id) AS cong_viec,
                  (SELECT string_agg(m.ten || ' x' || t.so_luong, '; ')
                   FROM don_thuoc t JOIN thuoc_vat_tu m ON m.id = t.thuoc_id
                   WHERE t.phieu_dieu_tri_id = v.id) AS don_thuoc
           FROM v_phieu_dieu_tri v WHERE v.benh_nhan_id = $1 ORDER BY v.ngay_kham DESC`, [id])
      : Promise.resolve(null),
  ]);

  res.json({ benh_nhan: bn, lich_hen, hoa_don, lieu_trinh, tai_lieu, cung_sdt, phieu, xem_benh_an: xemBenhAn });
});

// UC06: cập nhật thông tin bệnh nhân
r.put('/:id', can('LE_TAN', 'QUAN_LY'), async (req, res) => {
  const cu = cauUpdate('benh_nhan', COT_BENH_NHAN, req.body ?? {}, Number(req.params.id));
  if (!cu) throw new LoiNghiepVu(400, 'Không có thông tin cần cập nhật');
  const row = await tx(req, (c) => c.q1(cu.sql, cu.params));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy bệnh nhân');
  res.json(row);
});

export default r;
