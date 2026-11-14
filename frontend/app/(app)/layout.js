import Shell from '@/components/Shell';

// Mọi trang nghiệp vụ: cần đăng nhập, có thanh menu
export default function AppLayout({ children }) {
  return <Shell>{children}</Shell>;
}
