'use client';
// UC43 — Danh mục chung: ghế, lý do hủy, giờ mở cửa, ngày nghỉ, tỷ lệ ăn chia
import { useState } from 'react';
import { api, useData } from '@/lib/api';
import { ngay, gio, homNay } from '@/lib/format';
import { THU_TRONG_TUAN } from '@/lib/nhan';
import { PageHeader, Card, Loading, ErrorBox, Badge, chay } from '@/components/ui';

export default function DanhMucChung() {
  const { data, error, reload } = useData('/quan-tri/danh-muc');
  const { data: dm } = useData('/danh-muc');
  const [ghe, setGhe] = useState({ ma_ghe: '', ten: '' });
  const [lyDo, setLyDo] = useState('');
  const [nghi, setNghi] = useState({ ngay: '', ly_do: '' });
  const [tyLe, setTyLe] = useState({ bac_si_id: '', ty_le: '', hieu_luc_tu: homNay(), ghi_chu: '' });
  const tai = (fn, msg) => chay(fn, msg).then((r) => { if (r) reload(); return r; });

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <>
      <PageHeader title="Danh mục chung" />
      <div className="grid-2">
        <Card title="Ghế nha">
          <table className="table"><tbody>{data.ghe.map((g) => (
            <tr key={g.id} className={g.dang_hoat_dong ? '' : 'row-muted'}><td><b>{g.ma_ghe}</b></td><td>{g.ten}</td>
              <td className="right"><button className="btn btn-sm" onClick={() => tai(() => api(`/quan-tri/ghe/${g.id}`, { method: 'PUT', body: { dang_hoat_dong: !g.dang_hoat_dong } }), 'Đã cập nhật')}>{g.dang_hoat_dong ? 'Ngừng dùng' : 'Dùng lại'}</button></td></tr>))}</tbody></table>
          <div className="gap mt">
            <input placeholder="Mã (G4)" value={ghe.ma_ghe} onChange={(e) => setGhe({ ...ghe, ma_ghe: e.target.value })} style={{ width: 90 }} />
            <input placeholder="Tên / mô tả" value={ghe.ten} onChange={(e) => setGhe({ ...ghe, ten: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn-sm" disabled={!ghe.ma_ghe || !ghe.ten} onClick={async () => { if (await tai(() => api('/quan-tri/ghe', { method: 'POST', body: ghe }), 'Đã thêm ghế')) setGhe({ ma_ghe: '', ten: '' }); }}>Thêm</button>
          </div>
        </Card>

        <Card title="Giờ mở cửa">
          <table className="table"><tbody>{data.gio_mo_cua.map((g) => (
            <tr key={g.thu}><td>{THU_TRONG_TUAN[g.thu]}</td>
              <td><input type="time" step={1800} className="inline-input" defaultValue={gio(g.gio_mo)} onBlur={(e) => e.target.value !== gio(g.gio_mo) && tai(() => api(`/quan-tri/gio-mo-cua/${g.thu}`, { method: 'PUT', body: { gio_mo: e.target.value } }), 'Đã lưu')} /></td>
              <td><input type="time" step={1800} className="inline-input" defaultValue={gio(g.gio_dong)} onBlur={(e) => e.target.value !== gio(g.gio_dong) && tai(() => api(`/quan-tri/gio-mo-cua/${g.thu}`, { method: 'PUT', body: { gio_dong: e.target.value } }), 'Đã lưu')} /></td>
              <td><label className="check"><input type="checkbox" checked={g.nghi} onChange={(e) => tai(() => api(`/quan-tri/gio-mo-cua/${g.thu}`, { method: 'PUT', body: { nghi: e.target.checked } }), 'Đã lưu')} /> Nghỉ</label></td></tr>))}</tbody></table>
        </Card>

        <Card title="Lý do hủy lịch">
          <table className="table"><tbody>{data.ly_do_huy.map((l) => (
            <tr key={l.id} className={l.dang_hoat_dong ? '' : 'row-muted'}><td>{l.ten}</td><td className="muted small">{l.so_lan_dung} lần</td>
              <td className="right"><button className="btn btn-sm" onClick={() => tai(() => api(`/quan-tri/ly-do-huy/${l.id}`, { method: 'PUT', body: { dang_hoat_dong: !l.dang_hoat_dong } }), 'Đã cập nhật')}>{l.dang_hoat_dong ? 'Ẩn' : 'Hiện'}</button></td></tr>))}</tbody></table>
          <div className="gap mt">
            <input placeholder="Lý do mới" value={lyDo} onChange={(e) => setLyDo(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-sm" disabled={!lyDo.trim()} onClick={async () => { if (await tai(() => api('/quan-tri/ly-do-huy', { method: 'POST', body: { ten: lyDo } }), 'Đã thêm')) setLyDo(''); }}>Thêm</button>
          </div>
        </Card>

        <Card title="Ngày nghỉ (lễ, Tết)">
          <table className="table"><tbody>{data.ngay_nghi.map((n) => (
            <tr key={n.ngay}><td className="nowrap">{ngay(n.ngay, true)}</td><td>{n.ly_do}</td>
              <td className="right"><button className="btn btn-sm btn-danger" onClick={() => tai(() => api(`/quan-tri/ngay-nghi/${n.ngay}`, { method: 'DELETE' }), 'Đã xóa')}>×</button></td></tr>))}</tbody></table>
          <div className="gap mt">
            <input type="date" value={nghi.ngay} onChange={(e) => setNghi({ ...nghi, ngay: e.target.value })} style={{ width: 160 }} />
            <input placeholder="Lý do" value={nghi.ly_do} onChange={(e) => setNghi({ ...nghi, ly_do: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn-sm" disabled={!nghi.ngay || !nghi.ly_do} onClick={async () => { if (await tai(() => api('/quan-tri/ngay-nghi', { method: 'POST', body: nghi }), 'Đã thêm ngày nghỉ')) setNghi({ ngay: '', ly_do: '' }); }}>Thêm</button>
          </div>
        </Card>
      </div>

      <Card title="Tỷ lệ ăn chia của bác sĩ (A29)">
        <table className="table"><thead><tr><th>Bác sĩ</th><th className="num">Tỷ lệ</th><th>Hiệu lực từ</th><th>Ghi chú</th><th /></tr></thead>
          <tbody>{data.ty_le_an_chia.map((t) => (
            <tr key={t.id} className={t.dang_ap_dung ? '' : 'row-muted'}><td>{t.ho_ten}</td><td className="num bold">{t.ty_le}%</td><td>{ngay(t.hieu_luc_tu)}</td><td>{t.ghi_chu}</td>
              <td>{t.dang_ap_dung && <Badge nhan="Đang áp dụng" mau="luc" />}</td></tr>))}</tbody></table>
        <div className="gap mt">
          <select value={tyLe.bac_si_id} onChange={(e) => setTyLe({ ...tyLe, bac_si_id: e.target.value })} style={{ width: 200 }}>
            <option value="">— Bác sĩ —</option>{dm?.bac_si.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}</option>)}
          </select>
          <input className="inline-input" type="number" min={0} max={100} placeholder="%" value={tyLe.ty_le} onChange={(e) => setTyLe({ ...tyLe, ty_le: e.target.value })} />
          <input type="date" value={tyLe.hieu_luc_tu} onChange={(e) => setTyLe({ ...tyLe, hieu_luc_tu: e.target.value })} style={{ width: 160 }} />
          <input placeholder="Ghi chú" value={tyLe.ghi_chu} onChange={(e) => setTyLe({ ...tyLe, ghi_chu: e.target.value })} style={{ flex: 1 }} />
          <button className="btn btn-sm" disabled={!tyLe.bac_si_id || tyLe.ty_le === ''} onClick={async () => { if (await tai(() => api('/quan-tri/ty-le-an-chia', { method: 'POST', body: tyLe }), 'Đã thêm tỷ lệ')) setTyLe({ ...tyLe, ty_le: '', ghi_chu: '' }); }}>Thêm tỷ lệ mới</button>
        </div>
      </Card>
    </>
  );
}
