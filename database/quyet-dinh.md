# Quyết định thiết kế — ba chỗ phòng khám đang làm mỗi lần một kiểu

> Liên quan: [use-case.md](../.claude/docs/requirements/use-case.md). Tên bảng và cột dưới đây chỉ là gợi ý cho bước thiết kế CSDL.

---

## QĐ1 — Hai bác sĩ cùng làm cho một khách

### Hiện trạng
Có buổi hai bác sĩ cùng làm cho một khách, và hồ sơ giấy ghi cả hai tên. Trong khi đó luật lại nói "một lịch hẹn gắn đúng **một** bác sĩ", và quản lý cần biết "mỗi bác sĩ làm ra bao nhiêu tiền".

### Các phương án đã cân nhắc
| Phương án | Nhược điểm |
|---|---|
| A. Cho lịch hẹn gắn nhiều bác sĩ | Phá luật một lịch một bác sĩ; kiểm tra trùng lịch phức tạp hơn. |
| B. Phiếu điều trị có danh sách bác sĩ (quan hệ N–N), không biết ai làm việc gì | Không biết chia doanh thu thế nào, nên phải chia đều một cách tùy tiện. |
| C. Ghi tên bác sĩ thứ hai vào ô ghi chú | Mất dữ liệu cho báo cáo. |
| **D. Lịch hẹn và phiếu có một bác sĩ chính; từng dòng điều trị ghi bác sĩ thực hiện** | — |

### Lựa chọn: **D**
- `lich_hen.bac_si_id`: **một** bác sĩ chính. Luật được giữ nguyên.
- `phieu_dieu_tri.bac_si_chinh_id`: lấy từ lịch hẹn.
- `dong_dieu_tri.bac_si_thuc_hien_id`: mặc định là bác sĩ chính; có thể chọn bác sĩ khác (use case UC25).
- Khi in hoặc xem phiếu, hệ thống liệt kê **mọi bác sĩ có trong các dòng**, nên hồ sơ vẫn "ghi hai tên" như hiện nay.
- Mỗi dòng chỉ có **một** bác sĩ chịu trách nhiệm và được tính doanh thu. Người chỉ phụ giúp (không tự làm thủ thuật nào) được ghi ở phần ghi chú.
- Bác sĩ phụ **không bị khóa khung giờ**. Nếu lúc đó họ đang có lịch riêng, hệ thống chỉ **cảnh báo**, không chặn.

### Lý do
- Không phải sửa luật đã có.
- Báo cáo doanh thu theo bác sĩ (câu 1, câu 8) và chia tiền (UC44) tính chính xác theo từng việc thật sự làm.
- Trường hợp thường gặp (một bác sĩ) không phải thao tác gì thêm.

---

## QĐ2 — Trẻ dưới 15 tuổi dùng chung số điện thoại của mẹ

### Hiện trạng
Trẻ chưa có số riêng thì lễ tân ghi số của mẹ, nên hai chị em có thể chung một số. Như vậy luật "nhận biết bệnh nhân bằng SĐT" không còn đúng: một SĐT có thể ứng với nhiều người.

### Các phương án đã cân nhắc
| Phương án | Nhược điểm |
|---|---|
| A. Giữ SĐT là khóa duy nhất, thêm hậu tố (`0901234567-1`) | Dữ liệu bẩn, gửi SMS lỗi, lễ tân phải nhớ quy ước. |
| B. Bắt mỗi trẻ phải có số riêng | Không thực tế. |
| C. Mô hình "hộ gia đình" (bảng gia đình + thành viên) | Quá mức cần thiết cho nhu cầu hiện tại. |
| **D. Mã bệnh nhân là định danh; SĐT chỉ dùng để tra cứu và không bắt buộc duy nhất** | — |

### Lựa chọn: **D**
- `benh_nhan.ma_benh_nhan` (vd. `BN000123`): **duy nhất**, là định danh thật.
- `benh_nhan.so_dien_thoai`: bắt buộc, **không unique**, có đánh chỉ mục để tìm nhanh.
- `benh_nhan.ngay_sinh`: **bắt buộc**, dùng để phân biệt người chung số và nhận biết trẻ dưới 15 tuổi.
- `benh_nhan.nguoi_giam_ho`, `benh_nhan.quan_he_giam_ho`: điền khi bệnh nhân dưới 15 tuổi.
- **Tìm theo SĐT** (UC04): nếu có nhiều kết quả thì hiện danh sách gồm tên, ngày sinh, người giám hộ để lễ tân chọn đúng người.
- **Tạo mới** (UC05): nếu SĐT đã có người dùng, hệ thống hiện những người đó và yêu cầu lễ tân xác nhận "đây là người khác". Bước này cũng chặn việc tạo trùng hồ sơ, vốn dễ xảy ra vì trùng tên là chuyện thường.
- SMS nhắc lịch gửi tới số đó và **ghi tên người được hẹn** trong tin nhắn (vd. "Nhắc lịch cho bé An…").
- Khi trẻ có số riêng, lễ tân chỉ cần cập nhật SĐT; lịch sử khám không bị ảnh hưởng.

### Lý do
- Giữ được thói quen "đọc số điện thoại khi tới" ở quầy.
- Phản ánh đúng thực tế, không phải tạo số giả.
- Định danh bằng mã bệnh nhân thì không bao giờ mơ hồ, nên hóa đơn, công nợ và lịch sử luôn gắn đúng người.

> Luật "nhận biết bệnh nhân bằng SĐT" được hiểu lại thành: **tra cứu** bằng SĐT, **xác định** bằng mã bệnh nhân.

---

## QĐ3 — Giảm giá ghi ở tổng hay ở từng dòng

### Hiện trạng
Có hóa đơn ghi giảm giá ở tổng, có hóa đơn ghi ở từng dòng dịch vụ. Nếu chỉ giảm ở tổng thì không biết dịch vụ nào, bác sĩ nào bị giảm, nên báo cáo doanh thu theo bác sĩ sẽ sai.

### Các phương án đã cân nhắc
| Phương án | Nhược điểm |
|---|---|
| A. Chỉ cho giảm ở từng dòng | Lễ tân phải tự chia khi khách được giảm chung (vd. "bớt 200k cả hóa đơn"). |
| B. Chỉ cho giảm ở tổng | Báo cáo theo bác sĩ hoặc dịch vụ không biết trừ vào đâu. |
| C. Lưu cả hai, khi làm báo cáo mới phân bổ | Mỗi báo cáo phải tự tính lại, dễ lệch nhau giữa các báo cáo. |
| **D. Cho nhập cả hai; giảm ở tổng được phân bổ xuống dòng và lưu lại ngay khi chốt hóa đơn** | — |

### Lựa chọn: **D**
- `dong_hoa_don.don_gia`: giá chép từ bảng giá vào ngày làm, không đổi về sau.
- `dong_hoa_don.giam_gia_dong`: giảm riêng cho dòng (lễ tân nhập).
- `hoa_don.giam_gia_tong` và `hoa_don.ly_do_giam_gia`: số tiền giảm chung, đúng như khách thấy.
- `dong_hoa_don.giam_gia_phan_bo`: hệ thống tính khi chốt hóa đơn, bằng `giam_gia_tong` chia theo tỷ lệ thành tiền (sau giảm dòng) của từng dòng. Phần lẻ do làm tròn dồn vào dòng có giá trị lớn nhất.
- `dong_hoa_don.thanh_tien = don_gia × so_luong − giam_gia_dong − giam_gia_phan_bo`
- **Bất biến:** `hoa_don.tong_tien = Σ dong_hoa_don.thanh_tien`
- Lễ tân nhập giảm giá theo **%** hoặc theo **số tiền**; hệ thống luôn lưu thành **số tiền**. Mọi lần giảm đều ghi người áp dụng và lý do.

### Lý do
- Lễ tân giữ được cả hai cách làm quen thuộc.
- Mọi báo cáo theo bác sĩ hoặc dịch vụ đọc thẳng `thanh_tien` của dòng nên luôn khớp nhau và khớp với tổng hóa đơn.
- Hóa đơn in ra vẫn hiện đúng dòng "Giảm giá: 200.000đ" như khách đã thỏa thuận.
