-- =====================================================================
-- ClinicCyberDB — 01. Lược đồ: bảng, ràng buộc, chỉ mục
-- Hệ thống quản lý Nha khoa Nụ Cười Việt
--
-- Nguồn:  .claude/docs/requirements/use-case.md  (UC01–UC46, giả định A01–A32)
--         database/quyet-dinh.md                  (QĐ1–QĐ3)
-- Chạy:   psql -U LienAdmin -d ClinicCyberDB -f 01_schema.sql
--
-- Quy ước:
--   * Tên bảng/cột tiếng Việt không dấu, snake_case.
--   * Mã trạng thái / loại là text IN HOA + CHECK (dễ thêm giá trị hơn ENUM).
--   * Tiền: domain so_tien = numeric(14,0) VND, không âm.
--   * Không xóa cứng bệnh nhân, phiếu điều trị, hóa đơn (A26): dùng cờ
--     dang_hoat_dong / trạng thái DA_HUY.
--   * Người thao tác: ứng dụng đặt trong mỗi giao dịch
--         SET LOCAL app.nhan_vien_id = '<id nhân viên đang đăng nhập>';
--     các cột tao_boi / nhan_vien_id / huy_boi... tự lấy giá trị này.
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;  -- chống chồng ca trực (EXCLUDE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- tìm tên gần đúng
CREATE EXTENSION IF NOT EXISTS unaccent;    -- tìm tên không dấu
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- băm mật khẩu (crypt / gen_salt)

CREATE DOMAIN so_tien AS numeric(14,0) CHECK (VALUE >= 0);
COMMENT ON DOMAIN so_tien IS 'Số tiền VND, không âm, không có phần lẻ';

-- Id nhân viên đang thao tác (do ứng dụng đặt bằng SET LOCAL app.nhan_vien_id)
CREATE FUNCTION nguoi_dung_hien_tai() RETURNS bigint
LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.nhan_vien_id', true), '')::bigint $$;

-- Bỏ dấu + chữ thường, dùng cho tìm kiếm tên (UC04)
CREATE FUNCTION khong_dau(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;


-- =====================================================================
-- A. TÀI KHOẢN & PHÂN QUYỀN (UC01–UC03, A03, A04)
-- =====================================================================
CREATE TABLE vai_tro (
    ma   text PRIMARY KEY CHECK (ma IN ('LE_TAN', 'BAC_SI', 'QUAN_LY')),
    ten  text NOT NULL
);
COMMENT ON TABLE vai_tro IS 'Bốn vai: Lễ tân, Bác sĩ, Quản lý (Nhân viên là vai cha trừu tượng)';

CREATE TABLE nhan_vien (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_nhan_vien       text NOT NULL UNIQUE,
    ho_ten             text NOT NULL,
    so_dien_thoai      text,
    email              text,
    ten_dang_nhap      text NOT NULL,
    mat_khau_hash      text NOT NULL,                 -- bcrypt
    doi_mat_khau_luc   timestamptz,                   -- UC02
    dang_nhap_cuoi_luc timestamptz,                   -- UC01
    ban_thoi_gian      boolean NOT NULL DEFAULT false,
    dang_hoat_dong     boolean NOT NULL DEFAULT true,
    tao_luc            timestamptz NOT NULL DEFAULT now(),
    cap_nhat_luc       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_nhan_vien_ten_dang_nhap ON nhan_vien (lower(ten_dang_nhap));
COMMENT ON TABLE nhan_vien IS 'Tài khoản nhân viên (UC01–UC03). Không xóa, chỉ ngừng hoạt động';

CREATE TABLE nhan_vien_vai_tro (
    nhan_vien_id bigint NOT NULL REFERENCES nhan_vien (id),
    vai_tro_ma   text   NOT NULL REFERENCES vai_tro (ma),
    PRIMARY KEY (nhan_vien_id, vai_tro_ma)
);
COMMENT ON TABLE nhan_vien_vai_tro IS 'Một nhân viên có thể giữ nhiều vai trò (A03)';

-- Tỷ lệ ăn chia của bác sĩ, có ngày hiệu lực để tính lại tháng cũ không bị sai (A29, UC43, UC44)
CREATE TABLE ty_le_an_chia (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    bac_si_id    bigint NOT NULL REFERENCES nhan_vien (id),
    ty_le        numeric(5,2) NOT NULL CHECK (ty_le BETWEEN 0 AND 100),   -- %
    hieu_luc_tu  date NOT NULL,
    ghi_chu      text,
    tao_boi      bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (bac_si_id, hieu_luc_tu)
);


-- =====================================================================
-- G1. DANH MỤC CHUNG (UC43)
-- =====================================================================
CREATE TABLE ghe (
    id              smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_ghe          text NOT NULL UNIQUE,
    ten             text NOT NULL,
    dang_hoat_dong  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE ghe IS 'Ghế nha. Không cố định theo bác sĩ, chọn khi đặt lịch (A07)';

CREATE TABLE gio_mo_cua (
    thu      smallint PRIMARY KEY CHECK (thu BETWEEN 1 AND 7),  -- ISO: 1 = Thứ Hai ... 7 = Chủ nhật
    gio_mo   time NOT NULL,
    gio_dong time NOT NULL,
    nghi     boolean NOT NULL DEFAULT false,
    CHECK (gio_mo < gio_dong),
    CHECK (date_part('minute', gio_mo)   IN (0, 30) AND date_part('second', gio_mo)   = 0),
    CHECK (date_part('minute', gio_dong) IN (0, 30) AND date_part('second', gio_dong) = 0)
);
COMMENT ON TABLE gio_mo_cua IS 'Giờ mở cửa theo thứ; dùng để sinh khung 30 phút (UC12, UC45.2)';

CREATE TABLE ngay_nghi (
    ngay   date PRIMARY KEY,
    ly_do  text NOT NULL
);
COMMENT ON TABLE ngay_nghi IS 'Ngày phòng khám đóng cửa (lễ, Tết): không đặt lịch, không tính công suất ghế';

CREATE TABLE ly_do_huy (
    id              smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ten             text NOT NULL UNIQUE,
    dang_hoat_dong  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE ly_do_huy IS 'Danh mục lý do hủy lịch (A12, UC45.4)';


-- =====================================================================
-- C. CA TRỰC (UC09, UC10, A09)
-- =====================================================================
CREATE TABLE ca_truc (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nhan_vien_id  bigint NOT NULL REFERENCES nhan_vien (id),
    vai_tro_ma    text   NOT NULL REFERENCES vai_tro (ma) CHECK (vai_tro_ma IN ('BAC_SI', 'LE_TAN')),
    ngay          date NOT NULL,
    gio_bat_dau   time NOT NULL,
    gio_ket_thuc  time NOT NULL,
    ten_ca        text,                     -- vd. 'Sáng', 'Chiều'
    ghi_chu       text,
    tao_boi       bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc       timestamptz NOT NULL DEFAULT now(),
    CHECK (gio_bat_dau < gio_ket_thuc),
    -- Một người không có hai ca chồng giờ nhau
    CONSTRAINT ex_ca_truc_khong_chong EXCLUDE USING gist (
        nhan_vien_id WITH =,
        tsrange(ngay + gio_bat_dau, ngay + gio_ket_thuc) WITH &&
    )
);
CREATE INDEX ix_ca_truc_ngay ON ca_truc (ngay, vai_tro_ma);
COMMENT ON TABLE ca_truc IS 'Ca trực: bác sĩ (bắt buộc để đặt lịch) và lễ tân (để chốt két theo ca)';


-- =====================================================================
-- B. BỆNH NHÂN (UC04–UC08, QĐ2, A14, A27)
-- =====================================================================
CREATE SEQUENCE seq_ma_benh_nhan;

CREATE TABLE benh_nhan (
    id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_benh_nhan             text NOT NULL UNIQUE
                             DEFAULT 'BN' || lpad(nextval('seq_ma_benh_nhan')::text, 6, '0'),
    ho_ten                   text NOT NULL,
    ngay_sinh                date NOT NULL CHECK (ngay_sinh > DATE '1900-01-01'),   -- A14
    gioi_tinh                text CHECK (gioi_tinh IN ('NAM', 'NU', 'KHAC')),
    so_dien_thoai            text NOT NULL CHECK (so_dien_thoai ~ '^0[0-9]{9,10}$'), -- KHÔNG unique (QĐ2)
    dia_chi                  text,
    nguoi_giam_ho            text,          -- điền khi dưới 15 tuổi (QĐ2)
    quan_he_giam_ho          text,
    tien_su_benh             text,
    di_ung                   text,
    ghi_chu                  text,
    -- Chuyển hồ sơ giấy (UC08, A27)
    nguon_ho_so              text NOT NULL DEFAULT 'MOI' CHECK (nguon_ho_so IN ('MOI', 'HO_SO_GIAY')),
    so_ho_so_giay            text,
    ngay_kham_gan_nhat_giay  date,
    -- Không xóa cứng (A26)
    dang_hoat_dong           boolean NOT NULL DEFAULT true,
    ly_do_ngung              text,
    tao_boi                  bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc                  timestamptz NOT NULL DEFAULT now(),
    cap_nhat_luc             timestamptz NOT NULL DEFAULT now(),
    CHECK (nguon_ho_so = 'HO_SO_GIAY' OR (so_ho_so_giay IS NULL AND ngay_kham_gan_nhat_giay IS NULL)),
    CHECK (nguoi_giam_ho IS NULL OR quan_he_giam_ho IS NOT NULL)
);
CREATE INDEX ix_benh_nhan_sdt ON benh_nhan (so_dien_thoai);
CREATE INDEX ix_benh_nhan_ten_trgm ON benh_nhan USING gin (khong_dau(ho_ten) gin_trgm_ops);
COMMENT ON TABLE benh_nhan IS 'Định danh bằng ma_benh_nhan; SĐT chỉ để tra cứu, nhiều người có thể dùng chung (QĐ2)';
COMMENT ON COLUMN benh_nhan.ngay_kham_gan_nhat_giay IS 'Ngày khám gần nhất ghi trên hồ sơ giấy, dùng cho báo cáo quá 6 tháng (A27, A31)';

CREATE TABLE tai_lieu_ho_so (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    benh_nhan_id  bigint NOT NULL REFERENCES benh_nhan (id),
    duong_dan     text NOT NULL,          -- đường dẫn file scan
    ten_file      text NOT NULL,
    mo_ta         text,
    tai_len_boi   bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tai_len_luc   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_tai_lieu_ho_so_bn ON tai_lieu_ho_so (benh_nhan_id);
COMMENT ON TABLE tai_lieu_ho_so IS 'Ảnh scan phiếu giấy cũ (UC08, không bắt buộc)';


-- =====================================================================
-- G2. DỊCH VỤ & BẢNG GIÁ (UC30, UC38, A21)
-- =====================================================================
CREATE TABLE dich_vu (
    id              int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_dich_vu      text NOT NULL UNIQUE,
    ten             text NOT NULL,
    nhom            text,
    don_vi_tinh     text NOT NULL DEFAULT 'Lần',
    la_lieu_trinh   boolean NOT NULL DEFAULT false,   -- gói liệu trình (niềng, implant)
    mo_ta           text,
    dang_hoat_dong  boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE dich_vu IS 'Danh mục dịch vụ; cũng là "việc cần làm" khi đặt lịch (A10)';

CREATE TABLE bang_gia_dich_vu (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dich_vu_id   int NOT NULL REFERENCES dich_vu (id),
    don_gia      so_tien NOT NULL,
    hieu_luc_tu  date NOT NULL,
    ghi_chu      text,
    tao_boi      bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dich_vu_id, hieu_luc_tu)
);
COMMENT ON TABLE bang_gia_dich_vu IS 'Không ghi đè: đổi giá = thêm dòng mới với ngày hiệu lực mới (A21)';


-- =====================================================================
-- G3. THUỐC, VẬT TƯ & KHO (UC22, UC26, UC39–UC42, A18, A19, A32)
-- =====================================================================
CREATE TABLE thuoc_vat_tu (
    id                int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma                text NOT NULL UNIQUE,
    ten               text NOT NULL,
    loai              text NOT NULL CHECK (loai IN ('THUOC', 'VAT_TU')),
    don_vi_tinh       text NOT NULL,
    hoat_chat         text,
    ham_luong         text,
    -- Tồn kho chỉ thay đổi qua giao_dich_kho (trigger). Cho phép âm để không chặn
    -- việc ghi phiếu khi sổ kho lệch thực tế; báo cáo sẽ hiện ra để kiểm kê.
    ton_kho           numeric(12,2) NOT NULL DEFAULT 0,
    nguong_toi_thieu  numeric(12,2) NOT NULL DEFAULT 0 CHECK (nguong_toi_thieu >= 0),
    dang_hoat_dong    boolean NOT NULL DEFAULT true
);
COMMENT ON TABLE thuoc_vat_tu IS 'Thuốc (kê và phát tại chỗ, A18) và vật tư tiêu hao (A19)';

CREATE TABLE bang_gia_thuoc (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thuoc_id     int NOT NULL REFERENCES thuoc_vat_tu (id),
    don_gia      so_tien NOT NULL,
    hieu_luc_tu  date NOT NULL,
    ghi_chu      text,
    tao_boi      bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (thuoc_id, hieu_luc_tu)
);
COMMENT ON TABLE bang_gia_thuoc IS 'Giá bán thuốc theo ngày hiệu lực, cùng nguyên tắc với bảng giá dịch vụ (A21)';

CREATE TABLE dinh_muc_vat_tu (
    dich_vu_id       int NOT NULL REFERENCES dich_vu (id),
    thuoc_vat_tu_id  int NOT NULL REFERENCES thuoc_vat_tu (id),
    so_luong         numeric(10,2) NOT NULL CHECK (so_luong > 0),
    PRIMARY KEY (dich_vu_id, thuoc_vat_tu_id)
);
COMMENT ON TABLE dinh_muc_vat_tu IS 'Định mức vật tư cho một lần làm dịch vụ; dùng để gợi ý khi hoàn tất phiếu (A19)';


-- =====================================================================
-- D. LỊCH HẸN (UC11–UC19, A05–A13)
-- =====================================================================
CREATE TABLE lich_hen (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    benh_nhan_id          bigint   NOT NULL REFERENCES benh_nhan (id),
    bac_si_id             bigint   NOT NULL REFERENCES nhan_vien (id),   -- đúng MỘT bác sĩ (QĐ1)
    ghe_id                smallint NOT NULL REFERENCES ghe (id),
    ngay                  date     NOT NULL,
    gio_bat_dau           time     NOT NULL,
    gio_ket_thuc          time     GENERATED ALWAYS AS (gio_bat_dau + interval '30 minutes') STORED,
    dich_vu_du_kien_id    int      NOT NULL REFERENCES dich_vu (id),     -- A10
    ghi_chu               text,
    nguon                 text NOT NULL DEFAULT 'DIEN_THOAI'
                          CHECK (nguon IN ('DIEN_THOAI', 'TAI_QUAY', 'VANG_LAI', 'TAI_KHAM')),
    chi_dinh_tai_kham_id  bigint,          -- FK thêm ở dưới (A17)
    trang_thai            text NOT NULL DEFAULT 'DA_DAT'
                          CHECK (trang_thai IN ('DA_DAT', 'DA_NHAC', 'DA_DEN', 'DANG_KHAM',
                                                'HOAN_THANH', 'DA_HUY', 'KHONG_DEN')),   -- A11
    -- Tiếp đón (UC18)
    den_luc               timestamptz,
    tiep_don_boi          bigint REFERENCES nhan_vien (id),
    -- Hủy lịch (UC15, A12)
    ly_do_huy_id          smallint REFERENCES ly_do_huy (id),
    ly_do_huy_ghi_chu     text,
    ben_huy               text CHECK (ben_huy IN ('BENH_NHAN', 'PHONG_KHAM')),
    huy_boi               bigint REFERENCES nhan_vien (id),
    huy_luc               timestamptz,
    tao_boi               bigint NOT NULL REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc               timestamptz NOT NULL DEFAULT now(),
    cap_nhat_luc          timestamptz NOT NULL DEFAULT now(),
    -- Một lịch = đúng một khung 30 phút, bắt đầu ở phút :00 hoặc :30 (A06)
    CONSTRAINT ck_lich_hen_khung_30 CHECK (date_part('minute', gio_bat_dau) IN (0, 30)
                                           AND date_part('second', gio_bat_dau) = 0),
    CONSTRAINT ck_lich_hen_huy CHECK (
        (trang_thai = 'DA_HUY') =
        (ly_do_huy_id IS NOT NULL AND ben_huy IS NOT NULL AND huy_boi IS NOT NULL AND huy_luc IS NOT NULL)),
    CONSTRAINT ck_lich_hen_den CHECK (
        trang_thai NOT IN ('DA_DEN', 'DANG_KHAM', 'HOAN_THANH') OR den_luc IS NOT NULL)
);
-- Không trùng ghế, không trùng bác sĩ trong cùng khung (lịch hủy / không đến thì nhả khung)
CREATE UNIQUE INDEX ux_lich_hen_ghe_khung    ON lich_hen (ghe_id, ngay, gio_bat_dau)
    WHERE trang_thai NOT IN ('DA_HUY', 'KHONG_DEN');
CREATE UNIQUE INDEX ux_lich_hen_bac_si_khung ON lich_hen (bac_si_id, ngay, gio_bat_dau)
    WHERE trang_thai NOT IN ('DA_HUY', 'KHONG_DEN');
CREATE INDEX ix_lich_hen_ngay_trang_thai ON lich_hen (ngay, trang_thai);
CREATE INDEX ix_lich_hen_benh_nhan       ON lich_hen (benh_nhan_id, ngay);
COMMENT ON TABLE lich_hen IS 'Một lịch = 1 bác sĩ + 1 ghế + 1 khung 30 phút; chỉ trong ca trực và giờ mở cửa';

CREATE TABLE lich_su_lich_hen (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lich_hen_id   bigint NOT NULL REFERENCES lich_hen (id),
    hanh_dong     text NOT NULL CHECK (hanh_dong IN ('TAO', 'DOI_LICH', 'DOI_TRANG_THAI')),
    gia_tri_cu    jsonb,
    gia_tri_moi   jsonb,
    nhan_vien_id  bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    thoi_diem     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_lich_su_lich_hen ON lich_su_lich_hen (lich_hen_id, thoi_diem);
COMMENT ON TABLE lich_su_lich_hen IS 'Nhật ký tạo / đổi lịch (UC14) / đổi trạng thái — trigger tự ghi';

CREATE TABLE nhac_lich (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lich_hen_id      bigint NOT NULL REFERENCES lich_hen (id),
    hinh_thuc        text NOT NULL CHECK (hinh_thuc IN ('GOI_DIEN', 'SMS')),
    ket_qua          text NOT NULL CHECK (ket_qua IN (
                         'XAC_NHAN', 'KHONG_NGHE_MAY', 'XIN_DOI_LICH', 'XIN_HUY', 'SAI_SO',   -- gọi điện
                         'SMS_CHO_GUI', 'SMS_DA_GUI', 'SMS_LOI')),                           -- SMS (UC17)
    so_dien_thoai    text NOT NULL,
    noi_dung         text,               -- SMS ghi tên người được hẹn (QĐ2)
    ma_tin_nhan_sms  text,               -- id trả về từ dịch vụ SMS
    loi_sms          text,
    ghi_chu          text,
    nhan_vien_id     bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    thoi_diem        timestamptz NOT NULL DEFAULT now(),
    CHECK ((hinh_thuc = 'SMS') = (ket_qua LIKE 'SMS\_%'))
);
CREATE INDEX ix_nhac_lich_lich_hen ON nhac_lich (lich_hen_id, thoi_diem);
COMMENT ON TABLE nhac_lich IS 'Kết quả gọi điện / gửi SMS nhắc lịch (UC16, UC17, A13)';


-- =====================================================================
-- E. KHÁM & ĐIỀU TRỊ (UC20–UC29, QĐ1, A15–A20, A24)
-- =====================================================================
CREATE SEQUENCE seq_ma_lieu_trinh;

CREATE TABLE lieu_trinh (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_lieu_trinh        text NOT NULL UNIQUE
                         DEFAULT 'LT' || lpad(nextval('seq_ma_lieu_trinh')::text, 6, '0'),
    benh_nhan_id         bigint NOT NULL REFERENCES benh_nhan (id),
    bac_si_phu_trach_id  bigint NOT NULL REFERENCES nhan_vien (id),   -- nhận doanh thu các đợt (A28)
    dich_vu_id           int REFERENCES dich_vu (id),                 -- loại liệu trình (niềng, implant)
    ten                  text NOT NULL,
    so_buoi_du_kien      smallint NOT NULL CHECK (so_buoi_du_kien > 0),
    gia_tron_goi         so_tien NOT NULL,                            -- chốt lúc tạo (A20)
    ngay_bat_dau         date NOT NULL DEFAULT current_date,
    ngay_ket_thuc        date,
    trang_thai           text NOT NULL DEFAULT 'DANG_THUC_HIEN'
                         CHECK (trang_thai IN ('DANG_THUC_HIEN', 'HOAN_THANH', 'DA_HUY')),
    ly_do_huy            text,
    ghi_chu              text,
    tao_boi              bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc              timestamptz NOT NULL DEFAULT now(),
    CHECK (trang_thai <> 'DA_HUY' OR ly_do_huy IS NOT NULL),
    CHECK (ngay_ket_thuc IS NULL OR ngay_ket_thuc >= ngay_bat_dau)
);
CREATE INDEX ix_lieu_trinh_benh_nhan ON lieu_trinh (benh_nhan_id);
COMMENT ON TABLE lieu_trinh IS 'Liệu trình nhiều buổi, giá trọn gói, trả theo đợt (UC24, A20)';

CREATE TABLE dot_thanh_toan (
    id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lieu_trinh_id  bigint NOT NULL REFERENCES lieu_trinh (id),
    dot_so         smallint NOT NULL CHECK (dot_so > 0),
    so_tien        so_tien NOT NULL CHECK (so_tien > 0),
    ngay_du_kien   date,
    ghi_chu        text,
    UNIQUE (lieu_trinh_id, dot_so)
);
COMMENT ON TABLE dot_thanh_toan IS 'Kế hoạch các đợt thanh toán; tổng các đợt = giá trọn gói (kiểm tra khi COMMIT)';

CREATE SEQUENCE seq_ma_phieu;

CREATE TABLE phieu_dieu_tri (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_phieu         text NOT NULL UNIQUE
                     DEFAULT 'PDT' || lpad(nextval('seq_ma_phieu')::text, 7, '0'),
    lich_hen_id      bigint NOT NULL UNIQUE REFERENCES lich_hen (id),
    -- Ba cột dưới được trigger chép từ lịch hẹn (A16); ghế/giờ xem qua lich_hen
    benh_nhan_id     bigint NOT NULL REFERENCES benh_nhan (id),
    bac_si_chinh_id  bigint NOT NULL REFERENCES nhan_vien (id),
    ngay_kham        date   NOT NULL,
    chan_doan        text,
    ghi_chu          text,
    trang_thai       text NOT NULL DEFAULT 'DANG_LAP' CHECK (trang_thai IN ('DANG_LAP', 'HOAN_TAT')),
    hoan_tat_luc     timestamptz,
    tao_boi          bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc          timestamptz NOT NULL DEFAULT now(),
    cap_nhat_luc     timestamptz NOT NULL DEFAULT now(),
    CHECK ((trang_thai = 'HOAN_TAT') = (hoan_tat_luc IS NOT NULL))
);
CREATE INDEX ix_phieu_benh_nhan ON phieu_dieu_tri (benh_nhan_id, ngay_kham);
COMMENT ON TABLE phieu_dieu_tri IS 'Phiếu điều trị điện tử, gắn đúng một lịch hẹn (UC21, A05)';

CREATE TABLE dong_dieu_tri (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phieu_dieu_tri_id    bigint NOT NULL REFERENCES phieu_dieu_tri (id),
    dich_vu_id           int    NOT NULL REFERENCES dich_vu (id),
    -- Răng FDI (11–48 vĩnh viễn, 51–85 răng sữa) hoặc mã vùng (A15)
    rang                 text   NOT NULL CHECK (rang ~ '^([1-4][1-8]|[5-8][1-5])$'
                                                OR rang IN ('HAM_TREN', 'HAM_DUOI', 'TOAN_HAM')),
    so_luong             numeric(8,2) NOT NULL DEFAULT 1 CHECK (so_luong > 0),
    -- Bác sĩ thực hiện & nhận doanh thu dòng này; mặc định = bác sĩ chính (QĐ1, UC25)
    bac_si_thuc_hien_id  bigint NOT NULL REFERENCES nhan_vien (id),
    -- Gắn liệu trình (UC23): dòng thuộc liệu trình không tính tiền theo dòng (A20)
    lieu_trinh_id        bigint REFERENCES lieu_trinh (id),
    buoi_thu             smallint CHECK (buoi_thu > 0),
    ghi_chu              text,
    tao_luc              timestamptz NOT NULL DEFAULT now(),
    cap_nhat_luc         timestamptz NOT NULL DEFAULT now(),
    CHECK ((lieu_trinh_id IS NULL) = (buoi_thu IS NULL))
);
CREATE INDEX ix_dong_dieu_tri_phieu      ON dong_dieu_tri (phieu_dieu_tri_id);
CREATE INDEX ix_dong_dieu_tri_lieu_trinh ON dong_dieu_tri (lieu_trinh_id) WHERE lieu_trinh_id IS NOT NULL;
COMMENT ON TABLE dong_dieu_tri IS 'Mỗi việc đã làm: dịch vụ + răng/vùng + bác sĩ thực hiện';

CREATE TABLE don_thuoc (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phieu_dieu_tri_id  bigint NOT NULL REFERENCES phieu_dieu_tri (id),
    thuoc_id           int    NOT NULL REFERENCES thuoc_vat_tu (id),
    lieu_dung          text   NOT NULL,                 -- vd. "Uống 1 viên x 3 lần/ngày sau ăn"
    so_luong           numeric(10,2) NOT NULL CHECK (so_luong > 0),
    ghi_chu            text,
    tao_luc            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (phieu_dieu_tri_id, thuoc_id)
);
COMMENT ON TABLE don_thuoc IS 'Thuốc kê theo lần khám (UC22); phát tại chỗ, trừ kho khi hoàn tất phiếu';

CREATE TABLE vat_tu_su_dung (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phieu_dieu_tri_id  bigint NOT NULL REFERENCES phieu_dieu_tri (id),
    thuoc_vat_tu_id    int    NOT NULL REFERENCES thuoc_vat_tu (id),
    so_luong_dinh_muc  numeric(12,2),                       -- hệ thống gợi ý
    so_luong           numeric(12,2) NOT NULL CHECK (so_luong > 0),   -- bác sĩ xác nhận
    ghi_chu            text,
    tao_luc            timestamptz NOT NULL DEFAULT now(),
    UNIQUE (phieu_dieu_tri_id, thuoc_vat_tu_id)
);
COMMENT ON TABLE vat_tu_su_dung IS 'Vật tư đã dùng cho phiếu (UC26, A19); trừ kho khi hoàn tất phiếu';

CREATE TABLE chi_dinh_tai_kham (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phieu_dieu_tri_id  bigint NOT NULL REFERENCES phieu_dieu_tri (id),
    sau_so_ngay        int  CHECK (sau_so_ngay > 0),
    ngay_du_kien       date,
    dich_vu_id         int  REFERENCES dich_vu (id),
    ghi_chu            text,
    tao_luc            timestamptz NOT NULL DEFAULT now(),
    CHECK (sau_so_ngay IS NOT NULL OR ngay_du_kien IS NOT NULL)
);
CREATE INDEX ix_chi_dinh_tai_kham_phieu ON chi_dinh_tai_kham (phieu_dieu_tri_id);
COMMENT ON TABLE chi_dinh_tai_kham IS 'Bác sĩ ghi chỉ định; lễ tân đặt lịch thật khi khách thanh toán (UC27, A17)';

ALTER TABLE lich_hen
    ADD CONSTRAINT fk_lich_hen_chi_dinh_tai_kham
    FOREIGN KEY (chi_dinh_tai_kham_id) REFERENCES chi_dinh_tai_kham (id);

CREATE TABLE lich_su_sua_phieu (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phieu_dieu_tri_id  bigint NOT NULL REFERENCES phieu_dieu_tri (id),
    bang               text   NOT NULL,     -- phieu_dieu_tri / dong_dieu_tri / don_thuoc / ...
    ban_ghi_id         bigint NOT NULL,
    hanh_dong          text   NOT NULL CHECK (hanh_dong IN ('THEM', 'SUA', 'XOA')),
    gia_tri_cu         jsonb,               -- chỉ các trường thay đổi
    gia_tri_moi        jsonb,
    nhan_vien_id       bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    thoi_diem          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_lich_su_sua_phieu ON lich_su_sua_phieu (phieu_dieu_tri_id, thoi_diem);
COMMENT ON TABLE lich_su_sua_phieu IS 'Ai sửa, lúc nào, giá trị cũ/mới (UC28, UC29, A24) — trigger tự ghi';


-- =====================================================================
-- G4. GIAO DỊCH KHO (UC40, UC41) — sổ cái, chỉ thêm
-- =====================================================================
CREATE TABLE giao_dich_kho (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    thuoc_vat_tu_id    int NOT NULL REFERENCES thuoc_vat_tu (id),
    loai               text NOT NULL CHECK (loai IN ('NHAP', 'XUAT_DIEU_TRI', 'XUAT_DON_THUOC', 'DIEU_CHINH')),
    so_luong           numeric(12,2) NOT NULL CHECK (so_luong <> 0),   -- dương: tăng tồn, âm: giảm tồn
    ton_sau            numeric(12,2),                                  -- trigger điền
    don_gia_nhap       so_tien,
    nha_cung_cap       text,
    so_lo              text,
    han_dung           date,
    phieu_dieu_tri_id  bigint REFERENCES phieu_dieu_tri (id),
    ly_do              text,
    nhan_vien_id       bigint REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    thoi_diem          timestamptz NOT NULL DEFAULT now(),
    CHECK (loai <> 'NHAP' OR so_luong > 0),
    CHECK (loai NOT IN ('XUAT_DIEU_TRI', 'XUAT_DON_THUOC') OR (so_luong < 0 AND phieu_dieu_tri_id IS NOT NULL)),
    CHECK (loai <> 'DIEU_CHINH' OR ly_do IS NOT NULL)
);
CREATE INDEX ix_giao_dich_kho ON giao_dich_kho (thuoc_vat_tu_id, thoi_diem);
COMMENT ON TABLE giao_dich_kho IS 'Nhập kho, xuất theo phiếu, điều chỉnh kiểm kê. Không sửa/xóa';


-- =====================================================================
-- F. THANH TOÁN (UC31–UC37, QĐ3, A20–A25)
-- =====================================================================
CREATE SEQUENCE seq_ma_hoa_don;

CREATE TABLE hoa_don (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_hoa_don         text NOT NULL UNIQUE
                       DEFAULT 'HD' || lpad(nextval('seq_ma_hoa_don')::text, 7, '0'),
    loai               text NOT NULL CHECK (loai IN ('LUOT_KHAM', 'DOT_LIEU_TRINH')),
    benh_nhan_id       bigint NOT NULL REFERENCES benh_nhan (id),
    phieu_dieu_tri_id  bigint REFERENCES phieu_dieu_tri (id),     -- UC31
    dot_thanh_toan_id  bigint REFERENCES dot_thanh_toan (id),     -- UC33
    ngay_lap           date NOT NULL DEFAULT current_date,
    -- Giảm giá ở tổng, đúng như khách thấy (QĐ3)
    giam_gia_tong      so_tien NOT NULL DEFAULT 0,
    ly_do_giam_gia     text,
    giam_gia_boi       bigint REFERENCES nhan_vien (id),
    -- tong_tien = Σ dong_hoa_don.thanh_tien (trigger giữ bất biến)
    tong_tien          so_tien NOT NULL DEFAULT 0,
    da_thu             so_tien NOT NULL DEFAULT 0,               -- chỉ cập nhật qua thanh_toan
    con_no             numeric(14,0) GENERATED ALWAYS AS (tong_tien - da_thu) STORED,
    trang_thai         text NOT NULL DEFAULT 'NHAP' CHECK (trang_thai IN ('NHAP', 'DA_CHOT', 'DA_HUY')),
    chot_luc           timestamptz,
    chot_boi           bigint REFERENCES nhan_vien (id),
    -- Hủy (A23): có lý do, chỉ khi chưa thu đồng nào
    ly_do_huy          text,
    huy_boi            bigint REFERENCES nhan_vien (id),
    huy_luc            timestamptz,
    ghi_chu            text,
    tao_boi            bigint NOT NULL REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tao_luc            timestamptz NOT NULL DEFAULT now(),
    CHECK ((loai = 'LUOT_KHAM'      AND phieu_dieu_tri_id IS NOT NULL AND dot_thanh_toan_id IS NULL)
        OR (loai = 'DOT_LIEU_TRINH' AND dot_thanh_toan_id IS NOT NULL AND phieu_dieu_tri_id IS NULL)),
    CHECK (da_thu <= tong_tien),                                              -- A22
    CHECK (giam_gia_tong = 0 OR (ly_do_giam_gia IS NOT NULL AND giam_gia_boi IS NOT NULL)),
    CHECK (trang_thai = 'NHAP' OR (chot_luc IS NOT NULL) OR trang_thai = 'DA_HUY'),
    CHECK (trang_thai <> 'DA_HUY' OR (ly_do_huy IS NOT NULL AND huy_boi IS NOT NULL
                                      AND huy_luc IS NOT NULL AND da_thu = 0))
);
-- Mỗi phiếu / mỗi đợt chỉ có một hóa đơn còn hiệu lực
CREATE UNIQUE INDEX ux_hoa_don_phieu ON hoa_don (phieu_dieu_tri_id) WHERE trang_thai <> 'DA_HUY';
CREATE UNIQUE INDEX ux_hoa_don_dot   ON hoa_don (dot_thanh_toan_id) WHERE trang_thai <> 'DA_HUY';
CREATE INDEX ix_hoa_don_benh_nhan    ON hoa_don (benh_nhan_id, ngay_lap);
CREATE INDEX ix_hoa_don_con_no       ON hoa_don (benh_nhan_id) WHERE trang_thai = 'DA_CHOT' AND con_no > 0;
COMMENT ON TABLE hoa_don IS 'NHAP → DA_CHOT (khóa giá, phân bổ giảm giá) → thu tiền. Không xóa; chỉ hủy khi chưa thu';

CREATE TABLE dong_hoa_don (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hoa_don_id           bigint NOT NULL REFERENCES hoa_don (id),
    loai_dong            text   NOT NULL CHECK (loai_dong IN ('DICH_VU', 'THUOC', 'DOT_LIEU_TRINH')),
    dong_dieu_tri_id     bigint REFERENCES dong_dieu_tri (id),
    don_thuoc_id         bigint REFERENCES don_thuoc (id),
    dot_thanh_toan_id    bigint REFERENCES dot_thanh_toan (id),
    mo_ta                text   NOT NULL,
    bac_si_id            bigint REFERENCES nhan_vien (id),      -- bác sĩ được tính doanh thu (QĐ1, A28)
    ngay_thuc_hien       date   NOT NULL,                       -- doanh thu tính theo ngày làm (A28)
    don_gia              so_tien NOT NULL,                      -- chép từ bảng giá, không đổi (A21)
    so_luong             numeric(10,2) NOT NULL DEFAULT 1 CHECK (so_luong > 0),
    giam_gia_dong        so_tien NOT NULL DEFAULT 0,            -- lễ tân nhập (QĐ3)
    ly_do_giam_gia_dong  text,
    giam_gia_dong_boi    bigint REFERENCES nhan_vien (id),
    giam_gia_phan_bo     so_tien NOT NULL DEFAULT 0,            -- hệ thống tính khi chốt (QĐ3)
    thanh_tien           numeric(14,0) GENERATED ALWAYS AS
                         (round(don_gia * so_luong) - giam_gia_dong - giam_gia_phan_bo) STORED,
    CHECK (round(don_gia * so_luong) - giam_gia_dong - giam_gia_phan_bo >= 0),
    CHECK (giam_gia_dong = 0 OR (ly_do_giam_gia_dong IS NOT NULL AND giam_gia_dong_boi IS NOT NULL)),
    CHECK ((loai_dong = 'DICH_VU'        AND dong_dieu_tri_id  IS NOT NULL AND don_thuoc_id IS NULL AND dot_thanh_toan_id IS NULL)
        OR (loai_dong = 'THUOC'          AND don_thuoc_id      IS NOT NULL AND dong_dieu_tri_id IS NULL AND dot_thanh_toan_id IS NULL)
        OR (loai_dong = 'DOT_LIEU_TRINH' AND dot_thanh_toan_id IS NOT NULL AND dong_dieu_tri_id IS NULL AND don_thuoc_id IS NULL))
);
CREATE INDEX ix_dong_hoa_don_hoa_don ON dong_hoa_don (hoa_don_id);
CREATE INDEX ix_dong_hoa_don_bac_si  ON dong_hoa_don (bac_si_id, ngay_thuc_hien);
COMMENT ON TABLE dong_hoa_don IS 'thanh_tien = don_gia × so_luong − giam_gia_dong − giam_gia_phan_bo (QĐ3)';

CREATE SEQUENCE seq_ma_phieu_thu;

CREATE TABLE thanh_toan (
    id                      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ma_phieu_thu            text NOT NULL UNIQUE
                            DEFAULT 'PT' || lpad(nextval('seq_ma_phieu_thu')::text, 7, '0'),
    hoa_don_id              bigint NOT NULL REFERENCES hoa_don (id),   -- đúng MỘT hóa đơn (A22)
    so_tien                 so_tien NOT NULL CHECK (so_tien > 0),
    hinh_thuc               text NOT NULL CHECK (hinh_thuc IN ('TIEN_MAT', 'CHUYEN_KHOAN')),
    ma_giao_dich_ngan_hang  text,
    nhan_vien_id            bigint NOT NULL REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    ca_truc_id              bigint NOT NULL REFERENCES ca_truc (id),   -- ca lễ tân để chốt két (A25)
    thoi_diem               timestamptz NOT NULL DEFAULT now(),
    ghi_chu                 text
);
CREATE INDEX ix_thanh_toan_hoa_don ON thanh_toan (hoa_don_id);
CREATE INDEX ix_thanh_toan_ca      ON thanh_toan (ca_truc_id, hinh_thuc);
CREATE INDEX ix_thanh_toan_ngay    ON thanh_toan (thoi_diem);
COMMENT ON TABLE thanh_toan IS 'Mỗi lần thu tiền (UC34). Không sửa/xóa; không vượt số còn nợ';

CREATE TABLE chot_ket (
    id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ca_truc_id               bigint NOT NULL UNIQUE REFERENCES ca_truc (id),
    nhan_vien_id             bigint NOT NULL REFERENCES nhan_vien (id) DEFAULT nguoi_dung_hien_tai(),
    tien_dau_ca              so_tien NOT NULL DEFAULT 0,     -- tiền lẻ để sẵn trong két
    tien_mat_thu_trong_ca    so_tien NOT NULL DEFAULT 0,     -- trigger tính
    tien_mat_dem_duoc        so_tien NOT NULL,
    chenh_lech               numeric(14,0) GENERATED ALWAYS AS
                             (tien_mat_dem_duoc - tien_dau_ca - tien_mat_thu_trong_ca) STORED,
    giai_trinh               text,
    tong_chuyen_khoan        so_tien NOT NULL DEFAULT 0,     -- trigger tính, để đối chiếu sao kê
    so_giao_dich_chuyen_khoan int NOT NULL DEFAULT 0,
    chot_luc                 timestamptz NOT NULL DEFAULT now(),
    CHECK (tien_mat_dem_duoc = tien_dau_ca + tien_mat_thu_trong_ca OR giai_trinh IS NOT NULL)
);
COMMENT ON TABLE chot_ket IS 'Chốt két theo ca lễ tân; chỉ đối soát tiền mặt (UC37, A25). Sau khi chốt, ca bị khóa';

COMMIT;
