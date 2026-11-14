'use client';
// UC03 — Quản lý tài khoản & phân quyền (một người có thể giữ nhiều vai trò — A03)
import { useState } from 'react';
import { api, useData } from '@/lib/api';
import { thoiDiem } from '@/lib/format';
import { VAI_TRO } from '@/lib/nhan';
import { PageHeader, Card, Loading, ErrorBox, Badge, Modal, Field, chay } from '@/components/ui';

export default function NhanVien() {
  const { data, error, reload } = useData('/quan-tri/nhan-vien');
  const [f, setF] = useState(null);
  const [mk, setMk] = useState(null);

  async function luu() {
    const r = await chay(() => (f.id ? api(`/quan-tri/nhan-vien/${f.id}`, { method: 'PUT', body: f }) : api('/quan-tri/nhan-vien', { method: 'POST', body: f })), 'Đã lưu nhân viên');
    if (r) { setF(null); reload(); }
  }

  return (
    <>
      <PageHeader title="Nhân viên & phân quyền">
        <button className="btn btn-primary" onClick={() => setF({ ma_nhan_vien: '', ho_ten: '', so_dien_thoai: '', email: '', ten_dang_nhap: '', mat_khau: '', vai_tro: [], ban_thoi_gian: false })}>+ Nhân viên</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      <Card>
        {!data ? <Loading /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Mã</th><th>Họ tên</th><th>Đăng nhập</th><th>Vai trò</th><th>Liên hệ</th><th>Đăng nhập cuối</th><th /></tr></thead>
            <tbody>{data.map((n) => (
              <tr key={n.id} className={n.dang_hoat_dong ? '' : 'row-muted'}>
                <td>{n.ma_nhan_vien}</td>
                <td><b>{n.ho_ten}</b> {n.ban_thoi_gian && <Badge nhan="Bán thời gian" />} {!n.dang_hoat_dong && <Badge nhan="Đã khóa" mau="do" />}</td>
                <td>{n.ten_dang_nhap}</td>
                <td><div className="gap">{n.vai_tro.map((v) => <Badge key={v} nhan={VAI_TRO[v]} mau="xanh" />)}</div></td>
                <td className="small">{n.so_dien_thoai}<div className="muted">{n.email}</div></td>
                <td className="small">{thoiDiem(n.dang_nhap_cuoi_luc)}</td>
                <td className="right nowrap">
                  <button className="btn btn-sm" onClick={() => setF({ ...n })}>Sửa</button>{' '}
                  <button className="btn btn-sm" onClick={() => setMk({ id: n.id, ho_ten: n.ho_ten, mat_khau_moi: '' })}>Đặt lại MK</button>
                </td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {f && (
        <Modal title={f.id ? 'Sửa nhân viên' : 'Thêm nhân viên'} onClose={() => setF(null)}
          footer={<><button className="btn" onClick={() => setF(null)}>Hủy</button><button className="btn btn-primary" onClick={luu}>Lưu</button></>}>
          <div className="form-grid">
            <Field label="Mã nhân viên" required><input value={f.ma_nhan_vien} onChange={(e) => setF({ ...f, ma_nhan_vien: e.target.value })} /></Field>
            <Field label="Họ tên" required><input value={f.ho_ten} onChange={(e) => setF({ ...f, ho_ten: e.target.value })} /></Field>
            <Field label="Số điện thoại"><input value={f.so_dien_thoai ?? ''} onChange={(e) => setF({ ...f, so_dien_thoai: e.target.value })} /></Field>
            <Field label="Email"><input type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Tên đăng nhập" required><input value={f.ten_dang_nhap} onChange={(e) => setF({ ...f, ten_dang_nhap: e.target.value })} /></Field>
            {!f.id && <Field label="Mật khẩu" required hint="Ít nhất 8 ký tự"><input type="password" value={f.mat_khau} onChange={(e) => setF({ ...f, mat_khau: e.target.value })} /></Field>}
            <Field label="Vai trò" required wide>
              <div className="gap">{Object.entries(VAI_TRO).map(([k, v]) => (
                <label key={k} className="check"><input type="checkbox" checked={f.vai_tro.includes(k)}
                  onChange={(e) => setF({ ...f, vai_tro: e.target.checked ? [...f.vai_tro, k] : f.vai_tro.filter((x) => x !== k) })} /> {v}</label>
              ))}</div>
            </Field>
            <label className="check"><input type="checkbox" checked={f.ban_thoi_gian} onChange={(e) => setF({ ...f, ban_thoi_gian: e.target.checked })} /> Bán thời gian</label>
            {f.id && <label className="check"><input type="checkbox" checked={f.dang_hoat_dong} onChange={(e) => setF({ ...f, dang_hoat_dong: e.target.checked })} /> Đang hoạt động</label>}
          </div>
        </Modal>
      )}
      {mk && (
        <Modal title={`Đặt lại mật khẩu — ${mk.ho_ten}`} onClose={() => setMk(null)}
          footer={<><button className="btn" onClick={() => setMk(null)}>Hủy</button>
            <button className="btn btn-primary" onClick={async () => { if (await chay(() => api(`/quan-tri/nhan-vien/${mk.id}/dat-lai-mat-khau`, { method: 'POST', body: mk }), 'Đã đặt lại mật khẩu')) setMk(null); }}>Lưu</button></>}>
          <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự; báo nhân viên đổi lại sau khi đăng nhập"><input type="password" value={mk.mat_khau_moi} onChange={(e) => setMk({ ...mk, mat_khau_moi: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  );
}
