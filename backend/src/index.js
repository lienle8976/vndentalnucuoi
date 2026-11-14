// API Nha khoa Nụ Cười Việt — chạy: cd backend && npm start  →  http://localhost:4000
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool, dbInfo } from './db.js';
import { requireAuth } from './auth.js';
import { xuLyLoi } from './loi.js';
import authRoutes from './routes/auth.js';
import chungRoutes from './routes/chung.js';
import benhNhanRoutes from './routes/benhNhan.js';
import caTrucRoutes from './routes/caTruc.js';
import lichHenRoutes from './routes/lichHen.js';
import khamRoutes from './routes/kham.js';
import thanhToanRoutes from './routes/thanhToan.js';
import khoRoutes from './routes/kho.js';
import quanTriRoutes from './routes/quanTri.js';
import baoCaoRoutes from './routes/baoCao.js';

const PROD = process.env.NODE_ENV === 'production';
// Host online (Render, Railway...) cấp cổng qua PORT và cần lắng nghe mọi địa chỉ
const PORT = Number(process.env.PORT ?? process.env.CLINIC_API_PORT ?? 4000);
const HOST = process.env.HOST ?? (PROD ? '0.0.0.0' : '127.0.0.1');

const app = express();
app.disable('x-powered-by');
if (PROD) app.set('trust proxy', 1); // sau proxy HTTPS của host: req.secure, IP thật
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Gắn cảnh báo từ DB (RAISE WARNING) vào phản hồi JSON dạng object
app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (req.canhBao?.length && body && typeof body === 'object' && !Array.isArray(body)) {
      body = { ...body, canh_bao: req.canhBao };
    }
    return json(body);
  };
  next();
});

app.get('/api/health', async (_req, res) => {
  const r = await pool.query('SELECT current_database() AS db');
  res.json({ status: 'ok', database: r.rows[0].db });
});

app.use('/api/auth', authRoutes);

// Mọi API phía dưới cần đăng nhập
app.use('/api', requireAuth);
app.use('/api', chungRoutes);
app.use('/api/benh-nhan', benhNhanRoutes);
app.use('/api/ca-truc', caTrucRoutes);
app.use('/api/lich-hen', lichHenRoutes);
app.use('/api/kham', khamRoutes);
app.use('/api/thanh-toan', thanhToanRoutes);
app.use('/api/kho', khoRoutes);
app.use('/api/quan-tri', quanTriRoutes);
app.use('/api/bao-cao', baoCaoRoutes);

app.use('/api', (_req, res) => res.status(404).json({ loi: 'Không tìm thấy API' }));
app.use(xuLyLoi);

app.listen(PORT, HOST, () => {
  console.log(`Clinic API: http://${HOST}:${PORT}  (${PROD ? 'production' : 'development'}, database ${dbInfo})`);
});
