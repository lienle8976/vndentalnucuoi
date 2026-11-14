'use client';
// Thành phần giao diện dùng chung
import { useEffect, useSyncExternalStore } from 'react';

/* ---------------- Thông báo (toast) ---------------- */
let toasts = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const EMPTY = [];

export function thongBao(noiDung, loai = 'ok') {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, noiDung, loai }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, loai === 'loi' ? 7000 : 4500);
}

export function ToastHost() {
  const ds = useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="toast-host">
      {ds.map((t) => <div key={t.id} className={`toast toast-${t.loai}`}>{t.noiDung}</div>)}
    </div>
  );
}

/** Chạy một thao tác: báo lỗi / thành công / cảnh báo từ DB. Trả về kết quả hoặc null nếu lỗi */
export async function chay(fn, thanhCong) {
  try {
    const r = await fn();
    if (thanhCong) thongBao(thanhCong);
    (r?.canh_bao ?? []).forEach((w) => thongBao(w, 'canh-bao'));
    return r ?? true;
  } catch (e) {
    thongBao(e.message, 'loi');
    return null;
  }
}

/* ---------------- Bố cục ---------------- */
export function PageHeader({ title, sub, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Badge({ nhan, mau = 'xam' }) {
  return <span className={`badge badge-${mau}`}>{nhan}</span>;
}

/** Badge từ bảng nhãn {MA: {ten, mau}} */
export function TrangThai({ ma, bang }) {
  const t = bang[ma];
  return t ? <Badge nhan={t.ten} mau={t.mau} /> : <Badge nhan={ma ?? '—'} />;
}

export function Field({ label, children, hint, required, wide }) {
  return (
    <label className={`field ${wide ? 'wide' : ''}`}>
      <span className="field-label">{label}{required && <b className="req"> *</b>}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Loading({ text = 'Đang tải…' }) {
  return <div className="loading">{text}</div>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-loi">
      {error.message}
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Thử lại</button>}
    </div>
  );
}

export function Empty({ text = 'Không có dữ liệu' }) {
  return <div className="empty">{text}</div>;
}

export function Alert({ loai = 'info', children }) {
  return <div className={`alert alert-${loai}`}>{children}</div>;
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id}
          className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>
          {t.ten}{t.so !== undefined && <span className="tab-count">{t.so}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, href, mau }) {
  const inner = (
    <>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${mau ? `text-${mau}` : ''}`}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  return href ? <a className="stat" href={href}>{inner}</a> : <div className="stat">{inner}</div>;
}

/** Ô nhập tiền: hiển thị có dấu chấm ngăn cách, giá trị là số */
export function MoneyInput({ value, onChange, ...rest }) {
  const hien = value === '' || value === null || value === undefined ? '' : new Intl.NumberFormat('vi-VN').format(value);
  return (
    <input inputMode="numeric" value={hien} {...rest}
      onChange={(e) => {
        const so = e.target.value.replace(/[^\d]/g, '');
        onChange(so === '' ? '' : Number(so));
      }} />
  );
}
