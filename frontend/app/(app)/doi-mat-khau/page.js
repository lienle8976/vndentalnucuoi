'use client';
// UC02 — Đổi mật khẩu
import { useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Field, chay } from '@/components/ui';

export default function DoiMatKhau() {
  const [f, setF] = useState({ mat_khau_cu: '', mat_khau_moi: '', nhap_lai: '' });
  const [loi, setLoi] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (f.mat_khau_moi !== f.nhap_lai) return setLoi('Mật khẩu nhập lại không khớp');
    setLoi('');
    const ok = await chay(() => api('/auth/doi-mat-khau', { method: 'POST', body: f }), 'Đã đổi mật khẩu');
    if (ok) setF({ mat_khau_cu: '', mat_khau_moi: '', nhap_lai: '' });
  }

  return (
    <>
      <PageHeader title="Đổi mật khẩu" />
      <Card>
        <form onSubmit={submit} style={{ maxWidth: 400, display: 'grid', gap: 12 }}>
          {loi && <div className="alert alert-loi">{loi}</div>}
          <Field label="Mật khẩu hiện tại" required>
            <input type="password" value={f.mat_khau_cu} onChange={(e) => setF({ ...f, mat_khau_cu: e.target.value })} required />
          </Field>
          <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự" required>
            <input type="password" value={f.mat_khau_moi} onChange={(e) => setF({ ...f, mat_khau_moi: e.target.value })} required minLength={8} />
          </Field>
          <Field label="Nhập lại mật khẩu mới" required>
            <input type="password" value={f.nhap_lai} onChange={(e) => setF({ ...f, nhap_lai: e.target.value })} required />
          </Field>
          <div><button className="btn btn-primary">Đổi mật khẩu</button></div>
        </form>
      </Card>
    </>
  );
}
