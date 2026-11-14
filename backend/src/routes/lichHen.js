// UC11–UC19: xem lịch, tìm khung trống, đặt / đổi / hủy lịch, nhắc lịch, SMS, check-in, không đến
import { Router } from 'express';
import { q, q1, tx, rong, laNgay, LoiNghiepVu } from '../db.js';
import { can } from '../auth.js';

const r = Router();
const LE_TAN = can('LE_TAN', 'QUAN_LY');

// UC11: lịch theo ngày (lưới ghế × khung) + ca trực + giờ mở cửa
r.get('/', async (req, res) => {
  const ngay = laNgay(req.query.ngay);
  const ngayThuc = (await q1(`SELECT coalesce($1::date, current_date)::text AS d`, [ngay])).d;
  const [lich, ca, gio] = await Promise.all([
    q(`SELECT v.*, l.den_luc, l.ben_huy, l.ly_do_huy_ghi_chu, ld.ten AS ly_do_huy, p.id AS phieu_id,
              (SELECT nl.ket_qua FROM nhac_lich nl WHERE nl.lich_hen_id = v.id ORDER BY nl.thoi_diem DESC LIMIT 1) AS ket_qua_nhac
       FROM v_lich_hen v JOIN lich_hen l ON l.id = v.id
       LEFT JOIN ly_do_huy ld ON ld.id = l.ly_do_huy_id
       LEFT JOIN phieu_dieu_tri p ON p.lich_hen_id = v.id
       WHERE v.ngay = $1 ORDER BY v.gio_bat_dau, v.ma_ghe`, [ngayThuc]),
    q(`SELECT c.id, c.nhan_vien_id, n.ho_ten, c.vai_tro_ma, c.gio_bat_dau, c.gio_ket_thuc, c.ten_ca
       FROM ca_truc c JOIN nhan_vien n ON n.id = c.nhan_vien_id
       WHERE c.ngay = $1 ORDER BY c.vai_tro_ma, c.gio_bat_dau`, [ngayThuc]),
    q1(`SELECT g.gio_mo, g.gio_dong, g.nghi, nn.ly_do AS ngay_nghi
        FROM gio_mo_cua g LEFT JOIN ngay_nghi nn ON nn.ngay = $1::date
        WHERE g.thu = extract(isodow FROM $1::date)`, [ngayThuc]),
  ]);
  res.json({ ngay: ngayThuc, lich, ca, gio_mo_cua: gio });
});

// UC12: khung trống (bac_si_id rỗng = bác sĩ nào cũng được, A08)
r.get('/khung-trong', async (req, res) => {
  const ngay = laNgay(req.query.ngay);
  if (!ngay) throw new LoiNghiepVu(400, 'Chọn ngày');
  res.json(await q(`SELECT * FROM tim_khung_trong($1, $2)`, [ngay, rong(req.query.bac_si_id) ?? null]));
});

// UC16: danh sách cần nhắc (mặc định ngày mai) + kết quả nhắc gần nhất
r.get('/nhac-lich', async (req, res) => {
  const ngay = laNgay(req.query.ngay);
  res.json(await q(
    `SELECT v.*, nl.hinh_thuc AS lan_nhac_cuoi_hinh_thuc, nl.ket_qua AS lan_nhac_cuoi_ket_qua,
            nl.thoi_diem AS lan_nhac_cuoi_luc, nv.ho_ten AS nguoi_nhac,
            (SELECT count(*) FROM nhac_lich x WHERE x.lich_hen_id = v.id) AS so_lan_nhac
     FROM v_lich_hen v
     LEFT JOIN LATERAL (SELECT * FROM nhac_lich WHERE lich_hen_id = v.id ORDER BY thoi_diem DESC LIMIT 1) nl ON true
     LEFT JOIN nhan_vien nv ON nv.id = nl.nhan_vien_id
     WHERE v.ngay = coalesce($1::date, current_date + 1) AND v.trang_thai IN ('DA_DAT', 'DA_NHAC')
     ORDER BY v.gio_bat_dau, v.ma_ghe`,
    [ngay],
  ));
});

r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const lich = await q1(
    `SELECT v.*, l.den_luc, l.ben_huy, l.ly_do_huy_ghi_chu, l.huy_luc, ld.ten AS ly_do_huy, nh.ho_ten AS nguoi_huy,
            nt.ho_ten AS nguoi_dat, l.tao_luc, l.chi_dinh_tai_kham_id, l.dich_vu_du_kien_id, l.bac_si_id
     FROM v_lich_hen v JOIN lich_hen l ON l.id = v.id
     LEFT JOIN ly_do_huy ld ON ld.id = l.ly_do_huy_id
     LEFT JOIN nhan_vien nh ON nh.id = l.huy_boi
     LEFT JOIN nhan_vien nt ON nt.id = l.tao_boi
     WHERE v.id = $1`, [id]);
  if (!lich) throw new LoiNghiepVu(404, 'Không tìm thấy lịch hẹn');
  const [lich_su, nhac] = await Promise.all([
    q(`SELECT s.hanh_dong, s.gia_tri_cu, s.gia_tri_moi, s.thoi_diem, n.ho_ten AS nguoi_thao_tac
       FROM lich_su_lich_hen s LEFT JOIN nhan_vien n ON n.id = s.nhan_vien_id
       WHERE s.lich_hen_id = $1 ORDER BY s.thoi_diem`, [id]),
    q(`SELECT x.hinh_thuc, x.ket_qua, x.noi_dung, x.ghi_chu, x.thoi_diem, n.ho_ten AS nguoi_nhac
       FROM nhac_lich x LEFT JOIN nhan_vien n ON n.id = x.nhan_vien_id
       WHERE x.lich_hen_id = $1 ORDER BY x.thoi_diem`, [id]),
  ]);
  res.json({ ...lich, lich_su, nhac });
});

// UC13: đặt lịch (vang_lai = khách tới quầy, check-in ngay — A05)
r.post('/', LE_TAN, async (req, res) => {
  const b = req.body ?? {};
  const vangLai = Boolean(b.vang_lai);
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO lich_hen (benh_nhan_id, bac_si_id, ghe_id, ngay, gio_bat_dau, dich_vu_du_kien_id, ghi_chu,
                           nguon, chi_dinh_tai_kham_id, trang_thai)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [b.benh_nhan_id, b.bac_si_id, b.ghe_id, b.ngay, b.gio_bat_dau, b.dich_vu_du_kien_id, rong(b.ghi_chu),
     vangLai ? 'VANG_LAI' : (b.chi_dinh_tai_kham_id ? 'TAI_KHAM' : (b.nguon || 'DIEN_THOAI')),
     rong(b.chi_dinh_tai_kham_id), vangLai ? 'DA_DEN' : 'DA_DAT'],
  ));
  res.status(201).json(row);
});

// UC14: đổi lịch
r.post('/:id/doi-lich', LE_TAN, async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `UPDATE lich_hen SET bac_si_id = $2, ghe_id = $3, ngay = $4, gio_bat_dau = $5,
            dich_vu_du_kien_id = coalesce($6, dich_vu_du_kien_id), ghi_chu = coalesce($7, ghi_chu)
     WHERE id = $1 RETURNING id`,
    [Number(req.params.id), b.bac_si_id, b.ghe_id, b.ngay, b.gio_bat_dau, rong(b.dich_vu_du_kien_id), rong(b.ghi_chu)],
  ));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy lịch hẹn');
  res.json(row);
});

// UC15: hủy lịch (lý do, bên hủy; người thao tác & thời điểm do DB ghi)
r.post('/:id/huy', LE_TAN, async (req, res) => {
  const b = req.body ?? {};
  if (!b.ly_do_huy_id || !b.ben_huy) throw new LoiNghiepVu(400, 'Chọn lý do hủy và bên hủy');
  const row = await tx(req, (c) => c.q1(
    `UPDATE lich_hen SET trang_thai = 'DA_HUY', ly_do_huy_id = $2, ben_huy = $3, ly_do_huy_ghi_chu = $4
     WHERE id = $1 RETURNING id`,
    [Number(req.params.id), b.ly_do_huy_id, b.ben_huy, rong(b.ly_do_huy_ghi_chu)],
  ));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy lịch hẹn');
  res.json(row);
});

// UC18: tiếp đón (check-in)
r.post('/:id/check-in', LE_TAN, async (req, res) => {
  const row = await tx(req, (c) => c.q1(
    `UPDATE lich_hen SET trang_thai = 'DA_DEN' WHERE id = $1 RETURNING id`, [Number(req.params.id)]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy lịch hẹn');
  res.json(row);
});

// UC19: ghi nhận không đến
r.post('/:id/khong-den', LE_TAN, async (req, res) => {
  const row = await tx(req, (c) => c.q1(
    `UPDATE lich_hen SET trang_thai = 'KHONG_DEN' WHERE id = $1 RETURNING id`, [Number(req.params.id)]));
  if (!row) throw new LoiNghiepVu(404, 'Không tìm thấy lịch hẹn');
  res.json(row);
});

// UC16 ghi kết quả gọi điện / UC17 gửi SMS nhắc lịch
r.post('/:id/nhac-lich', LE_TAN, async (req, res) => {
  const b = req.body ?? {};
  const id = Number(req.params.id);
  const lh = await q1(`SELECT * FROM v_lich_hen WHERE id = $1`, [id]);
  if (!lh) throw new LoiNghiepVu(404, 'Không tìm thấy lịch hẹn');

  let { hinh_thuc, ket_qua } = b;
  let noiDung = null;
  if (hinh_thuc === 'SMS') {
    // QĐ2: tin nhắn ghi tên người được hẹn vì nhiều người có thể dùng chung số
    const [y, m, d] = lh.ngay.split('-');
    noiDung = `Nha khoa Nu Cuoi Viet nhac lich hen cho ${lh.benh_nhan} luc ${lh.gio_bat_dau.slice(0, 5)} ngay ${d}/${m}/${y} `
      + `voi BS ${lh.bac_si}. Can doi lich vui long goi lai phong kham.`;
    // Chưa tích hợp cổng SMS thật (dịch vụ ngoài): ghi nhận là đã gửi
    ket_qua = 'SMS_DA_GUI';
  } else {
    hinh_thuc = 'GOI_DIEN';
    if (!['XAC_NHAN', 'KHONG_NGHE_MAY', 'XIN_DOI_LICH', 'XIN_HUY', 'SAI_SO'].includes(ket_qua)) {
      throw new LoiNghiepVu(400, 'Chọn kết quả cuộc gọi');
    }
  }
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO nhac_lich (lich_hen_id, hinh_thuc, ket_qua, so_dien_thoai, noi_dung, ghi_chu)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, ket_qua, noi_dung`,
    [id, hinh_thuc, ket_qua, lh.so_dien_thoai, noiDung, rong(b.ghi_chu)],
  ));
  res.status(201).json(row);
});

export default r;
