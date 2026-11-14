'use client';
// UC24 — Tạo liệu trình: số buổi, giá trọn gói chốt lúc tạo, kế hoạch các đợt thanh toán (A20)
import { useState } from 'react';
import { api, useData } from '@/lib/api';
import { tien, homNay, congNgay } from '@/lib/format';
import { Modal, Field, MoneyInput, chay } from './ui';

export default function LieuTrinhModal({ benhNhanId, bacSiId, onClose, onDone }) {
  const { data: dm } = useData('/danh-muc');
  const goi = dm?.dich_vu.filter((d) => d.la_lieu_trinh) ?? [];
  const [f, setF] = useState({ dich_vu_id: '', ten: '', so_buoi_du_kien: 12, gia_tron_goi: '', bac_si_phu_trach_id: bacSiId ?? '', ghi_chu: '' });
  const [dots, setDots] = useState([{ so_tien: '', ngay_du_kien: homNay(), ghi_chu: 'Thanh toán khi bắt đầu' }]);

  const tongDot = dots.reduce((s, d) => s + (Number(d.so_tien) || 0), 0);
  const lech = (Number(f.gia_tron_goi) || 0) - tongDot;

  function chonGoi(id) {
    const g = goi.find((x) => String(x.id) === id);
    setF({ ...f, dich_vu_id: id, ten: g?.ten ?? f.ten, gia_tron_goi: g?.don_gia ?? f.gia_tron_goi });
    if (g?.don_gia && dots.length === 1) setDots([{ ...dots[0], so_tien: g.don_gia }]);
  }

  function chiaDeu(n) {
    const gia = Number(f.gia_tron_goi) || 0;
    const moiDot = Math.floor(gia / n / 1000) * 1000;
    setDots(Array.from({ length: n }, (_, i) => ({
      so_tien: i === n - 1 ? gia - moiDot * (n - 1) : moiDot,
      ngay_du_kien: congNgay(homNay(), i * 90),
      ghi_chu: i === 0 ? 'Thanh toán khi bắt đầu' : `Sau ${i * 3} tháng điều trị`,
    })));
  }

  async function luu() {
    const r = await chay(() => api('/kham/lieu-trinh', {
      method: 'POST', body: { ...f, benh_nhan_id: benhNhanId, dots },
    }), 'Đã tạo liệu trình');
    if (r) onDone?.(r);
  }

  return (
    <Modal title="Tạo liệu trình" onClose={onClose} wide
      footer={<><button className="btn" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" disabled={lech !== 0 || !f.ten || !f.gia_tron_goi} onClick={luu}>Tạo liệu trình</button></>}>
      <div className="form-grid">
        <Field label="Loại liệu trình">
          <select value={f.dich_vu_id} onChange={(e) => chonGoi(e.target.value)}>
            <option value="">— Chọn gói —</option>
            {goi.map((g) => <option key={g.id} value={g.id}>{g.ten} ({tien(g.don_gia)})</option>)}
          </select>
        </Field>
        <Field label="Tên liệu trình" required><input value={f.ten} onChange={(e) => setF({ ...f, ten: e.target.value })} /></Field>
        <Field label="Bác sĩ phụ trách" hint="Nhận doanh thu các đợt (A28)">
          <select value={f.bac_si_phu_trach_id} onChange={(e) => setF({ ...f, bac_si_phu_trach_id: e.target.value })}>
            {dm?.bac_si.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}</option>)}
          </select>
        </Field>
        <Field label="Số buổi dự kiến" required>
          <input type="number" min={1} value={f.so_buoi_du_kien} onChange={(e) => setF({ ...f, so_buoi_du_kien: e.target.value })} />
        </Field>
        <Field label="Giá trọn gói (chốt lúc tạo)" required>
          <MoneyInput value={f.gia_tron_goi} onChange={(v) => setF({ ...f, gia_tron_goi: v })} />
        </Field>
        <Field label="Ghi chú" wide><textarea rows={2} value={f.ghi_chu} onChange={(e) => setF({ ...f, ghi_chu: e.target.value })} /></Field>
      </div>

      <div className="card-head mt"><h3 style={{ margin: 0 }}>Kế hoạch các đợt thanh toán</h3>
        <div className="actions">
          <span className="muted small">Chia đều:</span>
          {[1, 2, 3, 4].map((n) => <button key={n} className="btn btn-sm" onClick={() => chiaDeu(n)}>{n} đợt</button>)}
        </div>
      </div>
      <table className="table">
        <thead><tr><th>Đợt</th><th>Số tiền</th><th>Ngày dự kiến</th><th>Ghi chú</th><th></th></tr></thead>
        <tbody>
          {dots.map((d, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td><MoneyInput value={d.so_tien} onChange={(v) => setDots(dots.map((x, j) => (j === i ? { ...x, so_tien: v } : x)))} /></td>
              <td><input type="date" value={d.ngay_du_kien} onChange={(e) => setDots(dots.map((x, j) => (j === i ? { ...x, ngay_du_kien: e.target.value } : x)))} /></td>
              <td><input value={d.ghi_chu} onChange={(e) => setDots(dots.map((x, j) => (j === i ? { ...x, ghi_chu: e.target.value } : x)))} /></td>
              <td>{dots.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => setDots(dots.filter((_, j) => j !== i))}>×</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="gap mt">
        <button className="btn btn-sm" onClick={() => setDots([...dots, { so_tien: lech > 0 ? lech : '', ngay_du_kien: '', ghi_chu: '' }])}>+ Thêm đợt</button>
        <span className="spacer" />
        <span>Tổng các đợt: <b>{tien(tongDot)}</b></span>
        {lech !== 0 && <span className="text-do bold">Lệch {tien(lech)} so với giá trọn gói</span>}
      </div>
    </Modal>
  );
}
