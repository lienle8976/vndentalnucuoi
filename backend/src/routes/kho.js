// UC30, UC38 bảng giá; UC39–UC42 thuốc, vật tư, định mức, nhập kho, kiểm kê, cảnh báo
import { Router } from 'express';
import { q, q1, tx, rong, cauUpdate, LoiNghiepVu } from '../db.js';
import { can } from '../auth.js';

const r = Router();
const QL = can('QUAN_LY');

// UC30: tra cứu bảng giá (mọi nhân viên) — giá hiện hành + lịch sử giá
r.get('/bang-gia', async (_req, res) => {
  res.json(await q(
    `SELECT dv.*, gia_dich_vu(dv.id) AS don_gia,
            coalesce((SELECT json_agg(json_build_object('id', g.id, 'don_gia', g.don_gia, 'hieu_luc_tu', g.hieu_luc_tu,
                                                        'ghi_chu', g.ghi_chu) ORDER BY g.hieu_luc_tu DESC)
                      FROM bang_gia_dich_vu g WHERE g.dich_vu_id = dv.id), '[]') AS lich_su_gia
     FROM dich_vu dv ORDER BY dv.dang_hoat_dong DESC, dv.nhom, dv.ten`));
});

const COT_DICH_VU = ['ma_dich_vu', 'ten', 'nhom', 'don_vi_tinh', 'la_lieu_trinh', 'mo_ta', 'dang_hoat_dong'];

r.post('/dich-vu', QL, async (req, res) => {
  const b = req.body ?? {};
  if (!b.ma_dich_vu || !b.ten) throw new LoiNghiepVu(400, 'Nhập mã và tên dịch vụ');
  const row = await tx(req, async (c) => {
    const dv = await c.q1(
      `INSERT INTO dich_vu (ma_dich_vu, ten, nhom, don_vi_tinh, la_lieu_trinh, mo_ta)
       VALUES ($1,$2,$3,coalesce($4,'Lần'),coalesce($5,false),$6) RETURNING id`,
      [b.ma_dich_vu, b.ten, rong(b.nhom), rong(b.don_vi_tinh), b.la_lieu_trinh ?? false, rong(b.mo_ta)]);
    if (Number(b.don_gia) >= 0 && b.don_gia !== '' && b.don_gia !== undefined) {
      await c.q(`INSERT INTO bang_gia_dich_vu (dich_vu_id, don_gia, hieu_luc_tu, ghi_chu) VALUES ($1,$2,coalesce($3,current_date),$4)`,
        [dv.id, b.don_gia, rong(b.hieu_luc_tu), 'Giá khởi tạo']);
    }
    return dv;
  });
  res.status(201).json(row);
});

r.put('/dich-vu/:id', QL, async (req, res) => {
  const cu = cauUpdate('dich_vu', COT_DICH_VU, req.body ?? {}, Number(req.params.id));
  if (!cu) throw new LoiNghiepVu(400, 'Không có thông tin cần cập nhật');
  res.json(await tx(req, (c) => c.q1(cu.sql, cu.params)));
});

// UC38: thêm giá mới kèm ngày hiệu lực (không ghi đè — A21)
r.post('/bang-gia', QL, async (req, res) => {
  const b = req.body ?? {};
  if (!b.dich_vu_id || b.don_gia === undefined || !b.hieu_luc_tu) throw new LoiNghiepVu(400, 'Nhập đơn giá và ngày hiệu lực');
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO bang_gia_dich_vu (dich_vu_id, don_gia, hieu_luc_tu, ghi_chu) VALUES ($1,$2,$3,$4) RETURNING id`,
    [b.dich_vu_id, b.don_gia, b.hieu_luc_tu, rong(b.ghi_chu)]));
  res.status(201).json(row);
});

// UC39: danh mục thuốc & vật tư (tồn kho, ngưỡng, giá thuốc, cảnh báo)
r.get('/mat-hang', QL, async (_req, res) => {
  res.json(await q(
    `SELECT m.*, CASE WHEN m.loai = 'THUOC' THEN gia_thuoc(m.id) END AS don_gia,
            (m.ton_kho <= m.nguong_toi_thieu) AS duoi_nguong,
            (SELECT max(g.han_dung) FILTER (WHERE g.loai = 'NHAP') FROM giao_dich_kho g WHERE g.thuoc_vat_tu_id = m.id) AS han_dung_lo_moi,
            coalesce((SELECT json_agg(json_build_object('don_gia', b.don_gia, 'hieu_luc_tu', b.hieu_luc_tu) ORDER BY b.hieu_luc_tu DESC)
                      FROM bang_gia_thuoc b WHERE b.thuoc_id = m.id), '[]') AS lich_su_gia
     FROM thuoc_vat_tu m ORDER BY m.dang_hoat_dong DESC, m.loai, m.ten`));
});

const COT_MAT_HANG = ['ma', 'ten', 'loai', 'don_vi_tinh', 'hoat_chat', 'ham_luong', 'nguong_toi_thieu', 'dang_hoat_dong'];

r.post('/mat-hang', QL, async (req, res) => {
  const b = req.body ?? {};
  if (!b.ma || !b.ten || !b.loai || !b.don_vi_tinh) throw new LoiNghiepVu(400, 'Nhập mã, tên, loại và đơn vị tính');
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO thuoc_vat_tu (ma, ten, loai, don_vi_tinh, hoat_chat, ham_luong, nguong_toi_thieu)
     VALUES ($1,$2,$3,$4,$5,$6,coalesce($7,0)) RETURNING id`,
    [b.ma, b.ten, b.loai, b.don_vi_tinh, rong(b.hoat_chat), rong(b.ham_luong), rong(b.nguong_toi_thieu)]));
  res.status(201).json(row);
});

r.put('/mat-hang/:id', QL, async (req, res) => {
  const cu = cauUpdate('thuoc_vat_tu', COT_MAT_HANG, req.body ?? {}, Number(req.params.id));
  if (!cu) throw new LoiNghiepVu(400, 'Không có thông tin cần cập nhật');
  res.json(await tx(req, (c) => c.q1(cu.sql, cu.params)));
});

r.post('/gia-thuoc', QL, async (req, res) => {
  const b = req.body ?? {};
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO bang_gia_thuoc (thuoc_id, don_gia, hieu_luc_tu, ghi_chu) VALUES ($1,$2,$3,$4) RETURNING id`,
    [b.thuoc_id, b.don_gia, b.hieu_luc_tu, rong(b.ghi_chu)]));
  res.status(201).json(row);
});

// UC40: nhập kho
r.post('/nhap', QL, async (req, res) => {
  const b = req.body ?? {};
  if (!b.thuoc_vat_tu_id || !(Number(b.so_luong) > 0)) throw new LoiNghiepVu(400, 'Chọn mặt hàng và số lượng > 0');
  const row = await tx(req, (c) => c.q1(
    `INSERT INTO giao_dich_kho (thuoc_vat_tu_id, loai, so_luong, don_gia_nhap, nha_cung_cap, so_lo, han_dung, ly_do)
     VALUES ($1,'NHAP',$2,$3,$4,$5,$6,$7) RETURNING id, ton_sau`,
    [b.thuoc_vat_tu_id, b.so_luong, rong(b.don_gia_nhap), rong(b.nha_cung_cap), rong(b.so_lo), rong(b.han_dung),
     rong(b.ly_do) ?? 'Nhập hàng']));
  res.status(201).json(row);
});

// UC41: kiểm kê — nhập số đếm thực tế, hệ thống ghi phần chênh
r.post('/kiem-ke', QL, async (req, res) => {
  const b = req.body ?? {};
  const items = (Array.isArray(b.items) ? b.items : []).filter((i) => i.ton_thuc_te !== '' && i.ton_thuc_te !== null && i.ton_thuc_te !== undefined);
  if (!items.length) throw new LoiNghiepVu(400, 'Nhập số lượng đếm thực tế cho ít nhất một mặt hàng');
  const ket_qua = await tx(req, async (c) => {
    const out = [];
    for (const i of items) {
      const row = await c.q1(`SELECT kiem_ke($1, $2, $3) AS chenh_lech`, [i.thuoc_vat_tu_id, i.ton_thuc_te, rong(b.ly_do) ?? 'Kiểm kê']);
      out.push({ thuoc_vat_tu_id: i.thuoc_vat_tu_id, chenh_lech: row.chenh_lech });
    }
    return out;
  });
  res.json({ ket_qua });
});

r.get('/mat-hang/:id/giao-dich', QL, async (req, res) => {
  res.json(await q(
    `SELECT g.*, n.ho_ten AS nguoi_thao_tac, p.ma_phieu
     FROM giao_dich_kho g LEFT JOIN nhan_vien n ON n.id = g.nhan_vien_id
     LEFT JOIN phieu_dieu_tri p ON p.id = g.phieu_dieu_tri_id
     WHERE g.thuoc_vat_tu_id = $1 ORDER BY g.thoi_diem DESC, g.id DESC LIMIT 200`, [Number(req.params.id)]));
});

// Định mức vật tư theo dịch vụ (UC39, A19)
r.get('/dinh-muc', QL, async (_req, res) => {
  res.json(await q(
    `SELECT dv.id, dv.ma_dich_vu, dv.ten,
            coalesce((SELECT json_agg(json_build_object('thuoc_vat_tu_id', m.id, 'ten', m.ten, 'don_vi_tinh', m.don_vi_tinh,
                                                        'so_luong', d.so_luong) ORDER BY m.ten)
                      FROM dinh_muc_vat_tu d JOIN thuoc_vat_tu m ON m.id = d.thuoc_vat_tu_id
                      WHERE d.dich_vu_id = dv.id), '[]') AS vat_tu
     FROM dich_vu dv WHERE dv.dang_hoat_dong ORDER BY dv.nhom, dv.ten`));
});

r.put('/dinh-muc/:dichVuId', QL, async (req, res) => {
  const id = Number(req.params.dichVuId);
  const items = Array.isArray(req.body?.items) ? req.body.items.filter((i) => i.thuoc_vat_tu_id && Number(i.so_luong) > 0) : [];
  await tx(req, async (c) => {
    await c.q(`DELETE FROM dinh_muc_vat_tu WHERE dich_vu_id = $1`, [id]);
    for (const i of items) {
      await c.q(`INSERT INTO dinh_muc_vat_tu (dich_vu_id, thuoc_vat_tu_id, so_luong) VALUES ($1,$2,$3)`, [id, i.thuoc_vat_tu_id, i.so_luong]);
    }
  });
  res.json({ ok: true, so_dong: items.length });
});

export default r;
