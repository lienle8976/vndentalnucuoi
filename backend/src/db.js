// Kết nối ClinicCyberDB và các tiện ích truy vấn
import pg from 'pg';

// numeric / bigint → Number (tiền VND và id đều nằm trong giới hạn an toàn của JS)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// date → giữ nguyên chuỗi 'YYYY-MM-DD' để không bị lệch múi giờ
pg.types.setTypeParser(1082, (v) => v);

/**
 * Cấu hình kết nối:
 *  - Production (host online): đặt DATABASE_URL, vd.
 *      postgresql://LienAdmin:<mật_khẩu>@<host>.neon.tech/ClinicCyberDB?sslmode=require
 *    Múi giờ Asia/Ho_Chi_Minh đã đặt sẵn ở database (ALTER DATABASE ... SET timezone,
 *    xem database/ClinicCyberDB/trien_khai_online.sh) nên không truyền `options` —
 *    cổng pooler của Neon/Supabase không nhận tham số này.
 *  - Local (Docker): dùng các biến rời trong .env như cũ.
 */
const DATABASE_URL = process.env.DATABASE_URL?.trim();

export const pool = new pg.Pool(
  DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        max: Number(process.env.DB_POOL_MAX ?? 5), // gói free giới hạn số kết nối
        idleTimeoutMillis: 30_000, // trả kết nối sớm để DB serverless được ngủ
        connectionTimeoutMillis: 15_000, // Neon free cần vài giây để "thức dậy"
      }
    : {
        host: process.env.POSTGRES_HOST ?? '127.0.0.1',
        port: Number(process.env.POSTGRES_PORT ?? 5432),
        user: process.env.CLINIC_DB_ADMIN_USER,
        password: process.env.CLINIC_DB_ADMIN_PASSWORD,
        database: process.env.CLINIC_DB ?? 'ClinicCyberDB',
        options: '-c timezone=Asia/Ho_Chi_Minh', // current_date, giờ khám... theo giờ Việt Nam
      },
);

// Mô tả kết nối để ghi log (không lộ mật khẩu)
export const dbInfo = (() => {
  if (!DATABASE_URL) return `${pool.options.host}:${pool.options.port}/${pool.options.database}`;
  const u = new URL(DATABASE_URL);
  return `${u.hostname}${u.pathname}`;
})();

// Lỗi của kết nối đang rảnh (vd. host đóng kết nối khi DB ngủ) — ghi log, không làm sập server
pool.on('error', (e) => console.error('[db] kết nối rảnh bị lỗi:', e.message));

export const q = async (sql, params) => (await pool.query(sql, params)).rows;
export const q1 = async (sql, params) => (await pool.query(sql, params)).rows[0] ?? null;

/**
 * Chạy fn trong một transaction, đặt app.nhan_vien_id = người đang đăng nhập để
 * trigger ghi người thao tác. RAISE WARNING của DB (vd. tồn kho dưới ngưỡng) được
 * gom vào req.canhBao và trả về cho giao diện trong trường `canh_bao`.
 */
export async function tx(req, fn) {
  const client = await pool.connect();
  const onNotice = (n) => {
    if (n.severity === 'WARNING') (req.canhBao ??= []).push(n.message);
  };
  client.on('notice', onNotice);
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.nhan_vien_id', $1, true)", [String(req.user.id)]);
    const c = {
      q: async (sql, params) => (await client.query(sql, params)).rows,
      q1: async (sql, params) => (await client.query(sql, params)).rows[0] ?? null,
    };
    const result = await fn(c);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.off('notice', onNotice);
    client.release();
  }
}

/** Lỗi nghiệp vụ trả về cho người dùng */
export class LoiNghiepVu extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** '' → null; giữ nguyên giá trị khác */
export const rong = (v) => (v === '' || v === undefined ? null : v);

export const laNgay = (s) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
export const laThang = (s) => (typeof s === 'string' && /^\d{4}-\d{2}$/.test(s) ? `${s}-01` : null);

/**
 * Tạo câu UPDATE chỉ với các cột có mặt trong body.
 * Trả về null nếu không có cột nào để cập nhật.
 */
export function cauUpdate(bang, cot, body, id, cotKhoa = 'id') {
  const sets = [];
  const params = [];
  for (const k of cot) {
    if (body[k] !== undefined) {
      params.push(rong(body[k]));
      sets.push(`${k} = $${params.length}`);
    }
  }
  if (!sets.length) return null;
  params.push(id);
  return { sql: `UPDATE ${bang} SET ${sets.join(', ')} WHERE ${cotKhoa} = $${params.length} RETURNING *`, params };
}
