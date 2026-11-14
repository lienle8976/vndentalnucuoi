'use client';
// UC30 — Tra cứu bảng giá; UC38 — Quản lý bảng giá (thêm giá mới kèm ngày hiệu lực, không ghi đè)
import { Fragment, useState } from 'react';
import { api, useData } from '@/lib/api';
import { tien, ngay, homNay } from '@/lib/format';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import { PageHeader, Card, Loading, ErrorBox, Badge, Modal, Field, MoneyInput, chay } from '@/components/ui';

export default function BangGia() {
  const ql = coVaiTro(useNguoiDung(), 'QUAN_LY');
  const { data, error, reload } = useData('/kho/bang-gia');
  const [mo, setMo] = useState(null);
  const [gia, setGia] = useState(null);
  const [dv, setDv] = useState(null);
  const [tu, setTu] = useState('');
  const ds = (data ?? []).filter((d) => !tu || `${d.ma_dich_vu} ${d.ten} ${d.nhom}`.toLowerCase().includes(tu.toLowerCase()));

  async function luuGia() {
    if (await chay(() => api('/kho/bang-gia', { method: 'POST', body: gia }), 'Đã thêm giá mới')) { setGia(null); reload(); }
  }
  async function luuDv() {
    const r = await chay(() => (dv.id ? api(`/kho/dich-vu/${dv.id}`, { method: 'PUT', body: dv }) : api('/kho/dich-vu', { method: 'POST', body: dv })), 'Đã lưu dịch vụ');
    if (r) { setDv(null); reload(); }
  }

  return (
    <>
      <PageHeader title="Bảng giá dịch vụ" sub="Giá trên hóa đơn lấy theo giá có hiệu lực vào ngày làm; đổi giá là thêm giá mới, giá cũ vẫn giữ">
        <input placeholder="Tìm dịch vụ" value={tu} onChange={(e) => setTu(e.target.value)} style={{ width: 220 }} />
        {ql && <button className="btn btn-primary" onClick={() => setDv({ ma_dich_vu: '', ten: '', nhom: '', don_vi_tinh: 'Lần', la_lieu_trinh: false, mo_ta: '', don_gia: '', hieu_luc_tu: homNay() })}>+ Dịch vụ</button>}
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      <Card>
        {!data ? <Loading /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Mã</th><th>Dịch vụ</th><th>Nhóm</th><th>ĐVT</th><th className="num">Giá hiện hành</th><th>Lịch sử giá</th>{ql && <th />}</tr></thead>
            <tbody>{ds.map((d) => (
              <Fragment key={d.id}>
                <tr className={d.dang_hoat_dong ? '' : 'row-muted'}>
                  <td>{d.ma_dich_vu}</td>
                  <td><b>{d.ten}</b> {d.la_lieu_trinh && <Badge nhan="Gói liệu trình" mau="xanh" />} {!d.dang_hoat_dong && <Badge nhan="Ngừng" mau="do" />}
                    {d.mo_ta && <div className="small muted">{d.mo_ta}</div>}</td>
                  <td>{d.nhom}</td><td>{d.don_vi_tinh}</td>
                  <td className="num bold">{tien(d.don_gia)}</td>
                  <td><button className="btn btn-sm btn-ghost" onClick={() => setMo(mo === d.id ? null : d.id)}>{d.lich_su_gia.length} mức giá {mo === d.id ? '▲' : '▼'}</button></td>
                  {ql && <td className="right nowrap">
                    <button className="btn btn-sm" onClick={() => setGia({ dich_vu_id: d.id, ten: d.ten, don_gia: d.don_gia ?? '', hieu_luc_tu: homNay(1), ghi_chu: '' })}>Giá mới</button>{' '}
                    <button className="btn btn-sm" onClick={() => setDv({ ...d })}>Sửa</button></td>}
                </tr>
                {mo === d.id && d.lich_su_gia.map((g) => (
                  <tr key={g.id} className="row-muted"><td /><td colSpan={3}>Từ {ngay(g.hieu_luc_tu)}{g.hieu_luc_tu > homNay() && ' (sắp áp dụng)'} — {g.ghi_chu}</td><td className="num">{tien(g.don_gia)}</td><td colSpan={ql ? 2 : 1} /></tr>
                ))}
              </Fragment>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      {gia && (
        <Modal title={`Giá mới — ${gia.ten}`} onClose={() => setGia(null)}
          footer={<><button className="btn" onClick={() => setGia(null)}>Hủy</button><button className="btn btn-primary" onClick={luuGia}>Thêm giá</button></>}>
          <div className="form-grid">
            <Field label="Đơn giá" required><MoneyInput value={gia.don_gia} onChange={(v) => setGia({ ...gia, don_gia: v })} /></Field>
            <Field label="Hiệu lực từ" required><input type="date" value={gia.hieu_luc_tu} onChange={(e) => setGia({ ...gia, hieu_luc_tu: e.target.value })} /></Field>
            <Field label="Ghi chú" wide><input value={gia.ghi_chu} onChange={(e) => setGia({ ...gia, ghi_chu: e.target.value })} placeholder="Lý do đổi giá" /></Field>
          </div>
          <p className="muted small">Hóa đơn đã lập giữ nguyên giá lúc làm.</p>
        </Modal>
      )}
      {dv && (
        <Modal title={dv.id ? 'Sửa dịch vụ' : 'Thêm dịch vụ'} onClose={() => setDv(null)}
          footer={<><button className="btn" onClick={() => setDv(null)}>Hủy</button><button className="btn btn-primary" onClick={luuDv}>Lưu</button></>}>
          <div className="form-grid">
            <Field label="Mã" required><input value={dv.ma_dich_vu} onChange={(e) => setDv({ ...dv, ma_dich_vu: e.target.value })} /></Field>
            <Field label="Tên" required><input value={dv.ten} onChange={(e) => setDv({ ...dv, ten: e.target.value })} /></Field>
            <Field label="Nhóm"><input value={dv.nhom ?? ''} onChange={(e) => setDv({ ...dv, nhom: e.target.value })} /></Field>
            <Field label="Đơn vị tính"><input value={dv.don_vi_tinh} onChange={(e) => setDv({ ...dv, don_vi_tinh: e.target.value })} /></Field>
            {!dv.id && <Field label="Giá khởi tạo"><MoneyInput value={dv.don_gia} onChange={(v) => setDv({ ...dv, don_gia: v })} /></Field>}
            <Field label="Mô tả" wide><textarea rows={2} value={dv.mo_ta ?? ''} onChange={(e) => setDv({ ...dv, mo_ta: e.target.value })} /></Field>
            <label className="check"><input type="checkbox" checked={dv.la_lieu_trinh} onChange={(e) => setDv({ ...dv, la_lieu_trinh: e.target.checked })} /> Gói liệu trình</label>
            {dv.id && <label className="check"><input type="checkbox" checked={dv.dang_hoat_dong} onChange={(e) => setDv({ ...dv, dang_hoat_dong: e.target.checked })} /> Đang hoạt động</label>}
          </div>
        </Modal>
      )}
    </>
  );
}
