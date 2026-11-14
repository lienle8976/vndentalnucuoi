-- =====================================================================
-- ClinicCyberDB — 00. Tạo tài khoản quản trị + database
--
-- Chạy bằng superuser (POSTGRES_USER), kết nối vào database postgres.
-- Mật khẩu KHÔNG ghi trong file: truyền qua biến psql (lấy từ .env):
--   psql -U <superuser> -d postgres \
--        -v admin_user=LienAdmin -v admin_pass='<CLINIC_DB_ADMIN_PASSWORD>' \
--        -f 00_tao_database.sql
--
-- Tên có chữ hoa nên trong SQL phải đặt trong nháy kép: "ClinicCyberDB",
-- "LienAdmin". Trong chuỗi kết nối / psql -U -d thì viết bình thường.
-- =====================================================================
\set ON_ERROR_STOP on

-- Tài khoản quản trị: chủ sở hữu database, không phải superuser của cả server
CREATE ROLE :"admin_user" WITH LOGIN PASSWORD :'admin_pass'
    NOSUPERUSER NOCREATEROLE NOCREATEDB;

-- Host online (Neon, Supabase...) chạy bằng user không phải superuser: PostgreSQL 16+
-- yêu cầu người tạo là thành viên của role mới mới đặt được làm OWNER bên dưới.
-- Với superuser ở máy local thì lệnh này vô hại.
GRANT :"admin_user" TO CURRENT_USER;

CREATE DATABASE "ClinicCyberDB"
    WITH OWNER = :"admin_user"
         ENCODING = 'UTF8';

COMMENT ON DATABASE "ClinicCyberDB"
    IS 'Hệ thống quản lý Nha khoa Nụ Cười Việt (xem .claude/docs/requirements/use-case.md)';

-- Chỉ chủ sở hữu (và superuser) được kết nối; tài khoản ứng dụng cấp sau
REVOKE CONNECT, TEMPORARY ON DATABASE "ClinicCyberDB" FROM PUBLIC;

-- Schema public do LienAdmin sở hữu → các bảng tạo ở bước sau thuộc về LienAdmin
\connect "ClinicCyberDB"
ALTER SCHEMA public OWNER TO :"admin_user";
