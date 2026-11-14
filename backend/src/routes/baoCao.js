// UC44 chia tiền bác sĩ, UC45.1–UC45.8 tám câu hỏi quản lý, UC46 lịch sử chốt két
import { Router } from 'express';
import { q, laNgay, laThang } from '../db.js';
import { can } from '../auth.js';

const r = Router();
r.use(can('QUAN_LY'));

const thangHienTai = () => {
  const d = new Date(Date.now() + 7 * 3600 * 1000); // giờ Việt Nam
  return `${d.toISOString().slice(0, 7)}-01`;
};

// Câu 1 + Câu 8 + UC44: doanh thu bác sĩ, so với tháng trước, tiền được chia; xu hướng 12 tháng
r.get('/doanh-thu', async (req, res) => {
  const thang = laThang(req.query.thang) ?? thangHienTai();
  const [theo_bac_si, so_sanh, chia_tien, xu_huong] = await Promise.all([
    q(`SELECT * FROM v_doanh_thu_bac_si_thang WHERE thang = $1::date ORDER BY doanh_thu DESC`, [thang]),
    q(`SELECT * FROM so_sanh_doanh_thu_bac_si($1::date)`, [thang]),
    q(`SELECT * FROM chia_tien_bac_si($1::date)`, [thang]),
    q(`SELECT * FROM v_so_sanh_doanh_thu_thang WHERE thang <= $1::date ORDER BY thang DESC LIMIT 12`, [thang]),
  ]);
  res.json({ thang, theo_bac_si, so_sanh, chia_tien, xu_huong });
});

// Câu 2: công suất ghế theo khung giờ
r.get('/cong-suat-ghe', async (req, res) => {
  const tu = laNgay(req.query.tu);
  const den = laNgay(req.query.den);
  res.json(await q(
    `SELECT * FROM cong_suat_ghe(coalesce($1::date, date_trunc('month', current_date)::date), coalesce($2::date, current_date))`,
    [tu, den]));
});

// Câu 3: quá 6 tháng chưa quay lại
r.get('/qua-6-thang', async (_req, res) => res.json(await q(`SELECT * FROM v_benh_nhan_qua_6_thang`)));

// Câu 4: hủy lịch theo dịch vụ & lý do
r.get('/huy-lich', async (req, res) => {
  const tu = laThang(req.query.tu) ?? '2000-01-01';
  const den = laThang(req.query.den) ?? '2999-12-01';
  res.json(await q(
    `SELECT * FROM v_thong_ke_huy_lich WHERE thang BETWEEN $1::date AND $2::date ORDER BY so_lan_huy DESC, thang DESC`,
    [tu, den]));
});

// Câu 5: công nợ theo bệnh nhân
r.get('/cong-no', async (_req, res) => res.json(await q(`SELECT * FROM v_cong_no_benh_nhan`)));

// Câu 6: liệu trình đang dở
r.get('/lieu-trinh', async (_req, res) => res.json(await q(`SELECT * FROM v_lieu_trinh_dang_do ORDER BY so_buoi_con_lai DESC`)));

// Câu 7: thuốc & vật tư sắp hết
r.get('/ton-kho', async (_req, res) => res.json(await q(`SELECT * FROM v_canh_bao_ton_kho`)));

// UC46: lịch sử chốt két
r.get('/chot-ket', async (_req, res) => res.json(await q(`SELECT * FROM v_lich_su_chot_ket ORDER BY chot_luc DESC LIMIT 200`)));

export default r;
