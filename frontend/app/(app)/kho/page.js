'use client';
// UC39 danh mục thuốc & vật tư · UC40 nhập kho · UC41 kiểm kê · UC42 cảnh báo dưới ngưỡng
import { useState } from 'react';
import { api, useData } from '@/lib/api';
import { tien, so, ngay, thoiDiem, homNay } from '@/lib/format';
import { LOAI_KHO, LOAI_GIAO_DICH } from '@/lib/nhan';
import { PageHeader, Card, Loading, ErrorBox, Tabs, Badge, Modal, Field, Alert, MoneyInput, chay } from '@/components/ui';

const MH_RONG = { ma: '', ten: '', loai: 'VAT_TU', don_vi_tinh: '', hoat_chat: '', ham_luong: '', nguong_toi_thieu: 0 };

export default function Kho() {
  const { data, error, reload } = useData('/kho/mat-hang');
  const [tab, setTab] = useState('ton');
  const [mh, setMh] = useState(null);
  const [nhap, setNhap] = useState({ thuoc_vat_tu_id: '', so_luong: '', don_gia_nhap: '', nha_cung_cap: '', so_lo: '', han_dung: '', ly_do: '' });
  const [kiemKe, setKiemKe] = useState({});
  const [gd, setGd] = useState(null);
  const [giaThuoc, setGiaThuoc] = useState(null);
  const { data: lichSu } = useData(gd ? `/kho/mat-hang/${gd.id}/giao-dich` : null);

  const canhBao = data?.filter((m) => m.dang_hoat_dong && m.duoi_nguong) ?? [];

  async function luuMh() {
    const r = await chay(() => (mh.id ? api(`/kho/mat-hang/${mh.id}`, { method: 'PUT', body: mh }) : api('/kho/mat-hang', { method: 'POST', body: mh })), 'Đã lưu mặt hàng');
    if (r) { setMh(null); reload(); }
  }
  async function luuNhap() {
    const r = await chay(() => api('/kho/nhap', { method: 'POST', body: nhap }), 'Đã nhập kho');
    if (r) { setNhap({ ...nhap, so_luong: '', don_gia_nhap: '', so_lo: '', han_dung: '' }); reload(); }
  }
  async function luuKiemKe() {
    const items = Object.entries(kiemKe).map(([id, v]) => ({ thuoc_vat_tu_id: Number(id), ton_thuc_te: v }));
    const r = await chay(() => api('/kho/kiem-ke', { method: 'POST', body: { items, ly_do: `Kiểm kê ${ngay(homNay())}` } }), 'Đã ghi kết quả kiểm kê');
    if (r) { setKiemKe({}); reload(); }
  }

  return (
    <>
      <PageHeader title="Kho thuốc & vật tư" sub="Tồn kho chỉ thay đổi qua nhập kho, xuất theo phiếu điều trị và điều chỉnh kiểm kê">
        <button className="btn btn-primary" onClick={() => setMh({ ...MH_RONG })}>+ Mặt hàng</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {canhBao.length > 0 && <Alert loai="canh-bao"><b>Dưới ngưỡng tối thiểu:</b> {canhBao.map((m) => `${m.ten} (${so(m.ton_kho)}/${so(m.nguong_toi_thieu)} ${m.don_vi_tinh})`).join('; ')}</Alert>}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'ton', ten: 'Tồn kho', so: data?.length }, { id: 'nhap', ten: 'Nhập kho' }, { id: 'kk', ten: 'Kiểm kê' }]} />
      {!data ? <Loading /> : tab === 'ton' ? (
        <Card>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Hoạt chất / quy cách</th><th className="num">Tồn</th><th className="num">Ngưỡng</th><th className="num">Giá bán</th><th>HSD lô mới</th><th /></tr></thead>
            <tbody>{data.map((m) => (
              <tr key={m.id} className={!m.dang_hoat_dong ? 'row-muted' : m.duoi_nguong ? 'row-warn' : ''}>
                <td>{m.ma}</td><td><b>{m.ten}</b> {m.duoi_nguong && m.dang_hoat_dong && <Badge nhan="Sắp hết" mau="do" />}</td>
                <td>{LOAI_KHO[m.loai]}</td><td>{[m.hoat_chat, m.ham_luong].filter(Boolean).join(' · ')}</td>
                <td className="num bold">{so(m.ton_kho)} {m.don_vi_tinh}</td><td className="num">{so(m.nguong_toi_thieu)}</td>
                <td className="num">{m.loai === 'THUOC' ? tien(m.don_gia) : '—'}</td><td>{ngay(m.han_dung_lo_moi)}</td>
                <td className="right nowrap">
                  <button className="btn btn-sm" onClick={() => setGd(m)}>Giao dịch</button>{' '}
                  {m.loai === 'THUOC' && <><button className="btn btn-sm" onClick={() => setGiaThuoc({ thuoc_id: m.id, ten: m.ten, don_gia: m.don_gia ?? '', hieu_luc_tu: homNay(1) })}>Giá</button>{' '}</>}
                  <button className="btn btn-sm" onClick={() => setMh({ ...m })}>Sửa</button></td>
              </tr>))}</tbody>
          </table></div>
        </Card>
      ) : tab === 'nhap' ? (
        <Card title="Phiếu nhập kho">
          <div className="form-grid">
            <Field label="Mặt hàng" required>
              <select value={nhap.thuoc_vat_tu_id} onChange={(e) => setNhap({ ...nhap, thuoc_vat_tu_id: e.target.value })}>
                <option value="">— Chọn —</option>
                {data.filter((m) => m.dang_hoat_dong).map((m) => <option key={m.id} value={m.id}>{m.ten} ({m.don_vi_tinh}, tồn {so(m.ton_kho)})</option>)}
              </select>
            </Field>
            <Field label="Số lượng" required><input type="number" min={1} value={nhap.so_luong} onChange={(e) => setNhap({ ...nhap, so_luong: e.target.value })} /></Field>
            <Field label="Đơn giá nhập"><MoneyInput value={nhap.don_gia_nhap} onChange={(v) => setNhap({ ...nhap, don_gia_nhap: v })} /></Field>
            <Field label="Nhà cung cấp"><input value={nhap.nha_cung_cap} onChange={(e) => setNhap({ ...nhap, nha_cung_cap: e.target.value })} /></Field>
            <Field label="Số lô"><input value={nhap.so_lo} onChange={(e) => setNhap({ ...nhap, so_lo: e.target.value })} /></Field>
            <Field label="Hạn dùng"><input type="date" value={nhap.han_dung} onChange={(e) => setNhap({ ...nhap, han_dung: e.target.value })} /></Field>
            <Field label="Ghi chú" wide><input value={nhap.ly_do} onChange={(e) => setNhap({ ...nhap, ly_do: e.target.value })} placeholder="Nhập hàng" /></Field>
          </div>
          <button className="btn btn-primary mt" disabled={!nhap.thuoc_vat_tu_id || !nhap.so_luong} onClick={luuNhap}>Nhập kho</button>
        </Card>
      ) : (
        <Card title="Kiểm kê — nhập số đếm thực tế (bỏ trống nếu không kiểm)" actions={<button className="btn btn-primary" disabled={!Object.keys(kiemKe).length} onClick={luuKiemKe}>Ghi kết quả kiểm kê</button>}>
          <table className="table"><thead><tr><th>Mặt hàng</th><th className="num">Tồn sổ sách</th><th>Đếm thực tế</th><th className="num">Chênh lệch</th></tr></thead>
            <tbody>{data.filter((m) => m.dang_hoat_dong).map((m) => {
              const v = kiemKe[m.id];
              const chenh = v === undefined || v === '' ? null : Number(v) - m.ton_kho;
              return (
                <tr key={m.id}><td>{m.ten}</td><td className="num">{so(m.ton_kho)} {m.don_vi_tinh}</td>
                  <td><input className="inline-input" type="number" min={0} step="0.5" value={v ?? ''}
                    onChange={(e) => setKiemKe((k) => { const n = { ...k }; if (e.target.value === '') delete n[m.id]; else n[m.id] = e.target.value; return n; })} /></td>
                  <td className={`num ${chenh ? 'text-do bold' : ''}`}>{chenh === null ? '' : chenh > 0 ? `+${so(chenh)}` : so(chenh)}</td></tr>
              );
            })}</tbody></table>
        </Card>
      )}

      {mh && (
        <Modal title={mh.id ? 'Sửa mặt hàng' : 'Thêm mặt hàng'} onClose={() => setMh(null)}
          footer={<><button className="btn" onClick={() => setMh(null)}>Hủy</button><button className="btn btn-primary" onClick={luuMh}>Lưu</button></>}>
          <div className="form-grid">
            <Field label="Mã" required><input value={mh.ma} onChange={(e) => setMh({ ...mh, ma: e.target.value })} /></Field>
            <Field label="Tên" required><input value={mh.ten} onChange={(e) => setMh({ ...mh, ten: e.target.value })} /></Field>
            <Field label="Loại"><select value={mh.loai} onChange={(e) => setMh({ ...mh, loai: e.target.value })}><option value="THUOC">Thuốc</option><option value="VAT_TU">Vật tư</option></select></Field>
            <Field label="Đơn vị tính" required><input value={mh.don_vi_tinh} onChange={(e) => setMh({ ...mh, don_vi_tinh: e.target.value })} /></Field>
            <Field label={mh.loai === 'THUOC' ? 'Hoạt chất' : 'Chất liệu'}><input value={mh.hoat_chat ?? ''} onChange={(e) => setMh({ ...mh, hoat_chat: e.target.value })} /></Field>
            <Field label={mh.loai === 'THUOC' ? 'Hàm lượng' : 'Quy cách'}><input value={mh.ham_luong ?? ''} onChange={(e) => setMh({ ...mh, ham_luong: e.target.value })} /></Field>
            <Field label="Ngưỡng tối thiểu" hint="Tồn ≤ ngưỡng thì cảnh báo"><input type="number" min={0} value={mh.nguong_toi_thieu} onChange={(e) => setMh({ ...mh, nguong_toi_thieu: e.target.value })} /></Field>
            {mh.id && <label className="check"><input type="checkbox" checked={mh.dang_hoat_dong} onChange={(e) => setMh({ ...mh, dang_hoat_dong: e.target.checked })} /> Đang sử dụng</label>}
          </div>
        </Modal>
      )}
      {giaThuoc && (
        <Modal title={`Giá bán mới — ${giaThuoc.ten}`} onClose={() => setGiaThuoc(null)}
          footer={<><button className="btn" onClick={() => setGiaThuoc(null)}>Hủy</button>
            <button className="btn btn-primary" onClick={async () => { if (await chay(() => api('/kho/gia-thuoc', { method: 'POST', body: giaThuoc }), 'Đã thêm giá')) { setGiaThuoc(null); reload(); } }}>Thêm giá</button></>}>
          <div className="form-grid">
            <Field label="Đơn giá"><MoneyInput value={giaThuoc.don_gia} onChange={(v) => setGiaThuoc({ ...giaThuoc, don_gia: v })} /></Field>
            <Field label="Hiệu lực từ"><input type="date" value={giaThuoc.hieu_luc_tu} onChange={(e) => setGiaThuoc({ ...giaThuoc, hieu_luc_tu: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
      {gd && (
        <Modal title={`Giao dịch kho — ${gd.ten}`} onClose={() => setGd(null)} wide>
          {!lichSu ? <Loading /> : (
            <table className="table"><thead><tr><th>Thời điểm</th><th>Loại</th><th className="num">SL</th><th className="num">Tồn sau</th><th>Chi tiết</th><th>Người</th></tr></thead>
              <tbody>{lichSu.map((g) => (
                <tr key={g.id}><td className="nowrap">{thoiDiem(g.thoi_diem)}</td><td>{LOAI_GIAO_DICH[g.loai]}</td>
                  <td className={`num ${g.so_luong < 0 ? 'text-do' : 'text-luc'}`}>{g.so_luong > 0 ? '+' : ''}{so(g.so_luong)}</td><td className="num">{so(g.ton_sau)}</td>
                  <td className="small">{g.ma_phieu && `Phiếu ${g.ma_phieu} · `}{g.ly_do}{g.so_lo && ` · Lô ${g.so_lo}`}{g.han_dung && ` · HSD ${ngay(g.han_dung)}`}{g.nha_cung_cap && ` · ${g.nha_cung_cap}`}</td>
                  <td>{g.nguoi_thao_tac}</td></tr>))}</tbody></table>
          )}
        </Modal>
      )}
    </>
  );
}
