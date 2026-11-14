-- =====================================================================
-- ClinicCyberDB — 04. Dữ liệu mẫu (danh mục + dữ liệu thử)
-- Chạy sau 03_view_bao_cao.sql. Ca trực / lịch hẹn sinh theo ngày chạy (current_date).
--
-- Tài khoản nhân viên mẫu: mật khẩu chung 'DoiMatKhau@2026' (bcrypt) — đổi ngay khi dùng thật.
-- Mọi tên người, SĐT, địa chỉ, email đều là dữ liệu giả.
--
-- Các cột cố ý để NULL vì chỉ có nghĩa ở trạng thái khác (ràng buộc CHECK yêu cầu):
--   benh_nhan.nguoi_giam_ho/quan_he_giam_ho (người lớn), so_ho_so_giay/ngay_kham_gan_nhat_giay
--   (hồ sơ mới), ly_do_ngung (đang hoạt động); lich_hen.den_luc/tiep_don_boi (chưa đến),
--   huy_* (chưa hủy), chi_dinh_tai_kham_id (không phải lịch tái khám);
--   lieu_trinh.ngay_ket_thuc/ly_do_huy (đang thực hiện); giao_dich_kho.phieu_dieu_tri_id (phiếu nhập).
-- =====================================================================
\set ON_ERROR_STOP on
BEGIN;

-- ---------- Vai trò ----------
INSERT INTO vai_tro (ma, ten) VALUES
    ('LE_TAN',  'Lễ tân'),
    ('BAC_SI',  'Bác sĩ'),
    ('QUAN_LY', 'Quản lý');

-- ---------- Nhân viên: 4 bác sĩ (1 bán thời gian), 2 lễ tân, 1 quản lý ----------
INSERT INTO nhan_vien (ma_nhan_vien, ho_ten, so_dien_thoai, email, ten_dang_nhap, mat_khau_hash,
                       doi_mat_khau_luc, dang_nhap_cuoi_luc, ban_thoi_gian, dang_hoat_dong)
SELECT x.ma, x.ten, x.sdt, x.email, x.tdn, crypt('DoiMatKhau@2026', gen_salt('bf', 10)),
       now() - x.doi_mk, now() - x.dang_nhap, x.btg, true
FROM (VALUES
    ('NV001', 'Hoàng Thị Lan',   '0903000001', 'lan.ht@nhakhoa.local',   'quanly',  interval '30 days', interval '2 hours',  false),
    ('NV002', 'Trần Minh Quân',  '0903000002', 'quan.tm@nhakhoa.local',  'bs.quan', interval '45 days', interval '1 day',    false),
    ('NV003', 'Lê Thu Hà',       '0903000003', 'ha.lt@nhakhoa.local',    'bs.ha',   interval '60 days', interval '1 day',    false),
    ('NV004', 'Phạm Đức Long',   '0903000004', 'long.pd@nhakhoa.local',  'bs.long', interval '20 days', interval '3 hours',  false),
    ('NV005', 'Võ Thanh Tâm',    '0903000005', 'tam.vt@nhakhoa.local',   'bs.tam',  interval '90 days', interval '2 days',   true),
    ('NV006', 'Nguyễn Ngọc Ánh', '0903000006', 'anh.nn@nhakhoa.local',   'lt.anh',  interval '15 days', interval '4 hours',  false),
    ('NV007', 'Đỗ Bảo Châu',     '0903000007', 'chau.db@nhakhoa.local',  'lt.chau', interval '15 days', interval '20 hours', false)
) AS x(ma, ten, sdt, email, tdn, doi_mk, dang_nhap, btg);

INSERT INTO nhan_vien_vai_tro (nhan_vien_id, vai_tro_ma)
SELECT id, CASE ma_nhan_vien WHEN 'NV001' THEN 'QUAN_LY'
                             WHEN 'NV006' THEN 'LE_TAN' WHEN 'NV007' THEN 'LE_TAN'
                             ELSE 'BAC_SI' END
FROM nhan_vien;

-- Mọi thao tác bên dưới ghi nhận là của quản lý
SELECT set_config('app.nhan_vien_id', id::text, true) FROM nhan_vien WHERE ma_nhan_vien = 'NV001' \g /dev/null

-- ---------- Tỷ lệ ăn chia (A29) ----------
INSERT INTO ty_le_an_chia (bac_si_id, ty_le, hieu_luc_tu, ghi_chu)
SELECT nv.id, x.ty_le, DATE '2026-01-01', x.ghi_chu
FROM nhan_vien nv JOIN (VALUES
    ('NV002', 40.0, 'Bác sĩ chính chỉnh nha, phụ trách liệu trình niềng'),
    ('NV003', 35.0, 'Bác sĩ toàn thời gian, ca 11h–20h'),
    ('NV004', 35.0, 'Bác sĩ toàn thời gian, trực cả Chủ nhật'),
    ('NV005', 30.0, 'Bán thời gian (T2, T4, T6), không hưởng phụ cấp')
) AS x(ma, ty_le, ghi_chu) ON x.ma = nv.ma_nhan_vien;

-- ---------- Ghế, giờ mở cửa, ngày nghỉ, lý do hủy ----------
INSERT INTO ghe (ma_ghe, ten, dang_hoat_dong) VALUES
    ('G1', 'Ghế 1 — cạnh cửa sổ, có máy X-quang cầm tay', true),
    ('G2', 'Ghế 2 — phòng giữa, có đèn tẩy trắng',         true),
    ('G3', 'Ghế 3 — phòng trong, dùng cho tiểu phẫu',       true);

INSERT INTO gio_mo_cua (thu, gio_mo, gio_dong, nghi)
SELECT t, TIME '08:00', CASE WHEN t = 7 THEN TIME '17:00' ELSE TIME '20:00' END, false
FROM generate_series(1, 7) AS t;          -- T2–T7: 8h–20h (72 khung/ngày), CN: 8h–17h (54 khung)

INSERT INTO ngay_nghi (ngay, ly_do) VALUES
    (DATE '2027-01-01', 'Tết Dương lịch'),
    (DATE '2027-02-05', 'Tết Nguyên đán (29 tháng Chạp)'),
    (DATE '2027-02-06', 'Tết Nguyên đán (Mùng 1)'),
    (DATE '2027-02-07', 'Tết Nguyên đán (Mùng 2)'),
    (DATE '2027-02-08', 'Tết Nguyên đán (Mùng 3)'),
    (DATE '2027-04-30', 'Ngày Giải phóng miền Nam'),
    (DATE '2027-05-01', 'Quốc tế Lao động'),
    (DATE '2027-09-02', 'Quốc khánh');

INSERT INTO ly_do_huy (ten, dang_hoat_dong) VALUES
    ('Bận việc đột xuất',             true),
    ('Ốm / sức khỏe không cho phép',  true),
    ('Lo ngại chi phí',               true),
    ('Đổi ý, không muốn làm nữa',     true),
    ('Thời tiết / đi lại khó khăn',   true),
    ('Bác sĩ nghỉ đột xuất',          true),
    ('Khác',                          true);

-- ---------- Dịch vụ & bảng giá ----------
INSERT INTO dich_vu (ma_dich_vu, ten, nhom, don_vi_tinh, la_lieu_trinh, mo_ta, dang_hoat_dong) VALUES
    ('KHAM',       'Khám & tư vấn',                 'Khám',      'Lần',  false, 'Khám tổng quát, tư vấn kế hoạch điều trị; miễn phí nếu làm dịch vụ khác trong ngày theo chính sách phòng khám', true),
    ('XQ',         'Chụp X-quang quanh chóp',       'Khám',      'Phim', false, 'Phim nhỏ chụp 1–3 răng, hỗ trợ chẩn đoán sâu răng, viêm chóp', true),
    ('CVR',        'Cạo vôi răng & đánh bóng',      'Nha chu',   'Hàm',  false, 'Lấy vôi bằng máy siêu âm và đánh bóng; khuyến nghị 6 tháng/lần', true),
    ('TRAM',       'Trám răng composite',           'Điều trị',  'Răng', false, 'Trám thẩm mỹ bằng composite quang trùng hợp cho răng sâu, mẻ', true),
    ('DTT',        'Điều trị tủy',                  'Điều trị',  'Răng', false, 'Lấy tủy, làm sạch và trám bít ống tủy; có thể cần 2–3 buổi', true),
    ('NHO',        'Nhổ răng thường',               'Tiểu phẫu', 'Răng', false, 'Nhổ răng lung lay, răng sữa hoặc chân răng; gây tê tại chỗ', true),
    ('NHO_KHON',   'Nhổ răng khôn',                 'Tiểu phẫu', 'Răng', false, 'Tiểu phẫu răng khôn mọc lệch / ngầm, có khâu; tái khám cắt chỉ sau 7 ngày', true),
    ('TAY_TRANG',  'Tẩy trắng răng tại phòng khám', 'Thẩm mỹ',   'Lần',  false, 'Tẩy trắng bằng gel và đèn chiếu, khoảng 60 phút', true),
    ('SU',         'Bọc răng sứ',                   'Phục hình', 'Răng', false, 'Mão sứ kim loại hoặc toàn sứ; mài cùi, lấy dấu và gắn sau 5–7 ngày', true),
    ('SIET_NIENG', 'Siết / chỉnh dây cung niềng',   'Chỉnh nha', 'Lần',  false, 'Buổi chỉnh niềng định kỳ 4–6 tuần/lần; không tính tiền nếu thuộc liệu trình', true),
    ('NIENG',      'Niềng răng mắc cài kim loại',   'Chỉnh nha', 'Gói',  true,  'Trọn gói 18–24 tháng gồm gắn mắc cài, các buổi siết, tháo và hàm duy trì', true),
    ('IMPLANT',    'Cấy ghép implant',              'Phục hình', 'Gói',  true,  'Trọn gói trụ implant, abutment và mão sứ; 3–6 tháng qua nhiều giai đoạn', true);

INSERT INTO bang_gia_dich_vu (dich_vu_id, don_gia, hieu_luc_tu, ghi_chu)
SELECT dv.id, g.gia, g.tu, g.ghi_chu
FROM dich_vu dv JOIN (VALUES
    ('KHAM',        100000, DATE '2025-01-01', 'Bảng giá niêm yết 2025'),
    ('XQ',           50000, DATE '2025-01-01', 'Bảng giá niêm yết 2025'),
    ('CVR',         300000, DATE '2025-01-01', 'Bảng giá niêm yết 2025, giá cho một hàm'),
    ('TRAM',        350000, DATE '2025-01-01', 'Bảng giá niêm yết 2025'),
    ('TRAM',        400000, DATE '2026-01-01', 'Điều chỉnh do giá composite tăng; giá cũ vẫn giữ để đối chiếu (A21)'),
    ('DTT',        1500000, DATE '2025-01-01', 'Bảng giá niêm yết 2025, răng một chân'),
    ('NHO',         500000, DATE '2025-01-01', 'Bảng giá niêm yết 2025'),
    ('NHO_KHON',   1500000, DATE '2025-01-01', 'Bảng giá niêm yết 2025, chưa gồm X-quang toàn cảnh'),
    ('TAY_TRANG',  2500000, DATE '2025-01-01', 'Bảng giá niêm yết 2025, cả hai hàm'),
    ('SU',         4000000, DATE '2025-01-01', 'Bảng giá niêm yết 2025, sứ kim loại'),
    ('SIET_NIENG',  300000, DATE '2025-01-01', 'Chỉ áp dụng khi không thuộc liệu trình'),
    ('NIENG',     30000000, DATE '2025-01-01', 'Giá tham khảo; giá thực chốt khi tạo liệu trình (A20)'),
    ('IMPLANT',   25000000, DATE '2025-01-01', 'Giá tham khảo cho một trụ; giá thực chốt khi tạo liệu trình (A20)')
) AS g(ma, gia, tu, ghi_chu) ON g.ma = dv.ma_dich_vu;

-- ---------- Thuốc & vật tư ----------
-- Với vật tư: hoat_chat = chất liệu, ham_luong = quy cách
INSERT INTO thuoc_vat_tu (ma, ten, loai, don_vi_tinh, hoat_chat, ham_luong, nguong_toi_thieu, dang_hoat_dong) VALUES
    ('T_AMOX',  'Amoxicillin 500mg',            'THUOC',  'Viên', 'Amoxicillin',            '500mg',          100, true),
    ('T_PARA',  'Paracetamol 500mg',            'THUOC',  'Viên', 'Paracetamol',            '500mg',          100, true),
    ('T_METRO', 'Metronidazol 250mg',           'THUOC',  'Viên', 'Metronidazol',           '250mg',           60, true),
    ('T_CHX',   'Nước súc miệng Chlorhexidine', 'THUOC',  'Chai', 'Chlorhexidine',          '0,12% — 250ml',   10, true),
    ('VT_TE',   'Thuốc tê Lidocain 2%',         'VAT_TU', 'Ống',  'Lidocain + Epinephrin',  '2% — ống 1,8ml',  30, true),
    ('VT_GANG', 'Găng tay y tế',                'VAT_TU', 'Đôi',  'Nitrile không bột',      'Size M',         200, true),
    ('VT_KT',   'Khẩu trang y tế',              'VAT_TU', 'Cái',  'Vải không dệt',          '4 lớp',          200, true),
    ('VT_COMP', 'Composite trám',               'VAT_TU', 'g',    'Nano-hybrid composite',  'Màu A2, tuýp 4g', 20, true),
    ('VT_BONG', 'Bông gòn nha khoa',            'VAT_TU', 'Gói',  'Cotton y tế',            'Cuộn 10mm, 50 cuộn/gói', 20, true),
    ('VT_KIM',  'Kim tiêm nha khoa',            'VAT_TU', 'Cái',  'Thép không gỉ',          '27G x 21mm',      50, true);

INSERT INTO bang_gia_thuoc (thuoc_id, don_gia, hieu_luc_tu, ghi_chu)
SELECT m.id, g.gia, DATE '2025-01-01', g.ghi_chu
FROM thuoc_vat_tu m JOIN (VALUES
    ('T_AMOX',   3000, 'Giá bán lẻ theo viên'),
    ('T_PARA',   1000, 'Giá bán lẻ theo viên'),
    ('T_METRO',  1500, 'Giá bán lẻ theo viên'),
    ('T_CHX',   45000, 'Giá bán nguyên chai')
) AS g(ma, gia, ghi_chu) ON g.ma = m.ma;

-- Nhập kho đầu kỳ (VT_COMP và T_CHX cố ý dưới ngưỡng để thấy cảnh báo)
INSERT INTO giao_dich_kho (thuoc_vat_tu_id, loai, so_luong, don_gia_nhap, nha_cung_cap, so_lo, han_dung, ly_do)
SELECT m.id, 'NHAP', n.sl, n.gia, n.ncc, n.lo, n.hd, 'Tồn đầu kỳ khi đưa hệ thống vào sử dụng'
FROM thuoc_vat_tu m JOIN (VALUES
    ('T_AMOX',   500,  1500, 'Công ty Dược phẩm Mẫu A',  'AMX2605', DATE '2028-05-31'),
    ('T_PARA',   800,   400, 'Công ty Dược phẩm Mẫu A',  'PRC2603', DATE '2029-03-31'),
    ('T_METRO',  300,   700, 'Công ty Dược phẩm Mẫu A',  'MTR2601', DATE '2028-01-31'),
    ('T_CHX',      8, 30000, 'Công ty Dược phẩm Mẫu B',  'CHX2607', DATE '2028-07-31'),
    ('VT_TE',    120, 12000, 'Công ty Vật tư Nha khoa Mẫu', 'LDC2604', DATE '2028-04-30'),
    ('VT_GANG', 1000,  1500, 'Công ty Vật tư Y tế Mẫu',  'GNT2609', DATE '2030-09-30'),
    ('VT_KT',   1000,   500, 'Công ty Vật tư Y tế Mẫu',  'KTR2608', DATE '2029-08-31'),
    ('VT_COMP',   15, 60000, 'Công ty Vật tư Nha khoa Mẫu', 'CMP2606', DATE '2028-06-30'),
    ('VT_BONG',   50, 20000, 'Công ty Vật tư Y tế Mẫu',  'BNG2605', DATE '2031-05-31'),
    ('VT_KIM',   300,  2000, 'Công ty Vật tư Nha khoa Mẫu', 'KIM2602', DATE '2030-02-28')
) AS n(ma, sl, gia, ncc, lo, hd) ON n.ma = m.ma;

-- Định mức vật tư theo dịch vụ (A19)
INSERT INTO dinh_muc_vat_tu (dich_vu_id, thuoc_vat_tu_id, so_luong)
SELECT dv.id, m.id, x.sl
FROM (VALUES
    ('KHAM', 'VT_GANG', 1), ('KHAM', 'VT_KT', 1),
    ('CVR',  'VT_GANG', 1), ('CVR',  'VT_KT', 1), ('CVR', 'VT_BONG', 1),
    ('TRAM', 'VT_GANG', 1), ('TRAM', 'VT_COMP', 0.5), ('TRAM', 'VT_BONG', 0.5),
    ('DTT',  'VT_GANG', 2), ('DTT',  'VT_TE', 1), ('DTT', 'VT_KIM', 1), ('DTT', 'VT_BONG', 1),
    ('NHO',  'VT_GANG', 1), ('NHO',  'VT_TE', 1), ('NHO', 'VT_KIM', 1), ('NHO', 'VT_BONG', 1),
    ('NHO_KHON', 'VT_GANG', 2), ('NHO_KHON', 'VT_TE', 2), ('NHO_KHON', 'VT_KIM', 2), ('NHO_KHON', 'VT_BONG', 2),
    ('SIET_NIENG', 'VT_GANG', 1)
) AS x(dv, vt, sl)
JOIN dich_vu dv     ON dv.ma_dich_vu = x.dv
JOIN thuoc_vat_tu m ON m.ma = x.vt;

-- ---------- Ca trực 14 ngày tới (A09), bỏ qua ngày nghỉ ----------
-- Bác sĩ: Quân 8h–17h T2–T7; Hà 11h–20h T2–T7; Long 8h–17h mọi ngày; Tâm (bán thời gian) 14h–20h T2, T4, T6
-- Lễ tân: Ánh ca sáng, Châu ca chiều
INSERT INTO ca_truc (nhan_vien_id, vai_tro_ma, ngay, gio_bat_dau, gio_ket_thuc, ten_ca, ghi_chu)
SELECT nv.id, c.vai_tro, d::date, c.bd, c.kt, c.ten_ca, c.ghi_chu
FROM generate_series(current_date, current_date + 13, interval '1 day') AS d
CROSS JOIN (VALUES
    ('NV002', 'BAC_SI', TIME '08:00', TIME '17:00', 'Ngày',  ARRAY[1,2,3,4,5,6],   'Lịch cố định; nghỉ trưa linh hoạt khi không có khách'),
    ('NV003', 'BAC_SI', TIME '11:00', TIME '20:00', 'Ngày',  ARRAY[1,2,3,4,5,6],   'Lịch cố định ca muộn'),
    ('NV004', 'BAC_SI', TIME '08:00', TIME '17:00', 'Ngày',  ARRAY[1,2,3,4,5,6,7], 'Lịch cố định, trực cả Chủ nhật'),
    ('NV005', 'BAC_SI', TIME '14:00', TIME '20:00', 'Chiều', ARRAY[1,3,5],         'Bán thời gian theo 3 ngày đã đăng ký'),
    ('NV006', 'LE_TAN', TIME '08:00', TIME '14:00', 'Sáng',  ARRAY[1,2,3,4,5,6],   'Mở két đầu ngày, bàn giao cho ca chiều lúc 14h'),
    ('NV007', 'LE_TAN', TIME '14:00', TIME '20:00', 'Chiều', ARRAY[1,2,3,4,5,6],   'Chốt két và đóng cửa cuối ngày'),
    ('NV006', 'LE_TAN', TIME '08:00', TIME '12:30', 'Sáng',  ARRAY[7],             'Chủ nhật — ca sáng rút ngắn'),
    ('NV007', 'LE_TAN', TIME '12:30', TIME '17:00', 'Chiều', ARRAY[7],             'Chủ nhật — chốt két lúc 17h')
) AS c(ma, vai_tro, bd, kt, ten_ca, thu, ghi_chu)
JOIN nhan_vien nv ON nv.ma_nhan_vien = c.ma
WHERE extract(isodow FROM d)::int = ANY (c.thu)
  AND NOT EXISTS (SELECT 1 FROM ngay_nghi n WHERE n.ngay = d::date);

-- ---------- Bệnh nhân mẫu ----------
INSERT INTO benh_nhan (ho_ten, ngay_sinh, gioi_tinh, so_dien_thoai, dia_chi, tien_su_benh, di_ung, ghi_chu) VALUES
    ('Nguyễn Văn An',  '1985-04-12', 'NAM', '0901234567', '12 Lý Chính Thắng, TP. Hồ Chí Minh',
     'Tăng huyết áp, đang dùng Amlodipin 5mg/ngày', 'Không ghi nhận',
     'Hay ê buốt khi uống lạnh; ưu tiên hẹn buổi sáng'),
    ('Trần Thị Bình',  '1990-09-03', 'NU',  '0912345678', '45 Ba Tháng Hai, TP. Hồ Chí Minh',
     'Không có bệnh nền', 'Penicillin (nổi mẩn đỏ)',
     'Mẹ của bé Khôi và bé Ngọc (dùng chung SĐT); đang niềng răng'),
    ('Hoàng Thị Dung', '1995-12-20', 'NU',  '0938765432', '8 Võ Văn Ngân, TP. Thủ Đức, TP. Hồ Chí Minh',
     'Không có bệnh nền', 'Không ghi nhận',
     'Cạo vôi định kỳ 6 tháng/lần; muốn tư vấn tẩy trắng');

-- Hai chị em dùng chung số của mẹ (QĐ2)
INSERT INTO benh_nhan (ho_ten, ngay_sinh, gioi_tinh, so_dien_thoai, dia_chi, nguoi_giam_ho, quan_he_giam_ho,
                       tien_su_benh, di_ung, ghi_chu) VALUES
    ('Lê Minh Khôi', '2016-06-01', 'NAM', '0912345678', '45 Ba Tháng Hai, TP. Hồ Chí Minh', 'Trần Thị Bình', 'Mẹ',
     'Hen phế quản nhẹ, có bình xịt Ventolin khi cần', 'Không ghi nhận',
     'Sợ khám, cần giải thích và trấn an trước khi làm'),
    ('Lê Bảo Ngọc',  '2019-02-14', 'NU',  '0912345678', '45 Ba Tháng Hai, TP. Hồ Chí Minh', 'Trần Thị Bình', 'Mẹ',
     'Không có bệnh nền', 'Không ghi nhận',
     'Theo dõi sâu răng sữa hàm dưới; bôi fluor định kỳ');

-- Bệnh nhân chuyển từ hồ sơ giấy, lần khám cuối > 6 tháng (UC08, A27)
INSERT INTO benh_nhan (ho_ten, ngay_sinh, gioi_tinh, so_dien_thoai, dia_chi, tien_su_benh, di_ung, ghi_chu,
                       nguon_ho_so, so_ho_so_giay, ngay_kham_gan_nhat_giay) VALUES
    ('Phạm Quốc Cường', '1978-07-30', 'NAM', '0987654321', '102 Nguyễn Trãi, TP. Hồ Chí Minh',
     'Đái tháo đường type 2, kiểm soát bằng Metformin', 'Không ghi nhận',
     'Chuyển từ hồ sơ giấy; theo phiếu cũ đã nhổ răng 38 năm 2023',
     'HO_SO_GIAY', 'HS-2019-0457', DATE '2025-03-10');

-- Ảnh scan phiếu giấy cũ của bệnh nhân chuyển hồ sơ (UC08)
INSERT INTO tai_lieu_ho_so (benh_nhan_id, duong_dan, ten_file, mo_ta)
SELECT bn.id, 'ho-so-giay/' || bn.ma_benh_nhan || '/' || x.file, x.file, x.mo_ta
FROM benh_nhan bn
CROSS JOIN (VALUES
    ('HS-2019-0457-trang-1.jpg', 'Phiếu khám lần đầu 2019 — thông tin hành chính và tiền sử'),
    ('HS-2019-0457-trang-2.jpg', 'Phiếu điều trị 2023–2025 — nhổ răng 38, cạo vôi')
) AS x(file, mo_ta)
WHERE bn.so_ho_so_giay = 'HS-2019-0457';

-- ---------- Lịch hẹn ngày làm việc kế tiếp với BS Long (trực mọi ngày) ----------
INSERT INTO lich_hen (benh_nhan_id, bac_si_id, ghe_id, ngay, gio_bat_dau, dich_vu_du_kien_id, nguon, ghi_chu)
SELECT bn.id, bs.id, g.id,
       (SELECT min(d)::date FROM generate_series(current_date + 1, current_date + 13, interval '1 day') AS d
        WHERE NOT EXISTS (SELECT 1 FROM ngay_nghi n WHERE n.ngay = d::date)),
       x.gio, dv.id, x.nguon, x.ghi_chu
FROM (VALUES
    ('Nguyễn Văn An',  'G1', TIME '09:00', 'TRAM', 'DIEN_THOAI', 'Ê buốt răng hàm dưới bên phải khoảng 2 tuần'),
    ('Lê Minh Khôi',   'G2', TIME '09:30', 'KHAM', 'DIEN_THOAI', 'Mẹ gọi đặt lịch khám răng sữa; bé sợ khám'),
    ('Hoàng Thị Dung', 'G1', TIME '10:00', 'CVR',  'TAI_QUAY',   'Đặt tại quầy khi ghé hỏi giá tẩy trắng; cạo vôi định kỳ')
) AS x(ten, ghe, gio, dv, nguon, ghi_chu)
JOIN benh_nhan bn ON bn.ho_ten = x.ten
JOIN ghe g        ON g.ma_ghe = x.ghe
JOIN dich_vu dv   ON dv.ma_dich_vu = x.dv
JOIN nhan_vien bs ON bs.ma_nhan_vien = 'NV004';

-- ---------- Liệu trình niềng răng: 24 buổi, 30 triệu, 3 đợt (A20) ----------
WITH lt AS (
    INSERT INTO lieu_trinh (benh_nhan_id, bac_si_phu_trach_id, dich_vu_id, ten, so_buoi_du_kien,
                            gia_tron_goi, ngay_bat_dau, ghi_chu)
    SELECT bn.id, bs.id, dv.id, 'Niềng răng mắc cài kim loại', 24, 30000000, current_date,
           'Răng chen chúc hàm trên, khớp cắn sâu nhẹ; dự kiến 20–24 tháng, tái khám 4–6 tuần/lần'
    FROM benh_nhan bn, nhan_vien bs, dich_vu dv
    WHERE bn.ho_ten = 'Trần Thị Bình' AND bs.ma_nhan_vien = 'NV002' AND dv.ma_dich_vu = 'NIENG'
    RETURNING id
)
INSERT INTO dot_thanh_toan (lieu_trinh_id, dot_so, so_tien, ngay_du_kien, ghi_chu)
SELECT lt.id, d.so, d.tien, current_date + d.sau, d.ghi_chu
FROM lt, (VALUES
    (1, 10000000,   0, 'Thanh toán khi gắn mắc cài'),
    (2, 10000000,  90, 'Thanh toán sau 3 tháng điều trị'),
    (3, 10000000, 180, 'Thanh toán sau 6 tháng điều trị, đã gồm hàm duy trì')
) AS d(so, tien, sau, ghi_chu);

COMMIT;
