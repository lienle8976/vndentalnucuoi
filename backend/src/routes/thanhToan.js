// UC31–UC37: lập hóa đơn, giảm giá, chốt, hủy, thu tiền, công nợ, chốt két
import { Router } from 'express';
import { q, q1, tx, rong, LoiNghiepVu } from '../db.js';
import { can } from '../auth.js';

const r = Router();
r.use(can('LE_TAN', 'QUAN_LY'));

// Hàng chờ của quầy thu ngân
r.get('/cho-xu-ly', async (_req, res) => {
  const [phieu_cho_lap, dot_den_han, hoa_don_nhap, hoa_don_con_no] = await Promise.all([
    q(`SELECT v.id, v.ma_phieu, v.ngay_kham, v.benh_nhan_id, v.ma_benh_nhan, v.benh_nhan, v.bac_si_chinh,
              v.cac_bac_si_thuc_hien, v.hoan_tat_luc
       FROM v_phieu_cho_lap_hoa_don v ORDER BY v.hoan_tat_luc`),
    q(`SELECT dt.id, dt.dot_so, dt.so_tien, dt.ngay_du_kien, lt.ma_lieu_trinh, lt.ten, lt.benh_nhan_id,
              bn.ho_ten AS benh_nhan, bn.so_dien_thoai
       FROM dot_thanh_toan dt JOIN lieu_trinh lt ON lt.id = dt.lieu_trinh_id JOIN benh_nhan bn ON bn.id = lt.benh_nhan_id
       WHERE lt.trang_thai = 'DANG_THUC_HIEN'
         AND NOT EXISTS (SELECT 1 FROM hoa_don h WHERE h.dot_thanh_toan_id = dt.id AND h.trang_thai <> 'DA_HUY')
         AND coalesce(dt.ngay_du_kien, current_date) <= current_date + 7
       ORDER BY dt.ngay_du_kien NULLS FIRST, dt.dot_so`),
    q(`SELECT h.id, h.ma_hoa_don, h.loai, h.ngay_lap, h.tong_tien, bn.ho_ten AS benh_nhan
       FROM hoa_don h JOIN benh_nhan bn ON bn.id = h.benh_nhan_id
       WHERE h.trang_thai = 'NHAP' ORDER BY h.id`),
    q(`SELECT h.id, h.ma_hoa_don, h.loai, h.ngay_lap, h.tong_tien, h.da_thu, h.con_no, bn.ho_ten AS benh_nhan,
              bn.so_dien_thoai
       FROM hoa_don h JOIN benh_nhan bn ON bn.id = h.benh_nhan_id
       WHERE h.trang_thai = 'DA_CHOT' AND h.con_no > 0 ORDER BY h.ngay_lap DESC, h.id DESC LIMIT 30`),
  ]);
  res.json({ phieu_cho_lap, dot_den_han, hoa_don_nhap, hoa_don_con_no });
});

// Tra cứu hóa đơn
r.get('/hoa-don', async (req, res) => {
  const tu = String(req.query.q ?? '').trim();
  res.json(await q(
    `SELECT h.id, h.ma_hoa_don, h.loai, h.ngay_lap, h.tong_tien, h.da_thu, h.con_no, h.trang_thai,
            bn.ma_benh_nhan, bn.ho_ten AS benh_nhan, bn.so_dien_thoai
     FROM hoa_don h JOIN benh_nhan bn ON bn.id = h.benh_nhan_id
     WHERE $1 = '' OR h.ma_hoa_don ILIKE '%' || $1 || '%' OR bn.so_dien_thoai LIKE $1 || '%'
        OR khong_dau(bn.ho_ten) LIKE '%' || khong_dau($1) || '%'
     ORDER BY h.id DESC LIMIT 50`, [tu]));
});

// UC31 / UC33: lập hóa đơn từ phiếu hoặc từ đợt liệu trình
r.post('/hoa-don/tu-phieu/:phieuId', async (req, res) => {
  const row = await tx(req, (c) => c.q1(`SELECT lap_hoa_don_luot_kham($1) AS id`, [Number(req.params.phieuId)]));
  res.status(201).json(row);
});

r.post('/hoa-don/tu-dot/:dotId', async (req, res) => {
  const row = await tx(req, (c) => c.q1(`SELECT lap_hoa_don_dot_lieu_trinh($1) AS id`, [Number(req.params.dotId)]));
  res.status(201).json(row);
});

r.get('/hoa-don/:id', async (req, res) => {
  const id = Number(req.params.id);
  const hd = await q1(
    `SELECT h.*, bn.ma_benh_nhan, bn.ho_ten AS benh_nhan, bn.so_dien_thoai, bn.dia_chi,
            p.ma_phieu, p.ngay_kham, nt.ho_ten AS nguoi_lap, nc.ho_ten AS nguoi_chot,
            ng.ho_ten AS nguoi_giam_gia, nh.ho_ten AS nguoi_huy,
            lt.ma_lieu_trinh, lt.ten AS lieu_trinh, dt.dot_so
     FROM hoa_don h JOIN benh_nhan bn ON bn.id = h.benh_nhan_id
     LEFT JOIN phieu_dieu_tri p ON p.id = h.phieu_dieu_tri_id
     LEFT JOIN dot_thanh_toan dt ON dt.id = h.dot_thanh_toan_id
     LEFT JOIN lieu_trinh lt ON lt.id = dt.lieu_trinh_id
     LEFT JOIN nhan_vien nt ON nt.id = h.tao_boi
     LEFT JOIN nhan_vien nc ON nc.id = h.chot_boi
     LEFT JOIN nhan_vien ng ON ng.id = h.giam_gia_boi
     LEFT JOIN nhan_vien nh ON nh.id = h.huy_boi
     WHERE h.id = $1`, [id]);
  if (!hd) throw new LoiNghiepVu(404, 'Không tìm thấy hóa đơn');
  const [dong, thanh_toan, tai_kham] = await Promise.all([
    q(`SELECT d.*, n.ho_ten AS bac_si, ng.ho_ten AS nguoi_giam_gia_dong
       FROM dong_hoa_don d LEFT JOIN nhan_vien n ON n.id = d.bac_si_id
       LEFT JOIN nhan_vien ng ON ng.id = d.giam_gia_dong_boi
       WHERE d.hoa_don_id = $1 ORDER BY d.id`, [id]),
    q(`SELECT t.*, n.ho_ten AS nguoi_thu, c.ten_ca, c.ngay AS ngay_ca
       FROM thanh_toan t JOIN nhan_vien n ON n.id = t.nhan_vien_id JOIN ca_truc c ON c.id = t.ca_truc_id
       WHERE t.hoa_don_id = $1 ORDER BY t.thoi_diem`, [id]),
    hd.phieu_dieu_tri_id
      ? q(`SELECT c.id, coalesce(c.ngay_du_kien, p.ngay_kham + c.sau_so_ngay) AS ngay_du_kien, c.dich_vu_id,
                  dv.ten AS dich_vu, c.ghi_chu, p.bac_si_chinh_id
           FROM chi_dinh_tai_kham c JOIN phieu_dieu_tri p ON p.id = c.phieu_dieu_tri_id
           LEFT JOIN dich_vu dv ON dv.id = c.dich_vu_id
           WHERE c.phieu_dieu_tri_id = $1
             AND NOT EXISTS (SELECT 1 FROM lich_hen l WHERE l.chi_dinh_tai_kham_id = c.id
                               AND l.trang_thai NOT IN ('DA_HUY', 'KHONG_DEN'))`, [hd.phieu_dieu_tri_id])
      : Promise.resolve([]),
  ]);
  res.json({ ...hd, dong, thanh_toan, tai_kham });
});

// UC32: giảm giá theo dòng (giao diện đổi % → số tiền; DB luôn lưu số tiền — QĐ3)
r.patch('/hoa-don/:id/dong/:dongId', async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `UPDATE dong_hoa_don SET giam_gia_dong = $3, ly_do_giam_gia_dong = $4
     WHERE id = $2 AND hoa_don_id = $1 RETURNING id`,
    [Number(req.params.id), Number(req.params.dongId), Math.round(Number(b.giam_gia_dong) || 0),
     Number(b.giam_gia_dong) > 0 ? rong(b.ly_do_giam_gia_dong) : null]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy dòng hóa đơn');
  res.json(row);
});

// UC32: giảm giá tổng, ghi chú
r.patch('/hoa-don/:id', async (req, res) => {
  const b = req.body ?? {};
  const giam = Math.round(Number(b.giam_gia_tong) || 0);
  const row = await tx(req, (c) => c.q1(
    `UPDATE hoa_don SET giam_gia_tong = $2, ly_do_giam_gia = $3, ghi_chu = coalesce($4, ghi_chu)
     WHERE id = $1 RETURNING id, tong_tien`,
    [Number(req.params.id), giam, giam > 0 ? rong(b.ly_do_giam_gia) : null, b.ghi_chu ?? null]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy hóa đơn');
  res.json(row);
});

// Chốt: phân bổ giảm giá tổng xuống dòng, khóa giá
r.post('/hoa-don/:id/chot', async (req, res) => {
  const row = await tx(req, (c) => c.q1(`SELECT chot_hoa_don($1) AS tong_tien`, [Number(req.params.id)]));
  res.json(row);
});

// A23: hủy hóa đơn (chỉ khi chưa thu)
r.post('/hoa-don/:id/huy', async (req, res) => {
  const lyDo = rong(req.body?.ly_do);
  if (!lyDo) throw new LoiNghiepVu(400, 'Nhập lý do hủy hóa đơn');
  await tx(req, (c) => c.q(`SELECT huy_hoa_don($1, $2)`, [Number(req.params.id), lyDo]));
  res.json({ ok: true });
});

// UC34: thu tiền
r.post('/hoa-don/:id/thu-tien', async (req, res) => {
  const b = req.body ?? {};
  if (!b.ca_truc_id) throw new LoiNghiepVu(400, 'Chọn ca lễ tân để ghi phiếu thu');
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO thanh_toan (hoa_don_id, so_tien, hinh_thuc, ma_giao_dich_ngan_hang, ca_truc_id, ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, ma_phieu_thu`,
    [Number(req.params.id), Math.round(Number(b.so_tien)), b.hinh_thuc, rong(b.ma_giao_dich_ngan_hang),
     b.ca_truc_id, rong(b.ghi_chu)]));
  res.status(201).json(row);
});

// UC36: công nợ
r.get('/cong-no', async (_req, res) => {
  res.json(await q(`SELECT * FROM v_cong_no_benh_nhan`));
});

r.get('/cong-no/:benhNhanId', async (req, res) => {
  const id = Number(req.params.benhNhanId);
  const soTien = Number(req.query.so_tien) || 0;
  const [benh_nhan, hoa_don, goi_y] = await Promise.all([
    q1(`SELECT id, ma_benh_nhan, ho_ten, so_dien_thoai FROM benh_nhan WHERE id = $1`, [id]),
    q(`SELECT id, ma_hoa_don, loai, ngay_lap, tong_tien, da_thu, con_no FROM hoa_don
       WHERE benh_nhan_id = $1 AND trang_thai = 'DA_CHOT' AND con_no > 0 ORDER BY ngay_lap, id`, [id]),
    soTien > 0 ? q(`SELECT * FROM goi_y_phan_bo_thanh_toan($1, $2)`, [id, soTien]) : Promise.resolve([]),
  ]);
  res.json({ benh_nhan, hoa_don, goi_y });
});

// A22: khách trả gộp → chia vào các hóa đơn còn nợ, cũ trước
r.post('/cong-no/:benhNhanId/thu-gop', async (req, res) => {
  const b = req.body ?? {};
  const id = Number(req.params.benhNhanId);
  const soTien = Math.round(Number(b.so_tien));
  if (!(soTien > 0) || !b.ca_truc_id) throw new LoiNghiepVu(400, 'Nhập số tiền và chọn ca lễ tân');
  const phieu = await tx(req, async (c) => {
    const goiY = await c.q(`SELECT * FROM goi_y_phan_bo_thanh_toan($1, $2)`, [id, soTien]);
    const tongNo = (await c.q1(`SELECT coalesce(sum(con_no), 0) AS t FROM hoa_don
                                WHERE benh_nhan_id = $1 AND trang_thai = 'DA_CHOT'`, [id])).t;
    if (soTien > tongNo) throw new LoiNghiepVu(400, `Số tiền vượt tổng nợ (${tongNo.toLocaleString('vi-VN')} đ)`);
    const out = [];
    for (const g of goiY) {
      out.push(await c.q1(
        `INSERT INTO thanh_toan (hoa_don_id, so_tien, hinh_thuc, ma_giao_dich_ngan_hang, ca_truc_id, ghi_chu)
         VALUES ($1,$2,$3,$4,$5,'Thu gộp công nợ') RETURNING id, ma_phieu_thu, hoa_don_id, so_tien`,
        [g.hoa_don_id, g.so_tien_thu, b.hinh_thuc, rong(b.ma_giao_dich_ngan_hang), b.ca_truc_id]));
    }
    return out;
  });
  res.status(201).json({ phieu_thu: phieu });
});

// UC37: chốt két — xem trước số liệu ca
r.get('/chot-ket/:caId', async (req, res) => {
  const id = Number(req.params.caId);
  const [ca, thu, da_chot] = await Promise.all([
    q1(`SELECT c.*, n.ho_ten FROM ca_truc c JOIN nhan_vien n ON n.id = c.nhan_vien_id
        WHERE c.id = $1 AND c.vai_tro_ma = 'LE_TAN'`, [id]),
    q(`SELECT t.id, t.ma_phieu_thu, t.so_tien, t.hinh_thuc, t.ma_giao_dich_ngan_hang, t.thoi_diem,
              h.ma_hoa_don, bn.ho_ten AS benh_nhan, n.ho_ten AS nguoi_thu
       FROM thanh_toan t JOIN hoa_don h ON h.id = t.hoa_don_id JOIN benh_nhan bn ON bn.id = h.benh_nhan_id
       JOIN nhan_vien n ON n.id = t.nhan_vien_id
       WHERE t.ca_truc_id = $1 ORDER BY t.thoi_diem`, [id]),
    q1(`SELECT * FROM v_lich_su_chot_ket WHERE id = (SELECT id FROM chot_ket WHERE ca_truc_id = $1)`, [id]),
  ]);
  if (!ca) throw new LoiNghiepVu(404, 'Không tìm thấy ca lễ tân');
  res.json({ ca, thu, da_chot });
});

r.post('/chot-ket', async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO chot_ket (ca_truc_id, tien_dau_ca, tien_mat_dem_duoc, giai_trinh)
     VALUES ($1,$2,$3,$4) RETURNING id, chenh_lech`,
    [b.ca_truc_id, Math.round(Number(b.tien_dau_ca) || 0), Math.round(Number(b.tien_mat_dem_duoc)), rong(b.giai_trinh)]));
  res.status(201).json(row);
});

export default r;
