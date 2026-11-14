'use client';
// Khung ứng dụng: thanh menu theo vai trò, người dùng hiện tại
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { VAI_TRO } from '@/lib/nhan';
import { Loading, ToastHost } from './ui';

const NguoiDungCtx = createContext(null);
export const useNguoiDung = () => useContext(NguoiDungCtx);
export const coVaiTro = (user, ...roles) => roles.some((r) => user?.vai_tro?.includes(r));

const LT = 'LE_TAN', BS = 'BAC_SI', QL = 'QUAN_LY';

const MENU = [
  { nhom: null, muc: [{ href: '/', ten: 'Trang chủ', icon: '⌂' }] },
  {
    nhom: 'Tiếp đón', muc: [
      { href: '/lich-hen', ten: 'Lịch hẹn', icon: '▦' },
      { href: '/lich-hen/dat', ten: 'Đặt lịch', icon: '+', roles: [LT, QL] },
      { href: '/lich-hen/nhac-lich', ten: 'Nhắc lịch', icon: '☎', roles: [LT, QL] },
      { href: '/benh-nhan', ten: 'Bệnh nhân', icon: '☺' },
    ],
  },
  { nhom: 'Khám & điều trị', muc: [{ href: '/kham', ten: 'Chờ khám', icon: '✚', roles: [BS, QL] }] },
  {
    nhom: 'Thu ngân', roles: [LT, QL], muc: [
      { href: '/thanh-toan', ten: 'Thanh toán', icon: '₫' },
      { href: '/thanh-toan/cong-no', ten: 'Công nợ', icon: '≡' },
      { href: '/thanh-toan/chot-ket', ten: 'Chốt két', icon: '▣' },
    ],
  },
  {
    nhom: 'Danh mục', muc: [
      { href: '/ca-truc', ten: 'Ca trực', icon: '◷' },
      { href: '/bang-gia', ten: 'Bảng giá', icon: '☰' },
      { href: '/kho', ten: 'Kho thuốc & vật tư', icon: '▤', roles: [QL] },
      { href: '/kho/dinh-muc', ten: 'Định mức vật tư', icon: '⚖', roles: [QL] },
    ],
  },
  {
    nhom: 'Quản lý', roles: [QL], muc: [
      { href: '/bao-cao', ten: 'Báo cáo', icon: '◔' },
      { href: '/quan-tri/nhan-vien', ten: 'Nhân viên', icon: '♟' },
      { href: '/quan-tri/danh-muc', ten: 'Danh mục chung', icon: '⚙' },
    ],
  },
];

function laMucDangMo(pathname, href) {
  if (href === '/') return pathname === '/';
  // Mục cụ thể nhất thắng (vd. /kho/dinh-muc không làm sáng /kho)
  const tatCa = MENU.flatMap((g) => g.muc.map((m) => m.href));
  const khop = tatCa.filter((h) => h !== '/' && (pathname === h || pathname.startsWith(`${h}/`)));
  return khop.sort((a, b) => b.length - a.length)[0] === href;
}

export default function Shell({ children }) {
  const [user, setUser] = useState(null);
  const [menuMo, setMenuMo] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    api('/auth/toi').then(setUser).catch(() => {});
  }, []);
  useEffect(() => setMenuMo(false), [pathname]);

  if (!user) return <Loading text="Đang kiểm tra đăng nhập…" />;

  const thay = (roles) => !roles || coVaiTro(user, ...roles);

  async function dangXuat() {
    await api('/auth/dang-xuat', { method: 'POST' }).catch(() => {});
    router.replace('/dang-nhap');
  }

  return (
    <NguoiDungCtx.Provider value={user}>
      <div className={`shell ${menuMo ? 'menu-mo' : ''}`}>
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-logo">🦷</span>
            <div>
              <div className="brand-name">Nụ Cười Việt</div>
              <div className="brand-sub">Quản lý phòng khám</div>
            </div>
          </div>
          <nav>
            {MENU.filter((g) => thay(g.roles)).map((g) => {
              const muc = g.muc.filter((m) => thay(m.roles));
              if (!muc.length) return null;
              return (
                <div key={g.nhom ?? 'chinh'} className="nav-group">
                  {g.nhom && <div className="nav-title">{g.nhom}</div>}
                  {muc.map((m) => (
                    <Link key={m.href} href={m.href} className={`nav-item ${laMucDangMo(pathname, m.href) ? 'active' : ''}`}>
                      <span className="nav-icon" aria-hidden>{m.icon}</span>{m.ten}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>
        <div className="main">
          <header className="topbar">
            <button className="btn-icon menu-toggle" onClick={() => setMenuMo((v) => !v)} aria-label="Menu">☰</button>
            <div className="topbar-user">
              <div className="user-info">
                <strong>{user.ho_ten}</strong>
                <span className="muted">{user.vai_tro.map((v) => VAI_TRO[v]).join(' · ')}</span>
              </div>
              <Link className="btn btn-sm btn-ghost" href="/doi-mat-khau">Đổi mật khẩu</Link>
              <button className="btn btn-sm btn-ghost" onClick={dangXuat}>Đăng xuất</button>
            </div>
          </header>
          <main className="content">{children}</main>
        </div>
      </div>
      <ToastHost />
    </NguoiDungCtx.Provider>
  );
}
