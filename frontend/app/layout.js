import './globals.css';

export const metadata = {
  title: 'Nha khoa Nụ Cười Việt — Quản lý phòng khám',
  description: 'Hệ thống quản lý lịch hẹn, điều trị, thanh toán, kho của Nha khoa Nụ Cười Việt',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
