// Web server cho database storedb
// Chạy: cd web && npm start  →  http://localhost:3000
import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT ?? 3000);

// Thông tin đăng nhập lấy từ ../.env (dùng chung với docker-compose)
const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.STORE_DB ?? 'storedb',
});

const app = express();
app.use(express.static(fileURLToPath(new URL('./public', import.meta.url))));

// Kiểm tra server và kết nối database
app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: pool.options.database });
});

// Danh sách danh mục kèm số sản phẩm
app.get('/api/categories', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT c.id, c.name, c.description, count(p.id)::int AS product_count
    FROM categories c
    LEFT JOIN products p ON p.category = c.name
    GROUP BY c.id
    ORDER BY c.id`);
  res.json(rows);
});

// Danh sách sản phẩm, lọc theo danh mục: /api/products?category=phone
app.get('/api/products', async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : null;
  const { rows } = await pool.query(`
    SELECT id, name, price::float AS price, image, description, category
    FROM products
    WHERE ($1::text IS NULL OR category = $1)
    ORDER BY id`, [category]);
  res.json(rows);
});

// Lỗi (kể cả lỗi kết nối database) trả về JSON thay vì làm sập server
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ hoặc không kết nối được database' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});
