// Chuyển tiếp /api/* sang API Node.js (backend) để trình duyệt chỉ làm việc với một origin (cookie đăng nhập)
import { fileURLToPath } from 'node:url';

const API_URL = process.env.CLINIC_API_URL ?? 'http://localhost:4000';
// Gốc của frontend (thư mục gốc dự án cũng có package-lock.json cho lệnh chung)
const ROOT = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: ROOT,
  turbopack: { root: ROOT },
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
