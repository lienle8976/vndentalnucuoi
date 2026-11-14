#!/usr/bin/env bash
# =====================================================================
# Triển khai ClinicCyberDB lên PostgreSQL online (Neon, Supabase, ...).
# Chạy từ thư mục gốc dự án (Git Bash / Linux / macOS):
#     bash database/ClinicCyberDB/trien_khai_online.sh            # cài mới
#     bash database/ClinicCyberDB/trien_khai_online.sh --lam-lai  # XÓA database + user trên host rồi cài lại
#
# Đọc từ .env:
#   CLINIC_PROD_OWNER_URL       chuỗi kết nối tài khoản chủ project trên host
#                               (cần quyền CREATEROLE + CREATEDB, vd. neondb_owner)
#   CLINIC_PROD_ADMIN_PASSWORD  mật khẩu đặt cho LienAdmin trên host
#   CLINIC_DB_ADMIN_USER        tên user quản trị (LienAdmin)
#
# Dùng psql có sẵn trong container phong_kham_db (không cần cài psql trên máy).
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

doc_env() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- | tr -d '\r"'; }

CONTAINER=phong_kham_db
DIR=database/ClinicCyberDB
DB=ClinicCyberDB
OWNER_URL=$(doc_env CLINIC_PROD_OWNER_URL)
ADMIN_USER=$(doc_env CLINIC_DB_ADMIN_USER)
ADMIN_PASS=$(doc_env CLINIC_PROD_ADMIN_PASSWORD)

if [[ -z "$OWNER_URL" || -z "$ADMIN_USER" || -z "$ADMIN_PASS" ]]; then
    echo "Thiếu CLINIC_PROD_OWNER_URL / CLINIC_PROD_ADMIN_PASSWORD / CLINIC_DB_ADMIN_USER trong .env" >&2
    exit 1
fi

# postgresql://user:pass@host[:port]/db?params → lấy host[:port]
HOST=$(sed -E 's#^[a-z]+://[^@]+@([^/?]+).*#\1#' <<<"$OWNER_URL")

psql_owner() { docker exec -i "$CONTAINER" psql -q -v ON_ERROR_STOP=1 "$OWNER_URL" "$@"; }
psql_admin() {
    docker exec -i -e PGPASSWORD="$ADMIN_PASS" "$CONTAINER" \
        psql -q -v ON_ERROR_STOP=1 "postgresql://$ADMIN_USER@$HOST/$DB?sslmode=require" "$@"
}

echo ">> Host: $HOST"

if [[ "${1:-}" == "--lam-lai" ]]; then
    echo ">> Xóa database \"$DB\" và user \"$ADMIN_USER\" cũ trên host"
    psql_owner -v db="$DB" -v u="$ADMIN_USER" <<'SQL'
DROP DATABASE IF EXISTS :"db" WITH (FORCE);
DROP ROLE IF EXISTS :"u";
SQL
fi

echo ">> 00 Tạo user $ADMIN_USER + database $DB"
psql_owner -v admin_user="$ADMIN_USER" -v admin_pass="$ADMIN_PASS" < "$DIR/00_tao_database.sql"

# Host online thường dùng UTC; đặt múi giờ mặc định cho database (current_date, giờ khám...)
psql_admin -c "ALTER DATABASE \"$DB\" SET timezone TO 'Asia/Ho_Chi_Minh';"

for f in 01_schema 02_trigger_ham 03_view_bao_cao 04_du_lieu_mau; do
    echo ">> $f"
    psql_admin < "$DIR/$f.sql"
done

echo ">> Xong. Kiểm tra nhanh:"
psql_admin -c "SELECT current_database() AS db, current_user AS usr, current_setting('TimeZone') AS tz,
    (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS so_bang,
    (SELECT count(*) FROM nhan_vien) AS nhan_vien, (SELECT count(*) FROM benh_nhan) AS benh_nhan;"
