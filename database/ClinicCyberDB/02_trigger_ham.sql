-- =====================================================================
-- ClinicCyberDB — 02. Trigger giữ luật nghiệp vụ + hàm nghiệp vụ
-- Chạy sau 01_schema.sql
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

-- =====================================================================
-- 0. TIỆN ÍCH CHUNG
-- =====================================================================

-- Tự cập nhật cột cap_nhat_luc
CREATE FUNCTION tg_cap_nhat_luc() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.cap_nhat_luc := now();
    RETURN NEW;
END $$;

CREATE TRIGGER trg_nhan_vien_cap_nhat     BEFORE UPDATE ON nhan_vien      FOR EACH ROW EXECUTE FUNCTION tg_cap_nhat_luc();
CREATE TRIGGER trg_benh_nhan_cap_nhat     BEFORE UPDATE ON benh_nhan      FOR EACH ROW EXECUTE FUNCTION tg_cap_nhat_luc();
CREATE TRIGGER trg_lich_hen_cap_nhat      BEFORE UPDATE ON lich_hen       FOR EACH ROW EXECUTE FUNCTION tg_cap_nhat_luc();
CREATE TRIGGER trg_phieu_cap_nhat         BEFORE UPDATE ON phieu_dieu_tri FOR EACH ROW EXECUTE FUNCTION tg_cap_nhat_luc();
CREATE TRIGGER trg_dong_dieu_tri_cap_nhat BEFORE UPDATE ON dong_dieu_tri  FOR EACH ROW EXECUTE FUNCTION tg_cap_nhat_luc();

-- Bảng chỉ được thêm (sổ cái, nhật ký)
CREATE FUNCTION tg_chi_duoc_them() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bảng % chỉ được thêm, không được sửa hoặc xóa', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_giao_dich_kho_khoa     BEFORE UPDATE OR DELETE ON giao_dich_kho     FOR EACH ROW EXECUTE FUNCTION tg_chi_duoc_them();
CREATE TRIGGER trg_thanh_toan_khoa        BEFORE UPDATE OR DELETE ON thanh_toan        FOR EACH ROW EXECUTE FUNCTION tg_chi_duoc_them();
CREATE TRIGGER trg_chot_ket_khoa          BEFORE UPDATE OR DELETE ON chot_ket          FOR EACH ROW EXECUTE FUNCTION tg_chi_duoc_them();
CREATE TRIGGER trg_lich_su_lich_hen_khoa  BEFORE UPDATE OR DELETE ON lich_su_lich_hen  FOR EACH ROW EXECUTE FUNCTION tg_chi_duoc_them();
CREATE TRIGGER trg_lich_su_sua_phieu_khoa BEFORE UPDATE OR DELETE ON lich_su_sua_phieu FOR EACH ROW EXECUTE FUNCTION tg_chi_duoc_them();

-- Không xóa cứng (A23, A26)
CREATE FUNCTION tg_khong_xoa_cung() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Không xóa cứng bảng % (giữ hồ sơ tối thiểu 5 năm): hãy đánh dấu ngừng hoạt động / hủy', TG_TABLE_NAME;
END $$;

CREATE TRIGGER trg_benh_nhan_khong_xoa BEFORE DELETE ON benh_nhan      FOR EACH ROW EXECUTE FUNCTION tg_khong_xoa_cung();
CREATE TRIGGER trg_nhan_vien_khong_xoa BEFORE DELETE ON nhan_vien      FOR EACH ROW EXECUTE FUNCTION tg_khong_xoa_cung();
CREATE TRIGGER trg_lich_hen_khong_xoa  BEFORE DELETE ON lich_hen       FOR EACH ROW EXECUTE FUNCTION tg_khong_xoa_cung();
CREATE TRIGGER trg_phieu_khong_xoa     BEFORE DELETE ON phieu_dieu_tri FOR EACH ROW EXECUTE FUNCTION tg_khong_xoa_cung();
CREATE TRIGGER trg_hoa_don_khong_xoa   BEFORE DELETE ON hoa_don        FOR EACH ROW EXECUTE FUNCTION tg_khong_xoa_cung();
CREATE TRIGGER trg_lieu_trinh_khong_xoa BEFORE DELETE ON lieu_trinh    FOR EACH ROW EXECUTE FUNCTION tg_khong_xoa_cung();

-- Nhân viên có vai trò này và đang hoạt động?
CREATE FUNCTION co_vai_tro(p_nhan_vien_id bigint, p_vai_tro text) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM nhan_vien_vai_tro r JOIN nhan_vien n ON n.id = r.nhan_vien_id
        WHERE r.nhan_vien_id = p_nhan_vien_id AND r.vai_tro_ma = p_vai_tro AND n.dang_hoat_dong)
$$;


-- =====================================================================
-- 1. BẢNG GIÁ: không ghi đè (A21)
-- =====================================================================
CREATE FUNCTION tg_bao_ve_bang_gia() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (to_jsonb(NEW) - 'ghi_chu') IS DISTINCT FROM (to_jsonb(OLD) - 'ghi_chu') THEN
            RAISE EXCEPTION 'Không sửa giá đã có. Hãy thêm giá mới với ngày hiệu lực mới (A21)';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD.hieu_luc_tu <= current_date THEN
        RAISE EXCEPTION 'Không xóa giá đã có hiệu lực (từ %)', OLD.hieu_luc_tu;
    END IF;
    RETURN OLD;
END $$;

CREATE TRIGGER trg_bang_gia_dich_vu_bao_ve BEFORE UPDATE OR DELETE ON bang_gia_dich_vu FOR EACH ROW EXECUTE FUNCTION tg_bao_ve_bang_gia();
CREATE TRIGGER trg_bang_gia_thuoc_bao_ve   BEFORE UPDATE OR DELETE ON bang_gia_thuoc   FOR EACH ROW EXECUTE FUNCTION tg_bao_ve_bang_gia();

-- bang_gia_thuoc / don_thuoc chỉ nhận mặt hàng loại THUOC
CREATE FUNCTION tg_phai_la_thuoc() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM thuoc_vat_tu WHERE id = NEW.thuoc_id AND loai = 'THUOC') THEN
        RAISE EXCEPTION 'Mặt hàng % không phải thuốc', NEW.thuoc_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_bang_gia_thuoc_loai BEFORE INSERT OR UPDATE ON bang_gia_thuoc FOR EACH ROW EXECUTE FUNCTION tg_phai_la_thuoc();
CREATE TRIGGER trg_don_thuoc_loai      BEFORE INSERT OR UPDATE ON don_thuoc      FOR EACH ROW EXECUTE FUNCTION tg_phai_la_thuoc();

-- Giá có hiệu lực vào một ngày
CREATE FUNCTION gia_dich_vu(p_dich_vu_id int, p_ngay date DEFAULT current_date) RETURNS numeric
LANGUAGE sql STABLE AS $$
    SELECT don_gia FROM bang_gia_dich_vu
    WHERE dich_vu_id = p_dich_vu_id AND hieu_luc_tu <= p_ngay
    ORDER BY hieu_luc_tu DESC LIMIT 1
$$;

CREATE FUNCTION gia_thuoc(p_thuoc_id int, p_ngay date DEFAULT current_date) RETURNS numeric
LANGUAGE sql STABLE AS $$
    SELECT don_gia FROM bang_gia_thuoc
    WHERE thuoc_id = p_thuoc_id AND hieu_luc_tu <= p_ngay
    ORDER BY hieu_luc_tu DESC LIMIT 1
$$;


-- =====================================================================
-- 2. KHO: tồn kho chỉ đổi qua giao_dich_kho
-- =====================================================================
CREATE FUNCTION tg_giao_dich_kho_cap_nhat_ton() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE thuoc_vat_tu SET ton_kho = ton_kho + NEW.so_luong
    WHERE id = NEW.thuoc_vat_tu_id
    RETURNING ton_kho INTO NEW.ton_sau;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_giao_dich_kho_ton BEFORE INSERT ON giao_dich_kho
    FOR EACH ROW EXECUTE FUNCTION tg_giao_dich_kho_cap_nhat_ton();

CREATE FUNCTION tg_khoa_ton_kho() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.ton_kho IS DISTINCT FROM OLD.ton_kho AND pg_trigger_depth() < 2 THEN
        RAISE EXCEPTION 'Tồn kho chỉ thay đổi qua bảng giao_dich_kho (nhập / xuất / điều chỉnh kiểm kê)';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_thuoc_vat_tu_khoa_ton BEFORE UPDATE ON thuoc_vat_tu
    FOR EACH ROW EXECUTE FUNCTION tg_khoa_ton_kho();

-- Kiểm kê (UC41): nhập số đếm thực tế → hệ thống ghi giao dịch điều chỉnh phần chênh
CREATE FUNCTION kiem_ke(p_thuoc_vat_tu_id int, p_ton_thuc_te numeric, p_ly_do text DEFAULT 'Kiểm kê')
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE
    v_ton numeric;
BEGIN
    SELECT ton_kho INTO v_ton FROM thuoc_vat_tu WHERE id = p_thuoc_vat_tu_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có mặt hàng %', p_thuoc_vat_tu_id; END IF;
    IF p_ton_thuc_te <> v_ton THEN
        INSERT INTO giao_dich_kho (thuoc_vat_tu_id, loai, so_luong, ly_do)
        VALUES (p_thuoc_vat_tu_id, 'DIEU_CHINH', p_ton_thuc_te - v_ton,
                p_ly_do || format(' (sổ: %s, đếm: %s)', v_ton, p_ton_thuc_te));
    END IF;
    RETURN p_ton_thuc_te - v_ton;   -- chênh lệch
END $$;


-- =====================================================================
-- 3. CA TRỰC (UC09)
-- =====================================================================
CREATE FUNCTION tg_ca_truc_kiem_tra() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    -- Kiểm tra vai trò khi thêm/sửa ca
    IF TG_OP <> 'DELETE' AND NOT co_vai_tro(NEW.nhan_vien_id, NEW.vai_tro_ma) THEN
        RAISE EXCEPTION 'Nhân viên % không có vai trò % (hoặc đã ngừng hoạt động)', NEW.nhan_vien_id, NEW.vai_tro_ma;
    END IF;
    -- Sửa/xóa ca của bác sĩ không được để lịch hẹn nằm ngoài ca
    IF TG_OP <> 'INSERT' AND OLD.vai_tro_ma = 'BAC_SI' THEN
        IF EXISTS (
            SELECT 1 FROM lich_hen l
            WHERE l.bac_si_id = OLD.nhan_vien_id AND l.ngay = OLD.ngay
              AND l.trang_thai IN ('DA_DAT', 'DA_NHAC', 'DA_DEN', 'DANG_KHAM')
              AND NOT EXISTS (
                  SELECT 1 FROM ca_truc c
                  WHERE c.nhan_vien_id = l.bac_si_id AND c.vai_tro_ma = 'BAC_SI' AND c.ngay = l.ngay
                    AND l.gio_bat_dau >= c.gio_bat_dau AND l.gio_ket_thuc <= c.gio_ket_thuc))
        THEN
            RAISE EXCEPTION 'Còn lịch hẹn của bác sĩ ngày % nằm ngoài ca sau khi đổi. Hãy đổi/hủy các lịch đó trước', OLD.ngay;
        END IF;
    END IF;
    -- Không xóa/sửa ca lễ tân đã có tiền thu
    IF TG_OP <> 'INSERT' AND OLD.vai_tro_ma = 'LE_TAN'
       AND EXISTS (SELECT 1 FROM thanh_toan WHERE ca_truc_id = OLD.id)
       AND (TG_OP = 'DELETE' OR NEW.nhan_vien_id <> OLD.nhan_vien_id OR NEW.ngay <> OLD.ngay) THEN
        RAISE EXCEPTION 'Ca lễ tân % đã có phiếu thu, không xóa/chuyển được', OLD.id;
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_ca_truc_kiem_tra AFTER INSERT OR UPDATE OR DELETE ON ca_truc
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tg_ca_truc_kiem_tra();


-- =====================================================================
-- 4. LỊCH HẸN (UC12–UC19)
-- =====================================================================

-- Khung đặt lịch hợp lệ: bác sĩ, ghế, giờ mở cửa, ca trực (UC12, UC13)
CREATE FUNCTION kiem_tra_khung_dat_lich(p_bac_si_id bigint, p_ghe_id smallint, p_ngay date, p_gio time)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_gio_kt time := p_gio + interval '30 minutes';
BEGIN
    IF NOT co_vai_tro(p_bac_si_id, 'BAC_SI') THEN
        RAISE EXCEPTION 'Nhân viên % không phải bác sĩ đang hoạt động', p_bac_si_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM ghe WHERE id = p_ghe_id AND dang_hoat_dong) THEN
        RAISE EXCEPTION 'Ghế % không tồn tại hoặc ngừng hoạt động', p_ghe_id;
    END IF;
    IF EXISTS (SELECT 1 FROM ngay_nghi WHERE ngay = p_ngay) THEN
        RAISE EXCEPTION 'Phòng khám nghỉ ngày %', p_ngay;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM gio_mo_cua g
        WHERE g.thu = extract(isodow FROM p_ngay) AND NOT g.nghi
          AND p_gio >= g.gio_mo AND v_gio_kt <= g.gio_dong) THEN
        RAISE EXCEPTION 'Khung % ngày % nằm ngoài giờ mở cửa', p_gio, p_ngay;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM ca_truc c
        WHERE c.nhan_vien_id = p_bac_si_id AND c.vai_tro_ma = 'BAC_SI' AND c.ngay = p_ngay
          AND p_gio >= c.gio_bat_dau AND v_gio_kt <= c.gio_ket_thuc) THEN
        RAISE EXCEPTION 'Bác sĩ % không có ca trực bao trùm khung % ngày %', p_bac_si_id, p_gio, p_ngay;
    END IF;
END $$;

CREATE FUNCTION tg_lich_hen_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_hop_le boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.trang_thai NOT IN ('DA_DAT', 'DA_DEN') THEN
            RAISE EXCEPTION 'Lịch mới chỉ ở trạng thái DA_DAT, hoặc DA_DEN với khách vãng lai (A05)';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM benh_nhan WHERE id = NEW.benh_nhan_id AND dang_hoat_dong) THEN
            RAISE EXCEPTION 'Bệnh nhân % không tồn tại hoặc đã ngừng hoạt động', NEW.benh_nhan_id;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM dich_vu WHERE id = NEW.dich_vu_du_kien_id AND dang_hoat_dong) THEN
            RAISE EXCEPTION 'Dịch vụ % không còn hoạt động', NEW.dich_vu_du_kien_id;
        END IF;
        PERFORM kiem_tra_khung_dat_lich(NEW.bac_si_id, NEW.ghe_id, NEW.ngay, NEW.gio_bat_dau);
        IF NEW.trang_thai = 'DA_DEN' THEN
            NEW.den_luc      := coalesce(NEW.den_luc, now());
            NEW.tiep_don_boi := coalesce(NEW.tiep_don_boi, nguoi_dung_hien_tai());
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF NEW.benh_nhan_id <> OLD.benh_nhan_id THEN
        RAISE EXCEPTION 'Không đổi bệnh nhân của lịch hẹn; hãy hủy và đặt lịch mới';
    END IF;

    -- Đổi lịch (UC14): chỉ khi chưa đến
    IF (NEW.bac_si_id, NEW.ghe_id, NEW.ngay, NEW.gio_bat_dau)
       IS DISTINCT FROM (OLD.bac_si_id, OLD.ghe_id, OLD.ngay, OLD.gio_bat_dau) THEN
        IF OLD.trang_thai NOT IN ('DA_DAT', 'DA_NHAC') THEN
            RAISE EXCEPTION 'Chỉ đổi lịch khi lịch đang ở trạng thái Đã đặt / Đã nhắc (hiện: %)', OLD.trang_thai;
        END IF;
        PERFORM kiem_tra_khung_dat_lich(NEW.bac_si_id, NEW.ghe_id, NEW.ngay, NEW.gio_bat_dau);
        -- Đổi ngày/giờ thì phải nhắc lại
        IF (NEW.ngay, NEW.gio_bat_dau) IS DISTINCT FROM (OLD.ngay, OLD.gio_bat_dau)
           AND NEW.trang_thai = 'DA_NHAC' THEN
            NEW.trang_thai := 'DA_DAT';
        END IF;
    END IF;

    -- Chuyển trạng thái (A11)
    IF NEW.trang_thai <> OLD.trang_thai THEN
        v_hop_le := CASE OLD.trang_thai
            WHEN 'DA_DAT'    THEN NEW.trang_thai IN ('DA_NHAC', 'DA_DEN', 'DA_HUY', 'KHONG_DEN')
            WHEN 'DA_NHAC'   THEN NEW.trang_thai IN ('DA_DAT', 'DA_DEN', 'DA_HUY', 'KHONG_DEN')
            -- Hai bước sau chỉ do trigger của phiếu điều trị thực hiện
            WHEN 'DA_DEN'    THEN NEW.trang_thai = 'DANG_KHAM'  AND pg_trigger_depth() > 1
            WHEN 'DANG_KHAM' THEN NEW.trang_thai = 'HOAN_THANH' AND pg_trigger_depth() > 1
            ELSE false
        END;
        IF NOT v_hop_le THEN
            RAISE EXCEPTION 'Không chuyển được lịch hẹn từ % sang %', OLD.trang_thai, NEW.trang_thai;
        END IF;

        IF NEW.trang_thai = 'DA_HUY' THEN            -- UC15, A12
            NEW.huy_luc := coalesce(NEW.huy_luc, now());
            NEW.huy_boi := coalesce(NEW.huy_boi, nguoi_dung_hien_tai());
        ELSIF NEW.trang_thai = 'DA_DEN' THEN         -- UC18
            NEW.den_luc      := coalesce(NEW.den_luc, now());
            NEW.tiep_don_boi := coalesce(NEW.tiep_don_boi, nguoi_dung_hien_tai());
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_lich_hen_truoc BEFORE INSERT OR UPDATE ON lich_hen
    FOR EACH ROW EXECUTE FUNCTION tg_lich_hen_truoc();

-- Nhật ký lịch hẹn
CREATE FUNCTION tg_lich_hen_nhat_ky() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO lich_su_lich_hen (lich_hen_id, hanh_dong, gia_tri_moi)
        VALUES (NEW.id, 'TAO', jsonb_build_object(
            'bac_si_id', NEW.bac_si_id, 'ghe_id', NEW.ghe_id, 'ngay', NEW.ngay,
            'gio_bat_dau', NEW.gio_bat_dau, 'trang_thai', NEW.trang_thai));
        RETURN NULL;
    END IF;
    IF (NEW.bac_si_id, NEW.ghe_id, NEW.ngay, NEW.gio_bat_dau)
       IS DISTINCT FROM (OLD.bac_si_id, OLD.ghe_id, OLD.ngay, OLD.gio_bat_dau) THEN
        INSERT INTO lich_su_lich_hen (lich_hen_id, hanh_dong, gia_tri_cu, gia_tri_moi)
        VALUES (NEW.id, 'DOI_LICH',
            jsonb_build_object('bac_si_id', OLD.bac_si_id, 'ghe_id', OLD.ghe_id, 'ngay', OLD.ngay, 'gio_bat_dau', OLD.gio_bat_dau),
            jsonb_build_object('bac_si_id', NEW.bac_si_id, 'ghe_id', NEW.ghe_id, 'ngay', NEW.ngay, 'gio_bat_dau', NEW.gio_bat_dau));
    END IF;
    IF NEW.trang_thai <> OLD.trang_thai THEN
        INSERT INTO lich_su_lich_hen (lich_hen_id, hanh_dong, gia_tri_cu, gia_tri_moi)
        VALUES (NEW.id, 'DOI_TRANG_THAI',
            jsonb_build_object('trang_thai', OLD.trang_thai),
            jsonb_build_object('trang_thai', NEW.trang_thai));
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_lich_hen_nhat_ky AFTER INSERT OR UPDATE ON lich_hen
    FOR EACH ROW EXECUTE FUNCTION tg_lich_hen_nhat_ky();

-- Nhắc lịch thành công → lịch chuyển Đã nhắc (UC16, UC17)
CREATE FUNCTION tg_nhac_lich_cap_nhat() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.ket_qua IN ('XAC_NHAN', 'SMS_DA_GUI') THEN
        UPDATE lich_hen SET trang_thai = 'DA_NHAC'
        WHERE id = NEW.lich_hen_id AND trang_thai = 'DA_DAT';
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_nhac_lich_cap_nhat AFTER INSERT OR UPDATE OF ket_qua ON nhac_lich
    FOR EACH ROW EXECUTE FUNCTION tg_nhac_lich_cap_nhat();

-- Tìm khung trống (UC12): khung trong giờ mở cửa ∩ ca trực bác sĩ,
-- bác sĩ chưa bận và còn ít nhất một ghế trống. p_bac_si_id NULL = "bác sĩ nào cũng được" (A08)
CREATE FUNCTION tim_khung_trong(p_ngay date, p_bac_si_id bigint DEFAULT NULL)
RETURNS TABLE (bac_si_id bigint, bac_si text, gio_bat_dau time, ghe_trong_id smallint[], ghe_trong text[])
LANGUAGE sql STABLE AS $$
    WITH gio AS (
        SELECT g.gio_mo, g.gio_dong FROM gio_mo_cua g
        WHERE g.thu = extract(isodow FROM p_ngay) AND NOT g.nghi
          AND NOT EXISTS (SELECT 1 FROM ngay_nghi n WHERE n.ngay = p_ngay)
    ),
    khung AS (
        SELECT k::time AS gio
        FROM gio, generate_series(p_ngay + gio.gio_mo, p_ngay + gio.gio_dong - interval '30 minutes',
                                  interval '30 minutes') AS k
    ),
    bs AS (
        SELECT c.nhan_vien_id, n.ho_ten, c.gio_bat_dau, c.gio_ket_thuc
        FROM ca_truc c JOIN nhan_vien n ON n.id = c.nhan_vien_id
        WHERE c.ngay = p_ngay AND c.vai_tro_ma = 'BAC_SI' AND n.dang_hoat_dong
          AND (p_bac_si_id IS NULL OR c.nhan_vien_id = p_bac_si_id)
    ),
    ung_vien AS (
        SELECT DISTINCT bs.nhan_vien_id, bs.ho_ten, k.gio
        FROM bs JOIN khung k
          ON k.gio >= bs.gio_bat_dau AND k.gio + interval '30 minutes' <= bs.gio_ket_thuc
        WHERE NOT EXISTS (
            SELECT 1 FROM lich_hen l
            WHERE l.bac_si_id = bs.nhan_vien_id AND l.ngay = p_ngay AND l.gio_bat_dau = k.gio
              AND l.trang_thai NOT IN ('DA_HUY', 'KHONG_DEN'))
    )
    SELECT u.nhan_vien_id, u.ho_ten, u.gio,
           array_agg(g.id ORDER BY g.ma_ghe), array_agg(g.ma_ghe ORDER BY g.ma_ghe)
    FROM ung_vien u JOIN ghe g ON g.dang_hoat_dong
    WHERE NOT EXISTS (
        SELECT 1 FROM lich_hen l
        WHERE l.ghe_id = g.id AND l.ngay = p_ngay AND l.gio_bat_dau = u.gio
          AND l.trang_thai NOT IN ('DA_HUY', 'KHONG_DEN'))
    GROUP BY u.nhan_vien_id, u.ho_ten, u.gio
    ORDER BY u.gio, u.ho_ten
$$;


-- =====================================================================
-- 5. LIỆU TRÌNH (UC23, UC24, A20)
-- =====================================================================
CREATE FUNCTION tg_lieu_trinh_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NOT co_vai_tro(NEW.bac_si_phu_trach_id, 'BAC_SI') THEN
            RAISE EXCEPTION 'Người phụ trách liệu trình phải là bác sĩ';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.gia_tron_goi <> OLD.gia_tron_goi OR NEW.benh_nhan_id <> OLD.benh_nhan_id THEN
        RAISE EXCEPTION 'Giá trọn gói và bệnh nhân của liệu trình được chốt lúc tạo (A20)';
    END IF;
    IF OLD.trang_thai <> 'DANG_THUC_HIEN' AND NEW.trang_thai <> OLD.trang_thai THEN
        RAISE EXCEPTION 'Liệu trình đã kết thúc (%), không đổi trạng thái được', OLD.trang_thai;
    END IF;
    IF NEW.trang_thai <> 'DANG_THUC_HIEN' THEN
        NEW.ngay_ket_thuc := coalesce(NEW.ngay_ket_thuc, current_date);
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_lieu_trinh_truoc BEFORE INSERT OR UPDATE ON lieu_trinh
    FOR EACH ROW EXECUTE FUNCTION tg_lieu_trinh_truoc();

-- Tổng các đợt = giá trọn gói (kiểm tra khi COMMIT để tạo liệu trình + các đợt trong một giao dịch)
CREATE FUNCTION tg_kiem_tra_tong_dot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_id    bigint;
    v_gia   numeric;
    v_tt    text;
    v_tong  numeric;
BEGIN
    IF TG_TABLE_NAME = 'lieu_trinh' THEN
        v_id := NEW.id;
    ELSIF TG_OP = 'DELETE' THEN
        v_id := OLD.lieu_trinh_id;
    ELSE
        v_id := NEW.lieu_trinh_id;
    END IF;
    SELECT gia_tron_goi, trang_thai INTO v_gia, v_tt FROM lieu_trinh WHERE id = v_id;
    IF NOT FOUND OR v_tt = 'DA_HUY' THEN RETURN NULL; END IF;
    SELECT coalesce(sum(so_tien), 0) INTO v_tong FROM dot_thanh_toan WHERE lieu_trinh_id = v_id;
    IF v_tong <> v_gia THEN
        RAISE EXCEPTION 'Tổng các đợt thanh toán (%) phải bằng giá trọn gói (%) của liệu trình %', v_tong, v_gia, v_id;
    END IF;
    RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER trg_lieu_trinh_tong_dot AFTER INSERT ON lieu_trinh
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tg_kiem_tra_tong_dot();
CREATE CONSTRAINT TRIGGER trg_dot_thanh_toan_tong AFTER INSERT OR UPDATE OR DELETE ON dot_thanh_toan
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION tg_kiem_tra_tong_dot();

-- Đợt đã có hóa đơn thì không sửa/xóa
CREATE FUNCTION tg_dot_thanh_toan_khoa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM hoa_don WHERE dot_thanh_toan_id = OLD.id AND trang_thai <> 'DA_HUY')
       AND (TG_OP = 'DELETE' OR NEW.so_tien <> OLD.so_tien OR NEW.lieu_trinh_id <> OLD.lieu_trinh_id) THEN
        RAISE EXCEPTION 'Đợt % đã lập hóa đơn, không sửa số tiền / xóa được', OLD.dot_so;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_dot_thanh_toan_khoa BEFORE UPDATE OR DELETE ON dot_thanh_toan
    FOR EACH ROW EXECUTE FUNCTION tg_dot_thanh_toan_khoa();


-- =====================================================================
-- 6. PHIẾU ĐIỀU TRỊ (UC20–UC29)
-- =====================================================================
CREATE FUNCTION tg_phieu_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_lh lich_hen;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT * INTO v_lh FROM lich_hen WHERE id = NEW.lich_hen_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Không có lịch hẹn %', NEW.lich_hen_id; END IF;
        IF v_lh.trang_thai <> 'DA_DEN' THEN
            RAISE EXCEPTION 'Chỉ lập phiếu cho lịch hẹn đã check-in (trạng thái hiện tại: %)', v_lh.trang_thai;
        END IF;
        -- A16: lấy tự động từ lịch hẹn
        NEW.benh_nhan_id    := v_lh.benh_nhan_id;
        NEW.bac_si_chinh_id := v_lh.bac_si_id;
        NEW.ngay_kham       := v_lh.ngay;
        NEW.trang_thai      := 'DANG_LAP';
        NEW.hoan_tat_luc    := NULL;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF (NEW.lich_hen_id, NEW.benh_nhan_id, NEW.bac_si_chinh_id, NEW.ngay_kham)
       IS DISTINCT FROM (OLD.lich_hen_id, OLD.benh_nhan_id, OLD.bac_si_chinh_id, OLD.ngay_kham) THEN
        RAISE EXCEPTION 'Bệnh nhân, bác sĩ chính, ngày khám lấy từ lịch hẹn, không sửa được';
    END IF;
    IF OLD.trang_thai = 'HOAN_TAT' AND NEW.trang_thai <> 'HOAN_TAT' THEN
        RAISE EXCEPTION 'Phiếu đã hoàn tất, không mở lại được';
    END IF;
    IF OLD.trang_thai = 'DANG_LAP' AND NEW.trang_thai = 'HOAN_TAT' THEN
        IF NOT EXISTS (SELECT 1 FROM dong_dieu_tri WHERE phieu_dieu_tri_id = NEW.id) THEN
            RAISE EXCEPTION 'Phiếu phải có ít nhất một dòng điều trị';
        END IF;
        NEW.hoan_tat_luc := now();
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_phieu_truoc BEFORE INSERT OR UPDATE ON phieu_dieu_tri
    FOR EACH ROW EXECUTE FUNCTION tg_phieu_truoc();

CREATE FUNCTION tg_phieu_sau() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_canh_bao text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE lich_hen SET trang_thai = 'DANG_KHAM' WHERE id = NEW.lich_hen_id;
        RETURN NULL;
    END IF;

    IF OLD.trang_thai = 'DANG_LAP' AND NEW.trang_thai = 'HOAN_TAT' THEN
        UPDATE lich_hen SET trang_thai = 'HOAN_THANH' WHERE id = NEW.lich_hen_id;

        -- Trừ kho vật tư (A19) và thuốc đã phát (A18)
        INSERT INTO giao_dich_kho (thuoc_vat_tu_id, loai, so_luong, phieu_dieu_tri_id, ly_do)
        SELECT v.thuoc_vat_tu_id, 'XUAT_DIEU_TRI', -v.so_luong, NEW.id, 'Vật tư phiếu ' || NEW.ma_phieu
        FROM vat_tu_su_dung v WHERE v.phieu_dieu_tri_id = NEW.id;

        INSERT INTO giao_dich_kho (thuoc_vat_tu_id, loai, so_luong, phieu_dieu_tri_id, ly_do)
        SELECT t.thuoc_id, 'XUAT_DON_THUOC', -t.so_luong, NEW.id, 'Đơn thuốc phiếu ' || NEW.ma_phieu
        FROM don_thuoc t WHERE t.phieu_dieu_tri_id = NEW.id;

        -- Cảnh báo dưới ngưỡng (UC42, A32): gửi WARNING cho ứng dụng, chi tiết xem v_canh_bao_ton_kho
        SELECT string_agg(format('%s (tồn %s, ngưỡng %s)', m.ten, m.ton_kho, m.nguong_toi_thieu), '; ')
        INTO v_canh_bao
        FROM thuoc_vat_tu m
        WHERE m.ton_kho <= m.nguong_toi_thieu
          AND m.id IN (SELECT thuoc_vat_tu_id FROM vat_tu_su_dung WHERE phieu_dieu_tri_id = NEW.id
                       UNION SELECT thuoc_id FROM don_thuoc WHERE phieu_dieu_tri_id = NEW.id);
        IF v_canh_bao IS NOT NULL THEN
            RAISE WARNING 'Dưới ngưỡng tồn kho: %', v_canh_bao;
        END IF;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_phieu_sau AFTER INSERT OR UPDATE ON phieu_dieu_tri
    FOR EACH ROW EXECUTE FUNCTION tg_phieu_sau();

-- Dòng điều trị: luật A24 + QĐ1 + liệu trình
CREATE FUNCTION tg_dong_dieu_tri_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_phieu  phieu_dieu_tri;
    v_hd     hoa_don;
    v_lt     lieu_trinh;
    v_gio    time;
BEGIN
    SELECT * INTO v_phieu FROM phieu_dieu_tri
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.phieu_dieu_tri_id ELSE NEW.phieu_dieu_tri_id END;

    IF TG_OP = 'UPDATE' AND NEW.phieu_dieu_tri_id <> OLD.phieu_dieu_tri_id THEN
        RAISE EXCEPTION 'Không chuyển dòng điều trị sang phiếu khác';
    END IF;

    -- A24: hóa đơn đã thu tiền → khóa dòng; chưa thu → phải hủy hóa đơn rồi lập lại
    SELECT * INTO v_hd FROM hoa_don
    WHERE phieu_dieu_tri_id = v_phieu.id AND trang_thai <> 'DA_HUY';
    IF FOUND THEN
        IF v_hd.da_thu > 0 THEN
            RAISE EXCEPTION 'Hóa đơn % của phiếu đã thu tiền: chỉ được sửa chẩn đoán và ghi chú (A24)', v_hd.ma_hoa_don;
        END IF;
        RAISE EXCEPTION 'Phiếu đã có hóa đơn % (chưa thu): hãy hủy hóa đơn trước khi sửa dòng, rồi lập lại', v_hd.ma_hoa_don;
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

    -- QĐ1: mặc định bác sĩ chính
    NEW.bac_si_thuc_hien_id := coalesce(NEW.bac_si_thuc_hien_id, v_phieu.bac_si_chinh_id);
    IF NOT co_vai_tro(NEW.bac_si_thuc_hien_id, 'BAC_SI') THEN
        RAISE EXCEPTION 'Người thực hiện dòng điều trị phải là bác sĩ';
    END IF;
    -- QĐ1: bác sĩ phụ đang có lịch riêng cùng khung → chỉ cảnh báo, không chặn
    IF NEW.bac_si_thuc_hien_id <> v_phieu.bac_si_chinh_id THEN
        SELECT gio_bat_dau INTO v_gio FROM lich_hen WHERE id = v_phieu.lich_hen_id;
        IF EXISTS (SELECT 1 FROM lich_hen l
                   WHERE l.bac_si_id = NEW.bac_si_thuc_hien_id AND l.ngay = v_phieu.ngay_kham
                     AND l.gio_bat_dau = v_gio AND l.trang_thai NOT IN ('DA_HUY', 'KHONG_DEN')) THEN
            RAISE WARNING 'Bác sĩ % đang có lịch riêng lúc % ngày %', NEW.bac_si_thuc_hien_id, v_gio, v_phieu.ngay_kham;
        END IF;
    END IF;

    -- Liệu trình: cùng bệnh nhân, đang thực hiện
    IF NEW.lieu_trinh_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.lieu_trinh_id IS DISTINCT FROM OLD.lieu_trinh_id) THEN
        SELECT * INTO v_lt FROM lieu_trinh WHERE id = NEW.lieu_trinh_id;
        IF v_lt.benh_nhan_id <> v_phieu.benh_nhan_id THEN
            RAISE EXCEPTION 'Liệu trình % không thuộc bệnh nhân của phiếu', v_lt.ma_lieu_trinh;
        END IF;
        IF v_lt.trang_thai <> 'DANG_THUC_HIEN' THEN
            RAISE EXCEPTION 'Liệu trình % đã kết thúc (%)', v_lt.ma_lieu_trinh, v_lt.trang_thai;
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_dong_dieu_tri_truoc BEFORE INSERT OR UPDATE OR DELETE ON dong_dieu_tri
    FOR EACH ROW EXECUTE FUNCTION tg_dong_dieu_tri_truoc();

-- Đơn thuốc, vật tư: chỉ sửa khi phiếu còn đang lập (đã trừ kho thì khóa; sai lệch xử lý bằng kiểm kê)
CREATE FUNCTION tg_phieu_phai_dang_lap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_tt text;
BEGIN
    SELECT trang_thai INTO v_tt FROM phieu_dieu_tri
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.phieu_dieu_tri_id ELSE NEW.phieu_dieu_tri_id END;
    IF v_tt <> 'DANG_LAP' THEN
        RAISE EXCEPTION 'Phiếu đã hoàn tất (đã trừ kho): không sửa % được nữa', TG_TABLE_NAME;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_don_thuoc_dang_lap      BEFORE INSERT OR UPDATE OR DELETE ON don_thuoc
    FOR EACH ROW EXECUTE FUNCTION tg_phieu_phai_dang_lap();
CREATE TRIGGER trg_vat_tu_su_dung_dang_lap BEFORE INSERT OR UPDATE OR DELETE ON vat_tu_su_dung
    FOR EACH ROW EXECUTE FUNCTION tg_phieu_phai_dang_lap();

-- Lịch sử sửa phiếu (UC28, UC29, A24): ai sửa, lúc nào, cũ → mới
CREATE FUNCTION tg_ghi_lich_su_phieu() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_cu     jsonb;
    v_moi    jsonb;
    v_ban_ghi jsonb;
BEGIN
    IF TG_OP <> 'INSERT' THEN v_cu  := to_jsonb(OLD) - 'cap_nhat_luc'; END IF;
    IF TG_OP <> 'DELETE' THEN v_moi := to_jsonb(NEW) - 'cap_nhat_luc'; END IF;
    v_ban_ghi := coalesce(v_moi, v_cu);

    IF TG_OP = 'UPDATE' THEN
        IF v_cu = v_moi THEN RETURN NULL; END IF;
        -- Chỉ giữ các trường thay đổi
        SELECT jsonb_object_agg(k, v_cu -> k), jsonb_object_agg(k, v_moi -> k)
        INTO v_cu, v_moi
        FROM jsonb_object_keys(v_moi) AS k
        WHERE (v_moi -> k) IS DISTINCT FROM (v_cu -> k);
    END IF;

    INSERT INTO lich_su_sua_phieu (phieu_dieu_tri_id, bang, ban_ghi_id, hanh_dong, gia_tri_cu, gia_tri_moi)
    VALUES (
        CASE WHEN TG_TABLE_NAME = 'phieu_dieu_tri' THEN (v_ban_ghi ->> 'id')::bigint
             ELSE (v_ban_ghi ->> 'phieu_dieu_tri_id')::bigint END,
        TG_TABLE_NAME,
        (v_ban_ghi ->> 'id')::bigint,
        CASE TG_OP WHEN 'INSERT' THEN 'THEM' WHEN 'UPDATE' THEN 'SUA' ELSE 'XOA' END,
        v_cu, v_moi);
    RETURN NULL;
END $$;

CREATE TRIGGER trg_phieu_lich_su             AFTER UPDATE ON phieu_dieu_tri
    FOR EACH ROW EXECUTE FUNCTION tg_ghi_lich_su_phieu();
CREATE TRIGGER trg_dong_dieu_tri_lich_su     AFTER INSERT OR UPDATE OR DELETE ON dong_dieu_tri
    FOR EACH ROW EXECUTE FUNCTION tg_ghi_lich_su_phieu();
CREATE TRIGGER trg_don_thuoc_lich_su         AFTER INSERT OR UPDATE OR DELETE ON don_thuoc
    FOR EACH ROW EXECUTE FUNCTION tg_ghi_lich_su_phieu();
CREATE TRIGGER trg_vat_tu_su_dung_lich_su    AFTER INSERT OR UPDATE OR DELETE ON vat_tu_su_dung
    FOR EACH ROW EXECUTE FUNCTION tg_ghi_lich_su_phieu();
CREATE TRIGGER trg_chi_dinh_tai_kham_lich_su AFTER INSERT OR UPDATE OR DELETE ON chi_dinh_tai_kham
    FOR EACH ROW EXECUTE FUNCTION tg_ghi_lich_su_phieu();

-- Gợi ý vật tư theo định mức (UC26, A19): Σ định mức × số lượng các dòng điều trị
CREATE FUNCTION goi_y_vat_tu(p_phieu_id bigint)
RETURNS TABLE (thuoc_vat_tu_id int, ten text, don_vi_tinh text, so_luong_goi_y numeric)
LANGUAGE sql STABLE AS $$
    SELECT m.id, m.ten, m.don_vi_tinh, sum(dm.so_luong * d.so_luong)
    FROM dong_dieu_tri d
    JOIN dinh_muc_vat_tu dm ON dm.dich_vu_id = d.dich_vu_id
    JOIN thuoc_vat_tu m     ON m.id = dm.thuoc_vat_tu_id
    WHERE d.phieu_dieu_tri_id = p_phieu_id
    GROUP BY m.id, m.ten, m.don_vi_tinh
    ORDER BY m.ten
$$;

-- Ghi vật tư theo gợi ý (bác sĩ có thể sửa số lượng trước khi hoàn tất phiếu)
CREATE FUNCTION ap_dung_goi_y_vat_tu(p_phieu_id bigint) RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
    v_so int;
BEGIN
    INSERT INTO vat_tu_su_dung (phieu_dieu_tri_id, thuoc_vat_tu_id, so_luong_dinh_muc, so_luong)
    SELECT p_phieu_id, g.thuoc_vat_tu_id, g.so_luong_goi_y, g.so_luong_goi_y
    FROM goi_y_vat_tu(p_phieu_id) g
    ON CONFLICT (phieu_dieu_tri_id, thuoc_vat_tu_id)
    DO UPDATE SET so_luong_dinh_muc = EXCLUDED.so_luong_dinh_muc;
    GET DIAGNOSTICS v_so = ROW_COUNT;
    RETURN v_so;
END $$;


-- =====================================================================
-- 7. HÓA ĐƠN (UC31–UC33, QĐ3, A20–A23)
-- =====================================================================

-- Tổng tiền của hóa đơn nháp = Σ(đơn giá × SL − giảm dòng) − giảm tổng
CREATE FUNCTION tong_hoa_don_nhap(p_hoa_don_id bigint, p_giam_gia_tong numeric) RETURNS numeric
LANGUAGE sql STABLE AS $$
    SELECT coalesce(sum(round(don_gia * so_luong) - giam_gia_dong), 0) - p_giam_gia_tong
    FROM dong_hoa_don WHERE hoa_don_id = p_hoa_don_id
$$;

CREATE FUNCTION tg_hoa_don_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_phieu   phieu_dieu_tri;
    v_bn      bigint;
    v_tong    numeric;
    v_phan_bo numeric;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.loai = 'LUOT_KHAM' THEN
            SELECT * INTO v_phieu FROM phieu_dieu_tri WHERE id = NEW.phieu_dieu_tri_id;
            IF v_phieu.trang_thai IS DISTINCT FROM 'HOAN_TAT' THEN
                RAISE EXCEPTION 'Chỉ lập hóa đơn cho phiếu điều trị đã hoàn tất';
            END IF;
            v_bn := v_phieu.benh_nhan_id;
        ELSE
            SELECT lt.benh_nhan_id INTO v_bn
            FROM dot_thanh_toan d JOIN lieu_trinh lt ON lt.id = d.lieu_trinh_id
            WHERE d.id = NEW.dot_thanh_toan_id AND lt.trang_thai <> 'DA_HUY';
            IF v_bn IS NULL THEN RAISE EXCEPTION 'Đợt thanh toán không tồn tại hoặc liệu trình đã hủy'; END IF;
        END IF;
        NEW.benh_nhan_id := v_bn;
        NEW.trang_thai := 'NHAP';
        NEW.tong_tien  := 0;
        NEW.da_thu     := 0;
        IF NEW.giam_gia_tong > 0 THEN
            NEW.giam_gia_boi := coalesce(NEW.giam_gia_boi, nguoi_dung_hien_tai());
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF OLD.trang_thai = 'DA_HUY' THEN
        RAISE EXCEPTION 'Hóa đơn % đã hủy, không sửa được', OLD.ma_hoa_don;
    END IF;
    IF NEW.da_thu IS DISTINCT FROM OLD.da_thu AND pg_trigger_depth() < 2 THEN
        RAISE EXCEPTION 'da_thu chỉ được cập nhật qua bảng thanh_toan';
    END IF;
    IF (NEW.loai, NEW.benh_nhan_id, NEW.phieu_dieu_tri_id, NEW.dot_thanh_toan_id)
       IS DISTINCT FROM (OLD.loai, OLD.benh_nhan_id, OLD.phieu_dieu_tri_id, OLD.dot_thanh_toan_id) THEN
        RAISE EXCEPTION 'Không đổi loại / bệnh nhân / nguồn của hóa đơn';
    END IF;

    IF OLD.trang_thai = 'NHAP' THEN
        IF NEW.giam_gia_tong IS DISTINCT FROM OLD.giam_gia_tong AND NEW.giam_gia_tong > 0 THEN
            NEW.giam_gia_boi := coalesce(nguoi_dung_hien_tai(), NEW.giam_gia_boi);
        END IF;

        IF NEW.trang_thai = 'NHAP' THEN
            NEW.tong_tien := greatest(tong_hoa_don_nhap(NEW.id, NEW.giam_gia_tong), 0);

        ELSIF NEW.trang_thai = 'DA_CHOT' THEN
            -- Bất biến QĐ3: tong_tien = Σ thanh_tien; Σ phân bổ = giảm tổng
            SELECT coalesce(sum(thanh_tien), 0), coalesce(sum(giam_gia_phan_bo), 0)
            INTO v_tong, v_phan_bo
            FROM dong_hoa_don WHERE hoa_don_id = NEW.id;
            IF NOT EXISTS (SELECT 1 FROM dong_hoa_don WHERE hoa_don_id = NEW.id) THEN
                RAISE EXCEPTION 'Hóa đơn chưa có dòng nào';
            END IF;
            IF v_phan_bo <> NEW.giam_gia_tong THEN
                RAISE EXCEPTION 'Giảm giá tổng (%) chưa được phân bổ hết xuống dòng (%). Hãy dùng chot_hoa_don()',
                    NEW.giam_gia_tong, v_phan_bo;
            END IF;
            NEW.tong_tien := v_tong;
            NEW.chot_luc  := now();
            NEW.chot_boi  := coalesce(NEW.chot_boi, nguoi_dung_hien_tai());

        ELSIF NEW.trang_thai = 'DA_HUY' THEN
            NEW.huy_luc := coalesce(NEW.huy_luc, now());
            NEW.huy_boi := coalesce(NEW.huy_boi, nguoi_dung_hien_tai());
        END IF;

    ELSIF OLD.trang_thai = 'DA_CHOT' THEN
        IF NEW.trang_thai = 'NHAP' THEN
            RAISE EXCEPTION 'Hóa đơn đã chốt không quay lại nháp được';
        END IF;
        IF (NEW.giam_gia_tong, NEW.ly_do_giam_gia, NEW.tong_tien, NEW.ngay_lap, NEW.chot_luc, NEW.chot_boi)
           IS DISTINCT FROM
           (OLD.giam_gia_tong, OLD.ly_do_giam_gia, OLD.tong_tien, OLD.ngay_lap, OLD.chot_luc, OLD.chot_boi) THEN
            RAISE EXCEPTION 'Hóa đơn % đã chốt: giữ nguyên giá và số tiền (A21)', OLD.ma_hoa_don;
        END IF;
        IF NEW.trang_thai = 'DA_HUY' THEN
            IF OLD.da_thu > 0 THEN
                RAISE EXCEPTION 'Hóa đơn % đã thu %đ, không hủy được (A23)', OLD.ma_hoa_don, OLD.da_thu;
            END IF;
            NEW.huy_luc := coalesce(NEW.huy_luc, now());
            NEW.huy_boi := coalesce(NEW.huy_boi, nguoi_dung_hien_tai());
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_hoa_don_truoc BEFORE INSERT OR UPDATE ON hoa_don
    FOR EACH ROW EXECUTE FUNCTION tg_hoa_don_truoc();

-- Dòng hóa đơn: chỉ sửa khi hóa đơn còn nháp
CREATE FUNCTION tg_dong_hoa_don_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_hd hoa_don;
    v_dd dong_dieu_tri;
BEGIN
    SELECT * INTO v_hd FROM hoa_don
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.hoa_don_id ELSE NEW.hoa_don_id END;
    IF v_hd.trang_thai <> 'NHAP' THEN
        RAISE EXCEPTION 'Hóa đơn % đã % — không sửa dòng được', v_hd.ma_hoa_don, v_hd.trang_thai;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

    IF TG_OP = 'UPDATE' AND NEW.hoa_don_id <> OLD.hoa_don_id THEN
        RAISE EXCEPTION 'Không chuyển dòng sang hóa đơn khác';
    END IF;

    IF NEW.loai_dong = 'DICH_VU' THEN
        SELECT * INTO v_dd FROM dong_dieu_tri WHERE id = NEW.dong_dieu_tri_id;
        IF v_dd.phieu_dieu_tri_id IS DISTINCT FROM v_hd.phieu_dieu_tri_id THEN
            RAISE EXCEPTION 'Dòng điều trị không thuộc phiếu của hóa đơn';
        END IF;
        IF v_dd.lieu_trinh_id IS NOT NULL THEN
            RAISE EXCEPTION 'Dòng thuộc liệu trình không tính tiền theo dòng; thu theo đợt (A20)';
        END IF;
    ELSIF NEW.loai_dong = 'THUOC' THEN
        IF NOT EXISTS (SELECT 1 FROM don_thuoc WHERE id = NEW.don_thuoc_id
                                                 AND phieu_dieu_tri_id = v_hd.phieu_dieu_tri_id) THEN
            RAISE EXCEPTION 'Thuốc không thuộc đơn của phiếu này';
        END IF;
    ELSIF NEW.dot_thanh_toan_id IS DISTINCT FROM v_hd.dot_thanh_toan_id THEN
        RAISE EXCEPTION 'Dòng đợt liệu trình phải cùng đợt với hóa đơn';
    END IF;

    IF NEW.giam_gia_dong > 0 AND (TG_OP = 'INSERT' OR NEW.giam_gia_dong <> OLD.giam_gia_dong) THEN
        NEW.giam_gia_dong_boi := coalesce(nguoi_dung_hien_tai(), NEW.giam_gia_dong_boi);
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_dong_hoa_don_truoc BEFORE INSERT OR UPDATE OR DELETE ON dong_hoa_don
    FOR EACH ROW EXECUTE FUNCTION tg_dong_hoa_don_truoc();

-- Mỗi lần dòng đổi → tính lại tổng hóa đơn nháp (trigger hoa_don tự tính)
CREATE FUNCTION tg_dong_hoa_don_sau() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE hoa_don SET tong_tien = tong_tien
    WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.hoa_don_id ELSE NEW.hoa_don_id END
      AND trang_thai = 'NHAP';
    RETURN NULL;
END $$;

CREATE TRIGGER trg_dong_hoa_don_sau AFTER INSERT OR UPDATE OR DELETE ON dong_hoa_don
    FOR EACH ROW EXECUTE FUNCTION tg_dong_hoa_don_sau();

-- UC31: lập hóa đơn lượt khám từ phiếu đã hoàn tất, giá chốt theo ngày làm (A21)
CREATE FUNCTION lap_hoa_don_luot_kham(p_phieu_id bigint) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    v_phieu     phieu_dieu_tri;
    v_hd        bigint;
    v_thieu_gia text;
BEGIN
    SELECT * INTO v_phieu FROM phieu_dieu_tri WHERE id = p_phieu_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có phiếu %', p_phieu_id; END IF;

    SELECT string_agg(ten, ', ') INTO v_thieu_gia FROM (
        SELECT dv.ten FROM dong_dieu_tri d JOIN dich_vu dv ON dv.id = d.dich_vu_id
        WHERE d.phieu_dieu_tri_id = p_phieu_id AND d.lieu_trinh_id IS NULL
          AND gia_dich_vu(d.dich_vu_id, v_phieu.ngay_kham) IS NULL
        UNION
        SELECT m.ten FROM don_thuoc t JOIN thuoc_vat_tu m ON m.id = t.thuoc_id
        WHERE t.phieu_dieu_tri_id = p_phieu_id AND gia_thuoc(t.thuoc_id, v_phieu.ngay_kham) IS NULL) x;
    IF v_thieu_gia IS NOT NULL THEN
        RAISE EXCEPTION 'Chưa có giá hiệu lực ngày % cho: %', v_phieu.ngay_kham, v_thieu_gia;
    END IF;

    INSERT INTO hoa_don (loai, benh_nhan_id, phieu_dieu_tri_id)
    VALUES ('LUOT_KHAM', v_phieu.benh_nhan_id, p_phieu_id)
    RETURNING id INTO v_hd;

    INSERT INTO dong_hoa_don (hoa_don_id, loai_dong, dong_dieu_tri_id, mo_ta, bac_si_id,
                              ngay_thuc_hien, don_gia, so_luong)
    SELECT v_hd, 'DICH_VU', d.id,
           dv.ten || CASE d.rang WHEN 'HAM_TREN' THEN ' — hàm trên'
                                 WHEN 'HAM_DUOI' THEN ' — hàm dưới'
                                 WHEN 'TOAN_HAM' THEN ' — toàn hàm'
                                 ELSE ' — răng ' || d.rang END,
           d.bac_si_thuc_hien_id, v_phieu.ngay_kham,
           gia_dich_vu(d.dich_vu_id, v_phieu.ngay_kham), d.so_luong
    FROM dong_dieu_tri d JOIN dich_vu dv ON dv.id = d.dich_vu_id
    WHERE d.phieu_dieu_tri_id = p_phieu_id AND d.lieu_trinh_id IS NULL
    ORDER BY d.id;

    -- Thuốc: doanh thu tính cho bác sĩ chính (người kê)
    INSERT INTO dong_hoa_don (hoa_don_id, loai_dong, don_thuoc_id, mo_ta, bac_si_id,
                              ngay_thuc_hien, don_gia, so_luong)
    SELECT v_hd, 'THUOC', t.id, m.ten, v_phieu.bac_si_chinh_id, v_phieu.ngay_kham,
           gia_thuoc(t.thuoc_id, v_phieu.ngay_kham), t.so_luong
    FROM don_thuoc t JOIN thuoc_vat_tu m ON m.id = t.thuoc_id
    WHERE t.phieu_dieu_tri_id = p_phieu_id
    ORDER BY t.id;

    IF NOT EXISTS (SELECT 1 FROM dong_hoa_don WHERE hoa_don_id = v_hd) THEN
        RAISE EXCEPTION 'Phiếu % không có dòng nào cần tính tiền (toàn bộ thuộc liệu trình)', v_phieu.ma_phieu;
    END IF;
    RETURN v_hd;
END $$;

-- UC33: lập hóa đơn một đợt liệu trình
CREATE FUNCTION lap_hoa_don_dot_lieu_trinh(p_dot_id bigint) RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    v_hd bigint;
    r    record;
BEGIN
    SELECT d.id, d.dot_so, d.so_tien, lt.benh_nhan_id, lt.bac_si_phu_trach_id, lt.ten, lt.ma_lieu_trinh
    INTO r
    FROM dot_thanh_toan d JOIN lieu_trinh lt ON lt.id = d.lieu_trinh_id
    WHERE d.id = p_dot_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có đợt thanh toán %', p_dot_id; END IF;

    INSERT INTO hoa_don (loai, benh_nhan_id, dot_thanh_toan_id)
    VALUES ('DOT_LIEU_TRINH', r.benh_nhan_id, p_dot_id)
    RETURNING id INTO v_hd;

    INSERT INTO dong_hoa_don (hoa_don_id, loai_dong, dot_thanh_toan_id, mo_ta, bac_si_id,
                              ngay_thuc_hien, don_gia, so_luong)
    VALUES (v_hd, 'DOT_LIEU_TRINH', p_dot_id,
            format('%s (%s) — đợt %s', r.ten, r.ma_lieu_trinh, r.dot_so),
            r.bac_si_phu_trach_id, current_date, r.so_tien, 1);
    RETURN v_hd;
END $$;

-- QĐ3: phân bổ giảm giá tổng xuống dòng theo tỷ lệ, phần lẻ dồn vào dòng lớn nhất, rồi chốt
CREATE FUNCTION chot_hoa_don(p_hoa_don_id bigint) RETURNS numeric
LANGUAGE plpgsql AS $$
DECLARE
    v_hd       hoa_don;
    v_co_so    numeric;
    v_dong_max bigint;
BEGIN
    SELECT * INTO v_hd FROM hoa_don WHERE id = p_hoa_don_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có hóa đơn %', p_hoa_don_id; END IF;
    IF v_hd.trang_thai <> 'NHAP' THEN
        RAISE EXCEPTION 'Hóa đơn % đang ở trạng thái %, không chốt được', v_hd.ma_hoa_don, v_hd.trang_thai;
    END IF;

    SELECT sum(round(don_gia * so_luong) - giam_gia_dong) INTO v_co_so
    FROM dong_hoa_don WHERE hoa_don_id = p_hoa_don_id;
    IF v_co_so IS NULL THEN RAISE EXCEPTION 'Hóa đơn chưa có dòng nào'; END IF;
    IF v_hd.giam_gia_tong > v_co_so THEN
        RAISE EXCEPTION 'Giảm giá tổng (%) lớn hơn tiền sau giảm dòng (%)', v_hd.giam_gia_tong, v_co_so;
    END IF;

    UPDATE dong_hoa_don SET giam_gia_phan_bo =
        CASE WHEN v_hd.giam_gia_tong = 0 OR v_co_so = 0 THEN 0
             ELSE floor(v_hd.giam_gia_tong * (round(don_gia * so_luong) - giam_gia_dong) / v_co_so) END
    WHERE hoa_don_id = p_hoa_don_id;

    IF v_hd.giam_gia_tong > 0 THEN
        SELECT id INTO v_dong_max FROM dong_hoa_don WHERE hoa_don_id = p_hoa_don_id
        ORDER BY round(don_gia * so_luong) - giam_gia_dong DESC, id LIMIT 1;
        UPDATE dong_hoa_don
        SET giam_gia_phan_bo = giam_gia_phan_bo + v_hd.giam_gia_tong
            - (SELECT sum(giam_gia_phan_bo) FROM dong_hoa_don WHERE hoa_don_id = p_hoa_don_id)
        WHERE id = v_dong_max;
    END IF;

    UPDATE hoa_don SET trang_thai = 'DA_CHOT' WHERE id = p_hoa_don_id;
    RETURN (SELECT tong_tien FROM hoa_don WHERE id = p_hoa_don_id);
END $$;

-- A23: hủy hóa đơn (chỉ khi chưa thu), có lý do
CREATE FUNCTION huy_hoa_don(p_hoa_don_id bigint, p_ly_do text) RETURNS void
LANGUAGE sql AS $$
    UPDATE hoa_don SET trang_thai = 'DA_HUY', ly_do_huy = p_ly_do WHERE id = p_hoa_don_id;
$$;


-- =====================================================================
-- 8. THU TIỀN & CHỐT KÉT (UC34, UC37, A22, A25)
-- =====================================================================
CREATE FUNCTION tg_thanh_toan_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_hd hoa_don;
    v_ca ca_truc;
BEGIN
    SELECT * INTO v_hd FROM hoa_don WHERE id = NEW.hoa_don_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Không có hóa đơn %', NEW.hoa_don_id; END IF;
    IF v_hd.trang_thai <> 'DA_CHOT' THEN
        RAISE EXCEPTION 'Chỉ thu tiền hóa đơn đã chốt (hóa đơn % đang %)', v_hd.ma_hoa_don, v_hd.trang_thai;
    END IF;
    IF NEW.so_tien > v_hd.tong_tien - v_hd.da_thu THEN
        RAISE EXCEPTION 'Số tiền thu (%) vượt số còn nợ (%) của hóa đơn % (A22)',
            NEW.so_tien, v_hd.tong_tien - v_hd.da_thu, v_hd.ma_hoa_don;
    END IF;

    SELECT * INTO v_ca FROM ca_truc WHERE id = NEW.ca_truc_id;
    IF v_ca.vai_tro_ma IS DISTINCT FROM 'LE_TAN' THEN
        RAISE EXCEPTION 'Phiếu thu phải gắn với một ca lễ tân';
    END IF;
    IF EXISTS (SELECT 1 FROM chot_ket WHERE ca_truc_id = NEW.ca_truc_id) THEN
        RAISE EXCEPTION 'Ca % đã chốt két, không thu thêm được', NEW.ca_truc_id;
    END IF;
    NEW.thoi_diem := now();
    RETURN NEW;
END $$;

CREATE TRIGGER trg_thanh_toan_truoc BEFORE INSERT ON thanh_toan
    FOR EACH ROW EXECUTE FUNCTION tg_thanh_toan_truoc();

CREATE FUNCTION tg_thanh_toan_sau() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    UPDATE hoa_don SET da_thu = da_thu + NEW.so_tien WHERE id = NEW.hoa_don_id;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_thanh_toan_sau AFTER INSERT ON thanh_toan
    FOR EACH ROW EXECUTE FUNCTION tg_thanh_toan_sau();

-- A22: khách trả gộp → gợi ý chia vào các hóa đơn còn nợ, cũ trước
CREATE FUNCTION goi_y_phan_bo_thanh_toan(p_benh_nhan_id bigint, p_so_tien numeric)
RETURNS TABLE (hoa_don_id bigint, ma_hoa_don text, ngay_lap date, con_no numeric, so_tien_thu numeric)
LANGUAGE sql STABLE AS $$
    SELECT x.id, x.ma_hoa_don, x.ngay_lap, x.con_no, x.thu FROM (
        SELECT h.id, h.ma_hoa_don, h.ngay_lap, h.con_no,
               least(h.con_no, greatest(p_so_tien - coalesce(sum(h.con_no) OVER (
                   ORDER BY h.ngay_lap, h.id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0), 0)) AS thu
        FROM hoa_don h
        WHERE h.benh_nhan_id = p_benh_nhan_id AND h.trang_thai = 'DA_CHOT' AND h.con_no > 0
    ) x
    WHERE x.thu > 0
    ORDER BY x.ngay_lap, x.id
$$;

-- Chốt két (UC37): hệ thống tự tính tiền mặt & chuyển khoản trong ca
CREATE FUNCTION tg_chot_ket_truoc() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_ca ca_truc;
BEGIN
    SELECT * INTO v_ca FROM ca_truc WHERE id = NEW.ca_truc_id;
    IF v_ca.vai_tro_ma IS DISTINCT FROM 'LE_TAN' THEN
        RAISE EXCEPTION 'Chỉ chốt két theo ca lễ tân';
    END IF;
    SELECT coalesce(sum(so_tien) FILTER (WHERE hinh_thuc = 'TIEN_MAT'), 0),
           coalesce(sum(so_tien) FILTER (WHERE hinh_thuc = 'CHUYEN_KHOAN'), 0),
           count(*) FILTER (WHERE hinh_thuc = 'CHUYEN_KHOAN')
    INTO NEW.tien_mat_thu_trong_ca, NEW.tong_chuyen_khoan, NEW.so_giao_dich_chuyen_khoan
    FROM thanh_toan WHERE ca_truc_id = NEW.ca_truc_id;
    NEW.chot_luc := now();
    RETURN NEW;
END $$;

CREATE TRIGGER trg_chot_ket_truoc BEFORE INSERT ON chot_ket
    FOR EACH ROW EXECUTE FUNCTION tg_chot_ket_truoc();

COMMIT;
