'use client';
// UC10 — Xem lịch trực theo tuần; UC09 — Xếp ca trực (quản lý)
import { Fragment, useMemo, useState } from 'react';
import { api, useData } from '@/lib/api';
import { gio, homNay, congNgay, dauTuan, ngay } from '@/lib/format';
import { VAI_TRO } from '@/lib/nhan';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import { PageHeader, Loading, ErrorBox, Modal, Field, chay } from '@/components/ui';

const THU = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MAU_CA = {
  BAC_SI: [['Ngày', '08:00', '17:00'], ['Muộn', '11:00', '20:00'], ['Chiều', '14:00', '20:00']],
  LE_TAN: [['Sáng', '08:00', '14:00'], ['Chiều', '14:00', '20:00']],
};

export default function CaTruc() {
  const user = useNguoiDung();
  const ql = coVaiTro(user, 'QUAN_LY');
  const [tuan, setTuan] = useState(dauTuan(homNay()));
  const ngays = useMemo(() => Array.from({ length: 7 }, (_, i) => congNgay(tuan, i)), [tuan]);
  const { data, error, reload } = useData(`/ca-truc?tu=${ngays[0]}&den=${ngays[6]}`);
  const { data: dm } = useData('/danh-muc');
  const [them, setThem] = useState(null);

  // Hàng = nhân viên (bác sĩ trước, lễ tân sau)
  const nhanVien = useMemo(() => {
    const bs = (dm?.bac_si ?? []).map((n) => ({ ...n, vai_tro: 'BAC_SI' }));
    const lt = (dm?.le_tan ?? []).map((n) => ({ ...n, vai_tro: 'LE_TAN' }));
    return [...bs, ...lt];
  }, [dm]);

  async function xoa(id) {
    if (!confirm('Xóa ca trực này?')) return;
    if (await chay(() => api(`/ca-truc/${id}`, { method: 'DELETE' }), 'Đã xóa ca')) reload();
  }

  async function luu() {
    const r = await chay(() => api('/ca-truc', { method: 'POST', body: them }), 'Đã thêm ca trực');
    if (r) { setThem(null); reload(); }
  }

  function moThem(nv, ngayMacDinh) {
    const [ten, bd, kt] = MAU_CA[nv.vai_tro][0];
    setThem({ nhan_vien_id: nv.id, vai_tro_ma: nv.vai_tro, ho_ten: nv.ho_ten, ngays: ngayMacDinh ? [ngayMacDinh] : [], ten_ca: ten, gio_bat_dau: bd, gio_ket_thuc: kt, ghi_chu: '' });
  }

  return (
    <>
      <PageHeader title="Ca trực" sub={`Tuần ${ngay(ngays[0])} – ${ngay(ngays[6])}`}>
        <button className="btn" onClick={() => setTuan(congNgay(tuan, -7))}>‹ Tuần trước</button>
        <button className="btn" onClick={() => setTuan(dauTuan(homNay()))}>Tuần này</button>
        <button className="btn" onClick={() => setTuan(congNgay(tuan, 7))}>Tuần sau ›</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {!data || !dm ? <Loading /> : (
        <div className="tuan">
          <div className="th">Nhân viên</div>
          {ngays.map((d, i) => <div key={d} className={`th ${d === homNay() ? 'hom-nay' : ''}`}>{THU[i]}<div className="small muted">{ngay(d).slice(0, 5)}</div></div>)}
          {nhanVien.map((nv) => (
            <Fragment key={`${nv.vai_tro}-${nv.id}`}>
              <div><div className="ten-nv">{nv.ho_ten}</div><div className="small muted">{VAI_TRO[nv.vai_tro]}{nv.ban_thoi_gian ? ' · bán thời gian' : ''}</div></div>
              {ngays.map((d) => {
                const ca = data.filter((c) => c.nhan_vien_id === nv.id && c.vai_tro_ma === nv.vai_tro && c.ngay === d);
                return (
                  <div key={d} onDoubleClick={ql ? () => moThem(nv, d) : undefined} title={ql ? 'Nhấp đúp để thêm ca' : undefined}>
                    {ca.map((c) => (
                      <div key={c.id} className={`ca-chip ${c.vai_tro_ma === 'LE_TAN' ? 'le-tan' : ''}`} title={c.ghi_chu ?? ''}>
                        <span>{gio(c.gio_bat_dau)}–{gio(c.gio_ket_thuc)}{c.da_chot_ket ? ' ✓' : ''}</span>
                        {ql && <button onClick={() => xoa(c.id)} aria-label="Xóa ca">×</button>}
                      </div>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
      {ql && dm && (
        <div className="gap mt">
          <span className="muted">Thêm ca cho:</span>
          {nhanVien.map((nv) => <button key={`${nv.vai_tro}-${nv.id}`} className="btn btn-sm" onClick={() => moThem(nv)}>{nv.ho_ten}</button>)}
          <span className="muted small">(hoặc nhấp đúp vào ô ngày)</span>
        </div>
      )}

      {them && (
        <Modal title={`Thêm ca — ${them.ho_ten} (${VAI_TRO[them.vai_tro_ma]})`} onClose={() => setThem(null)}
          footer={<><button className="btn" onClick={() => setThem(null)}>Hủy</button>
            <button className="btn btn-primary" disabled={!them.ngays.length} onClick={luu}>Thêm {them.ngays.length} ca</button></>}>
          <Field label="Mẫu ca">
            <div className="gap">{MAU_CA[them.vai_tro_ma].map(([ten, bd, kt]) => (
              <button key={ten} className="btn btn-sm" onClick={() => setThem({ ...them, ten_ca: ten, gio_bat_dau: bd, gio_ket_thuc: kt })}>{ten} {bd}–{kt}</button>
            ))}</div>
          </Field>
          <div className="form-grid mt">
            <Field label="Tên ca"><input value={them.ten_ca} onChange={(e) => setThem({ ...them, ten_ca: e.target.value })} /></Field>
            <Field label="Bắt đầu"><input type="time" step={1800} value={them.gio_bat_dau} onChange={(e) => setThem({ ...them, gio_bat_dau: e.target.value })} /></Field>
            <Field label="Kết thúc"><input type="time" step={1800} value={them.gio_ket_thuc} onChange={(e) => setThem({ ...them, gio_ket_thuc: e.target.value })} /></Field>
          </div>
          <Field label="Các ngày trong tuần">
            <div className="gap">{ngays.map((d, i) => (
              <label key={d} className="check">
                <input type="checkbox" checked={them.ngays.includes(d)}
                  onChange={(e) => setThem({ ...them, ngays: e.target.checked ? [...them.ngays, d] : them.ngays.filter((x) => x !== d) })} />
                {THU[i]} {ngay(d).slice(0, 5)}
              </label>
            ))}</div>
          </Field>
          <Field label="Ghi chú"><input value={them.ghi_chu} onChange={(e) => setThem({ ...them, ghi_chu: e.target.value })} /></Field>
          {them.vai_tro_ma === 'BAC_SI' && <p className="muted small">Lịch hẹn chỉ đặt được trong ca trực của bác sĩ.</p>}
        </Modal>
      )}
    </>
  );
}
