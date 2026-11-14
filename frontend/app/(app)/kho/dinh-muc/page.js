'use client';
// Định mức vật tư theo dịch vụ (UC39, A19) — dùng để gợi ý vật tư khi hoàn tất phiếu
import { useState } from 'react';
import { api, useData } from '@/lib/api';
import { PageHeader, Card, Loading, ErrorBox, Empty, chay } from '@/components/ui';

export default function DinhMuc() {
  const { data, error, reload } = useData('/kho/dinh-muc');
  const { data: dm } = useData('/danh-muc');
  const [chon, setChon] = useState(null);
  const [items, setItems] = useState([]);

  function moDv(d) { setChon(d); setItems(d.vat_tu.map((v) => ({ thuoc_vat_tu_id: v.thuoc_vat_tu_id, so_luong: v.so_luong }))); }
  async function luu() {
    if (await chay(() => api(`/kho/dinh-muc/${chon.id}`, { method: 'PUT', body: { items } }), 'Đã lưu định mức')) reload();
  }

  return (
    <>
      <PageHeader title="Định mức vật tư" sub="Số vật tư dùng cho một lần làm dịch vụ; bác sĩ xác nhận hoặc sửa khi hoàn tất phiếu" />
      <ErrorBox error={error} onRetry={reload} />
      <div className="grid-2">
        <Card title="Dịch vụ">
          {!data ? <Loading /> : (
            <table className="table"><tbody>{data.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => moDv(d)} style={chon?.id === d.id ? { background: 'var(--primary-soft)' } : undefined}>
                <td><b>{d.ten}</b> <span className="muted small">{d.ma_dich_vu}</span></td>
                <td className="muted small">{d.vat_tu.length ? d.vat_tu.map((v) => `${v.ten} ×${v.so_luong}`).join(', ') : 'Chưa có định mức'}</td>
              </tr>))}</tbody></table>
          )}
        </Card>
        {!chon ? <Card><Empty text="Chọn dịch vụ để sửa định mức" /></Card> : (
          <Card title={`Định mức: ${chon.ten}`} actions={<button className="btn btn-primary" onClick={luu}>Lưu</button>}>
            <table className="table"><thead><tr><th>Vật tư</th><th>Số lượng / lần</th><th /></tr></thead>
              <tbody>{items.map((it, i) => (
                <tr key={i}>
                  <td><select value={it.thuoc_vat_tu_id} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, thuoc_vat_tu_id: Number(e.target.value) } : x)))}>
                    <option value="">— Chọn —</option>
                    {dm?.mat_hang.map((m) => <option key={m.id} value={m.id}>{m.ten} ({m.don_vi_tinh})</option>)}
                  </select></td>
                  <td><input className="inline-input" type="number" step="0.5" min="0.5" value={it.so_luong} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, so_luong: e.target.value } : x)))} /></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button></td>
                </tr>))}</tbody></table>
            <button className="btn btn-sm mt" onClick={() => setItems([...items, { thuoc_vat_tu_id: '', so_luong: 1 }])}>+ Thêm vật tư</button>
          </Card>
        )}
      </div>
    </>
  );
}
