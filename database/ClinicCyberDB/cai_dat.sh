#!/usr/bin/env bash
# =====================================================================
# Cài ClinicCyberDB vào container PostgreSQL (phong_kham_db).
# Chạy từ thư mục gốc dự án (Git Bash / Linux / macOS):
#     bash database/ClinicCyberDB/cai_dat.sh            # cài mới
#     bash database/ClinicCyberDB/cai_dat.sh --lam-lai  # XÓA database + user cũ rồi cài lại
#
# Đọc từ .env: POSTGRES_USER (superuser), CLINIC_DB_ADMIN_USER, CLINIC_DB_ADMIN_PASSWORD
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")/../.."

doc_env() { grep -E "^$1=" .env | head -n1 | cut -d= -f2- | tr -d '\r'; }

CONTAINER=phong_kham_db
DIR=database/ClinicCyberDB
DB=ClinicCyberDB
PG_USER=$(doc_env POSTGRES_USER)
ADMIN_USER=$(doc_env CLINIC_DB_ADMIN_USER)
ADMIN_PASS=$(doc_env CLINIC_DB_ADMIN_PASSWORD)

if [[ -z "$PG_USER" || -z "$ADMIN_USER" || -z "$ADMIN_PASS" ]]; then
    echo "Thiếu POSTGRES_USER / CLINIC_DB_ADMIN_USER / CLINIC_DB_ADMIN_PASSWORD trong .env" >&2
    exit 1
fi

# Superuser qua socket trong container
psql_sa() { docker exec -i "$CONTAINER" psql -q -v ON_ERROR_STOP=1 -U "$PG_USER" "$@"; }
# Tài khoản admin của DB, qua TCP để kiểm tra luôn mật khẩu
psql_admin() {
    docker exec -i -e PGPASSWORD="$ADMIN_PASS" "$CONTAINER" \
        psql -q -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$ADMIN_USER" -d "$DB" "$@"
}

if [[ "${1:-}" == "--lam-lai" ]]; then
    echo ">> Xóa database \"$DB\" và user \"$ADMIN_USER\" cũ"
    psql_sa -d postgres -v db="$DB" -v u="$ADMIN_USER" <<'SQL'
DROP DATABASE IF EXISTS :"db" WITH (FORCE);
DROP ROLE IF EXISTS :"u";
SQL
fi

echo ">> 00 Tạo user $ADMIN_USER + database $DB"
psql_sa -d postgres -v admin_user="$ADMIN_USER" -v admin_pass="$ADMIN_PASS" < "$DIR/00_tao_database.sql"

for f in 01_schema 02_trigger_ham 03_view_bao_cao 04_du_lieu_mau; do
    echo ">> $f"
    psql_admin < "$DIR/$f.sql"
done

echo ">> Xong. Kiểm tra nhanh:"
psql_admin -c "SELECT count(*) AS so_bang FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';"
