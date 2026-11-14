'use client';
// UC01 — Đăng nhập
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function DangNhap() {
  const router = useRouter();
  const tiep = useSearchParams().get('tiep');
  const [f, setF] = useState({ ten_dang_nhap: '', mat_khau: '' });
  const [loi, setLoi] = useState('');
  const [dangGui, setDangGui] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setDangGui(true);
    setLoi('');
    try {
      await api('/auth/dang-nhap', { method: 'POST', body: f });
      router.replace(tiep?.startsWith('/') ? tiep : '/');
    } catch (err) {
      setLoi(err.message);
      setDangGui(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="center" style={{ fontSize: 40 }}>🦷</div>
        <h1>Nha khoa Nụ Cười Việt</h1>
        <p className="muted center" style={{ margin: 0 }}>Đăng nhập dành cho nhân viên</p>
        <form onSubmit={submit}>
          {loi && <div className="alert alert-loi">{loi}</div>}
          <label className="field">
            <span className="field-label">Tên đăng nhập</span>
            <input autoFocus autoComplete="username" value={f.ten_dang_nhap}
              onChange={(e) => setF({ ...f, ten_dang_nhap: e.target.value })} required />
          </label>
          <label className="field">
            <span className="field-label">Mật khẩu</span>
            <input type="password" autoComplete="current-password" value={f.mat_khau}
              onChange={(e) => setF({ ...f, mat_khau: e.target.value })} required />
          </label>
          <button className="btn btn-primary" disabled={dangGui}>{dangGui ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><DangNhap /></Suspense>;
}
