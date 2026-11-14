# Phân tích Use Case — Hệ thống quản lý Nha khoa Nụ Cười Việt

> Nguồn: ghi chép khảo sát phòng khám (quy mô, quy trình một lượt khám, luật đang theo, ba chỗ làm mỗi lần một kiểu, tám câu quản lý hỏi hằng tháng).
> Các lựa chọn cho ba chỗ làm mỗi lần một kiểu được ghi tại [database/quyet-dinh.md](../../../database/quyet-dinh.md).

---

## 1. Phạm vi hệ thống

Hệ thống web **nội bộ** thay cho:

| Đang dùng | Thay bằng chức năng |
|---|---|
| Sổ hẹn giấy A3 ở quầy | Lịch hẹn theo bác sĩ × ghế × khung 30 phút |
| File Excel bảng giá | Bảng giá có ngày hiệu lực, tự điền giá vào hóa đơn |
| Phiếu điều trị in sẵn, viết tay | Phiếu điều trị điện tử, ghi vết khi sửa |
| ~4.100 hồ sơ giấy từ 2019 | Hồ sơ bệnh nhân điện tử, chuyển dần từ giấy |
| Cộng tay, ghi nợ ở góc phiếu, đếm két | Hóa đơn, thu tiền nhiều lần, công nợ, chốt két |
| (chưa có) | Ca trực, kho thuốc & vật tư, báo cáo quản lý |

Số liệu kiểm tra: 8h–20h = 24 khung × 3 ghế = **72 khung/ngày** (khớp đề). Chủ nhật 8h–17h = 18 khung × 3 ghế = 54 khung.

---

## 2. Giả định (chỗ đề không nói)

| Mã | Giả định | Lý do |
|---|---|---|
| A01 | Hệ thống chỉ dành cho nhân viên đăng nhập. **Bệnh nhân không tự đặt lịch online** ở giai đoạn này; vẫn gọi điện cho lễ tân. | Đề mô tả bệnh nhân chỉ gọi điện, đọc SĐT, trả tiền. Cổng bệnh nhân để giai đoạn sau. |
| A02 | Bệnh nhân là **tác nhân phụ**: chỉ nhận tin nhắn nhắc lịch qua dịch vụ SMS bên ngoài. | Đề có bước "không nghe máy thì nhắn tin". |
| A03 | Một tài khoản có thể giữ nhiều vai trò (vd. quản lý kiêm bác sĩ). | Phòng khám nhỏ, thường kiêm nhiệm. |
| A04 | Quản lý tạo và phân quyền tài khoản nhân viên; không có vai trò "quản trị hệ thống" riêng. | Đề chỉ có bốn vai. |
| A05 | Mọi lượt khám đều gắn **một lịch hẹn**. Khách vãng lai được lễ tân tạo lịch ngay tại chỗ vào khung đang trống. | Giữ luật "một lịch = một bác sĩ, một ghế, một khung", để phiếu điều trị luôn có ngày/giờ/ghế và báo cáo công suất ghế được chính xác. |
| A06 | Một lịch hẹn đúng **một khung 30 phút** (theo luật). Việc cần lâu hơn thì lễ tân đặt nhiều lịch liền kề. | Tôn trọng luật đã cho, không tự đổi độ dài khung. |
| A07 | Ghế **không cố định theo bác sĩ**; ghế được chọn khi đặt lịch. | Đề: "tìm ô trống của bác sĩ đó, còn ghế thì nhận". |
| A08 | Khách có thể nói "bác sĩ nào cũng được"; khi đó hệ thống gợi ý mọi bác sĩ đang trực có khung trống. | Thường gặp ở quầy. |
| A09 | Ca trực gồm ngày + giờ bắt đầu/kết thúc. Quản lý xếp ca cho **bác sĩ** (bắt buộc để đặt lịch) và **lễ tân** (để chốt két theo ca). Bác sĩ bán thời gian chỉ có ca vào 3 ngày đã đăng ký. | Đề: "bác sĩ có ca trực theo ngày", "lễ tân chia ca sáng và chiều". |
| A10 | "Việc cần làm" khi đặt lịch được chọn từ **danh mục dịch vụ** (có thêm ghi chú tự do). | Cần để trả lời câu "việc gì hay bị hủy lịch nhất". |
| A11 | Trạng thái lịch hẹn: `Đã đặt → Đã nhắc → Đã đến → Đang khám → Hoàn thành`, hoặc `Đã hủy` / `Không đến`. | Phục vụ nhắc lịch, tiếp đón, báo cáo. |
| A12 | Hủy lịch ghi: **lý do** (chọn từ danh mục + ghi chú), **bên hủy** (bệnh nhân / phòng khám), **nhân viên thao tác**, **thời điểm**. | Luật "ai hủy" được hiểu là cả bên yêu cầu lẫn người bấm hủy. |
| A13 | Nhắc lịch: hệ thống lập danh sách lịch của ngày hôm sau. Lễ tân gọi và ghi kết quả; ai không nghe máy thì lễ tân bấm gửi SMS. Gọi điện vẫn làm thủ công. | Giữ đúng quy trình hiện tại, chỉ số hóa phần ghi nhận. |
| A14 | Ngày sinh là **bắt buộc** khi tạo bệnh nhân. | Để phân biệt người dùng chung SĐT và nhận biết trẻ dưới 15 tuổi. |
| A15 | Răng ghi theo **ký hiệu FDI** (11–48 răng vĩnh viễn, 51–85 răng sữa). Việc làm cho cả vùng thì dùng mã vùng: *hàm trên*, *hàm dưới*, *toàn hàm*. | Luật "mỗi việc phải ghi răng số mấy", nhưng có việc như cạo vôi làm cho cả hàm. |
| A16 | Ngày, giờ, ghế và bác sĩ của phiếu điều trị **lấy tự động từ lịch hẹn**. | Đỡ ghi lại, tránh sai. |
| A17 | Bác sĩ chỉ **ghi chỉ định tái khám** (sau bao lâu, làm việc gì). Lễ tân đặt lịch thật sự khi khách thanh toán ở quầy. | Đề: bác sĩ "hẹn buổi sau", lễ tân "ghi luôn vào sổ hẹn". |
| A18 | Phòng khám **có tủ thuốc**: thuốc kê được phát tại chỗ, tính tiền vào hóa đơn và trừ kho. | Câu hỏi "thuốc nào sắp hết" cho thấy phòng khám có tồn kho thuốc. |
| A19 | Mỗi dịch vụ có **định mức vật tư**. Khi hoàn tất phiếu, hệ thống gợi ý số vật tư đã dùng theo định mức; bác sĩ xác nhận hoặc sửa, rồi hệ thống trừ kho. | Đề không nói ai ghi vật tư. Cách này ít thao tác cho bác sĩ nhất. |
| A20 | Liệu trình (niềng, implant) có **giá trọn gói chốt lúc tạo**, số buổi dự kiến và kế hoạch các đợt thanh toán. Các buổi trong liệu trình **không tính tiền theo dòng**; tiền thu theo **hóa đơn từng đợt**. Việc làm thêm ngoài liệu trình tính tiền bình thường. | Đề: "gom thành một liệu trình, tiền trả theo đợt". |
| A21 | Giá trên dòng hóa đơn được **chép từ bảng giá có hiệu lực vào ngày làm** và không đổi về sau. Bảng giá không bao giờ ghi đè: đổi giá là thêm giá mới kèm ngày hiệu lực. | Luật "hóa đơn đã lập thì giữ nguyên giá lúc làm". |
| A22 | Mỗi lần thu tiền thuộc **đúng một hóa đơn** và không được vượt số còn nợ. Khách trả gộp nợ của nhiều hóa đơn thì hệ thống gợi ý chia vào các hóa đơn, cũ trước. | Để luôn biết từng hóa đơn còn nợ bao nhiêu. |
| A23 | Hóa đơn không bị xóa; chỉ được **hủy (có lý do)** khi chưa thu đồng nào. | Phục vụ đối soát. |
| A24 | Phiếu điều trị **sửa được các dòng dịch vụ** khi hóa đơn của phiếu chưa thu tiền. Sau đó chỉ sửa được chẩn đoán và ghi chú. Mọi lần sửa đều lưu người sửa, thời điểm, giá trị cũ và mới. | Luật "biết ai sửa, lúc nào", tránh lệch với hóa đơn đã thu. |
| A25 | Chốt két **theo ca lễ tân**. Chỉ đối soát tiền mặt; tiền chuyển khoản liệt kê để đối chiếu với sao kê ngân hàng (làm thủ công). | Đề: "đếm tiền trong két, so với các phiếu trong ngày". |
| A26 | **Không xóa cứng** bệnh nhân, phiếu điều trị hay hóa đơn; chỉ đánh dấu ngừng hoạt động. Dữ liệu giữ tối thiểu 5 năm kể từ lần khám cuối. | Luật giữ hồ sơ 5 năm. |
| A27 | Hồ sơ giấy cũ **chuyển dần**: khi bệnh nhân cũ quay lại lần đầu, lễ tân tạo hồ sơ và nhập thông tin hành chính, **ngày khám gần nhất**, ảnh scan phiếu cũ (không bắt buộc). Không nhập lại chi tiết điều trị cũ. | Nhập lại 4.100 hồ sơ cùng lúc là quá sức. Ngày khám gần nhất cần cho báo cáo "quá 6 tháng chưa quay lại". |
| A28 | **Doanh thu** = tổng thành tiền các dòng hóa đơn (sau giảm giá), tính theo ngày làm dịch vụ. **Thực thu** = tiền đã nhận. Báo cáo hiển thị cả hai. Doanh thu đợt liệu trình tính cho bác sĩ phụ trách liệu trình. | Đề không định nghĩa "làm ra bao nhiêu tiền". |
| A29 | "Chia tiền theo bác sĩ" = doanh thu của bác sĩ × **tỷ lệ ăn chia** do quản lý cấu hình cho từng bác sĩ. | Đề không cho công thức. |
| A30 | **Ghế trống** = khung giờ mở cửa không có lịch ở trạng thái *Đã đến / Đang khám / Hoàn thành*. Lịch bị hủy hoặc khách không đến vẫn tính là trống. | Phản ánh công suất ghế thực dùng. |
| A31 | **Quá 6 tháng chưa quay lại** = lần khám hoàn thành gần nhất (hoặc ngày khám gần nhất nhập từ hồ sơ giấy) cách hôm nay hơn 6 tháng và **không có lịch hẹn sắp tới**. | Đề không định nghĩa "quay lại". |
| A32 | Cảnh báo vật tư hoặc thuốc dưới ngưỡng hiển thị **trong hệ thống** cho quản lý (không gửi SMS hay email). | Giữ đơn giản cho giai đoạn đầu. |

---

## 3. Tác nhân

| Tác nhân | Loại | Mô tả |
|---|---|---|
| **Nhân viên** | Chính (trừu tượng) | Tác nhân cha của Lễ tân, Bác sĩ, Quản lý: đăng nhập, tra cứu bệnh nhân, xem lịch. |
| **Lễ tân** | Chính | Đặt, đổi, hủy lịch, nhắc lịch, tiếp đón, lập hóa đơn, thu tiền, chốt két. Hai người chia ca sáng và chiều. |
| **Bác sĩ** | Chính | Khám, lập phiếu điều trị, kê thuốc, quản lý liệu trình, ghi chỉ định tái khám. Có 4 bác sĩ, 1 người làm bán thời gian. |
| **Quản lý** | Chính | Xếp ca, sửa bảng giá, quản lý kho, quản lý tài khoản, xem báo cáo, chia tiền theo bác sĩ. |
| **Bệnh nhân** | Phụ | Không đăng nhập; nhận SMS nhắc lịch (A01, A02). |
| **Dịch vụ SMS** | Phụ (hệ thống ngoài) | Cổng gửi tin nhắn. |

Quan hệ kế thừa: `Lễ tân`, `Bác sĩ`, `Quản lý` ──▷ `Nhân viên`.

---

## 4. Danh sách use case

### A. Tài khoản
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC01 | Đăng nhập | Nhân viên | |
| UC02 | Đổi mật khẩu | Nhân viên | |
| UC03 | Quản lý tài khoản & phân quyền | Quản lý | A03, A04 |

### B. Bệnh nhân
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC04 | Tra cứu bệnh nhân (theo SĐT, tên, mã BN) | Nhân viên | Một SĐT có thể trả về nhiều người (QĐ2) |
| UC05 | Đăng ký bệnh nhân mới | Lễ tân | Cảnh báo khi SĐT đã có người dùng (QĐ2) |
| UC06 | Cập nhật thông tin bệnh nhân | Lễ tân | |
| UC07 | Xem hồ sơ bệnh nhân | Nhân viên | Bác sĩ và quản lý xem đủ bệnh án; lễ tân xem thông tin hành chính và công nợ |
| UC08 | Chuyển hồ sơ giấy sang hệ thống | Lễ tân | «extend» UC05 (A27) |

### C. Ca trực
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC09 | Xếp ca trực | Quản lý | A09 |
| UC10 | Xem lịch trực | Nhân viên | |

### D. Lịch hẹn
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC11 | Xem lịch hẹn (theo ngày / bác sĩ / ghế) | Nhân viên | Thay cho sổ hẹn A3 |
| UC12 | Tìm khung trống | Lễ tân | Chỉ trong ca trực của bác sĩ; bỏ khung đã bị ghế hoặc bác sĩ chiếm |
| UC13 | Đặt lịch hẹn | Lễ tân | «include» UC04, UC12 |
| UC14 | Đổi lịch hẹn | Lễ tân | «include» UC12 |
| UC15 | Hủy lịch hẹn | Lễ tân | Ghi lý do, bên hủy, người thao tác, thời điểm (A12) |
| UC16 | Nhắc lịch hẹn | Lễ tân | Danh sách lịch ngày mai, ghi kết quả gọi (A13) |
| UC17 | Gửi tin nhắn nhắc lịch | Lễ tân → Dịch vụ SMS → Bệnh nhân | «extend» UC16 khi khách không nghe máy |
| UC18 | Tiếp đón bệnh nhân (check-in) | Lễ tân | «include» UC04 |
| UC19 | Ghi nhận bệnh nhân không đến | Lễ tân | |

### E. Khám & điều trị
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC20 | Xem danh sách chờ khám | Bác sĩ | Các bệnh nhân đã check-in của mình |
| UC21 | Lập phiếu điều trị | Bác sĩ | «include» UC07, UC26. Mỗi dòng: dịch vụ + răng (A15) |
| UC22 | Kê đơn thuốc | Bác sĩ | «extend» UC21. Tên thuốc, liều dùng, số lượng |
| UC23 | Gắn dòng điều trị vào liệu trình | Bác sĩ | «extend» UC21. Ghi buổi thứ mấy |
| UC24 | Tạo liệu trình | Bác sĩ | «extend» UC23 khi chưa có liệu trình. Số buổi, giá trọn gói, các đợt (A20) |
| UC25 | Thêm bác sĩ cùng thực hiện | Bác sĩ | «extend» UC21 (QĐ1) |
| UC26 | Ghi nhận vật tư sử dụng | Bác sĩ | Gợi ý theo định mức, trừ kho (A19) |
| UC27 | Ghi chỉ định tái khám | Bác sĩ | «extend» UC21 (A17) |
| UC28 | Sửa phiếu điều trị | Bác sĩ, Quản lý | Lưu lịch sử sửa (A24) |
| UC29 | Xem lịch sử chỉnh sửa phiếu | Quản lý | |

### F. Thanh toán
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC30 | Tra cứu bảng giá | Lễ tân, Bác sĩ | |
| UC31 | Lập hóa đơn lượt khám | Lễ tân | Lấy từ phiếu điều trị; giá chốt theo ngày làm (A21) |
| UC32 | Áp dụng giảm giá | Lễ tân | «extend» UC31, UC33. Giảm theo dòng hoặc theo tổng (QĐ3) |
| UC33 | Lập hóa đơn đợt liệu trình | Lễ tân | A20 |
| UC34 | Thu tiền | Lễ tân | Thu nhiều lần, tiền mặt hoặc chuyển khoản (A22) |
| UC35 | In hóa đơn / biên lai | Lễ tân | «extend» UC34 |
| UC36 | Xem công nợ bệnh nhân | Lễ tân, Quản lý | |
| UC37 | Chốt két cuối ca | Lễ tân | A25 |

### G. Danh mục & kho
| Mã | Use case | Tác nhân | Ghi chú |
|---|---|---|---|
| UC38 | Quản lý bảng giá dịch vụ | Quản lý | Thêm giá mới kèm ngày hiệu lực (A21) |
| UC39 | Quản lý danh mục thuốc & vật tư | Quản lý | Ngưỡng tối thiểu, định mức theo dịch vụ |
| UC40 | Nhập kho | Quản lý | |
| UC41 | Kiểm kê & điều chỉnh tồn | Quản lý | |
| UC42 | Nhận cảnh báo dưới ngưỡng | Quản lý | «extend» UC26, UC22 khi tồn < ngưỡng (A32) |
| UC43 | Quản lý danh mục chung | Quản lý | Ghế, lý do hủy, giờ mở cửa, tỷ lệ ăn chia |

### H. Báo cáo & tài chính
| Mã | Use case | Tác nhân | Trả lời câu hỏi |
|---|---|---|---|
| UC44 | Tính chia tiền theo bác sĩ | Quản lý | "chia tiền theo bác sĩ" (A29) |
| UC45 | Xem báo cáo quản trị *(UC cha)* | Quản lý | |
| UC45.1 | Doanh thu theo bác sĩ trong tháng | Quản lý | Câu 1 |
| UC45.2 | Công suất ghế theo khung giờ | Quản lý | Câu 2 (A30) |
| UC45.3 | Bệnh nhân quá 6 tháng chưa quay lại | Quản lý | Câu 3 (A31) |
| UC45.4 | Thống kê hủy lịch theo dịch vụ & lý do | Quản lý | Câu 4 (A10, A12) |
| UC45.5 | Công nợ theo bệnh nhân | Quản lý | Câu 5 |
| UC45.6 | Liệu trình đang dở & số buổi còn lại | Quản lý | Câu 6 |
| UC45.7 | Thuốc & vật tư sắp hết | Quản lý | Câu 7 |
| UC45.8 | So sánh doanh thu với tháng trước (%) | Quản lý | Câu 8 (A28) |
| UC46 | Xem lịch sử chốt két | Quản lý | |

---

## 5. Sơ đồ use case (PlantUML)

> Mỗi sơ đồ là một file riêng trong [diagrams/](diagrams/). Xem trong VS Code: mở file `.puml` rồi nhấn **Alt+D** (cần extension *PlantUML*).

| File | Nội dung | Use case |
|---|---|---|
| [01-tong-quan.puml](diagrams/01-tong-quan.puml) | Tác nhân và 7 nhóm chức năng | — |
| [02-benh-nhan-lich-hen.puml](diagrams/02-benh-nhan-lich-hen.puml) | Quản lý bệnh nhân, lịch hẹn & ca trực | UC04–UC19 |
| [03-kham-dieu-tri.puml](diagrams/03-kham-dieu-tri.puml) | Khám & điều trị | UC20–UC29, UC42 |
| [04-thanh-toan.puml](diagrams/04-thanh-toan.puml) | Thanh toán | UC30–UC37 |
| [05-quan-tri-bao-cao.puml](diagrams/05-quan-tri-bao-cao.puml) | Đăng nhập, quản trị hệ thống & báo cáo | UC01–UC03, UC38–UC46 |

### Tác nhân × nhóm chức năng (sơ đồ tổng quan)

| Nhóm chức năng | Nhân viên | Lễ tân | Bác sĩ | Quản lý | Bệnh nhân | Dịch vụ SMS |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Đăng nhập | ● | | | | | |
| Quản lý bệnh nhân | | ● | ● | | | |
| Quản lý lịch hẹn & ca trực | | ● | | ● | ● | ● |
| Khám & điều trị | | | ● | ● | | |
| Thanh toán | | ● | ● | ● | | |
| Quản trị hệ thống | | | | ● | | |
| Xem báo cáo | | | | ● | | |

---

## 6. Đặc tả tóm tắt các use case cốt lõi

### UC13 — Đặt lịch hẹn
- **Tác nhân:** Lễ tân
- **Tiền điều kiện:** Đã đăng nhập; bác sĩ được chọn có ca trực vào ngày cần đặt.
- **Luồng chính:**
  1. Khách gọi điện, nói việc cần làm và bác sĩ muốn gặp (hoặc "ai cũng được").
  2. Lễ tân tìm bệnh nhân theo SĐT (UC04). Nếu SĐT có nhiều người dùng chung thì chọn theo tên và ngày sinh.
  3. Lễ tân chọn dịch vụ dự kiến, bác sĩ và ngày → hệ thống hiện các khung trống (UC12).
  4. Lễ tân chọn khung → hệ thống gợi ý ghế còn trống → lễ tân xác nhận.
  5. Hệ thống lưu lịch hẹn ở trạng thái *Đã đặt*.
- **Luồng rẽ:**
  - 2a. Không tìm thấy bệnh nhân → Đăng ký bệnh nhân mới (UC05).
  - 3a. Bác sĩ không trực hoặc hết khung → gợi ý ngày khác hoặc bác sĩ khác.
- **Luật:** một lịch = 1 bác sĩ + 1 ghế + 1 khung 30 phút; không trùng ghế, không trùng bác sĩ cùng khung; chỉ đặt trong ca trực của bác sĩ và giờ mở cửa.

### UC15 — Hủy lịch hẹn
- **Tác nhân:** Lễ tân
- **Luồng chính:** chọn lịch → chọn lý do (danh mục) và ghi chú → chọn bên hủy (bệnh nhân / phòng khám) → xác nhận. Hệ thống tự ghi nhân viên thao tác và thời điểm, rồi giải phóng khung.
- **Luật:** không xóa lịch; chỉ hủy được lịch ở trạng thái *Đã đặt* hoặc *Đã nhắc*.

### UC21 — Lập phiếu điều trị
- **Tác nhân:** Bác sĩ
- **Tiền điều kiện:** Lịch hẹn ở trạng thái *Đã đến*.
- **Luồng chính:**
  1. Bác sĩ chọn bệnh nhân trong danh sách chờ (UC20); hệ thống mở hồ sơ (UC07) và tạo phiếu, tự điền ngày, giờ, ghế, bác sĩ từ lịch hẹn.
  2. Bác sĩ ghi chẩn đoán.
  3. Với mỗi việc đã làm: chọn dịch vụ và răng (FDI hoặc mã vùng). Bác sĩ thực hiện mặc định là chính mình.
  4. (Tùy chọn) kê thuốc (UC22); gắn dòng vào liệu trình và ghi buổi thứ mấy (UC23/UC24); thêm bác sĩ cùng thực hiện (UC25); ghi chỉ định tái khám (UC27).
  5. Bác sĩ xác nhận vật tư đã dùng (UC26); hệ thống trừ kho và báo nếu tồn xuống dưới ngưỡng.
  6. Bác sĩ hoàn tất phiếu → lịch hẹn chuyển sang *Hoàn thành*, phiếu sẵn sàng để lập hóa đơn.
- **Luật:** phiếu có ít nhất một dòng; dòng nào cũng phải có răng hoặc vùng.

### UC31 — Lập hóa đơn lượt khám
- **Tác nhân:** Lễ tân
- **Luồng chính:** chọn phiếu điều trị đã hoàn tất → hệ thống tạo dòng hóa đơn cho từng dòng điều trị **không thuộc liệu trình** và từng loại thuốc đã kê, giá lấy theo bảng giá có hiệu lực vào ngày làm → (tùy chọn) giảm giá (UC32) → hệ thống tính tổng → lưu hóa đơn.
- **Luật:** giá đã chốt thì không đổi khi bảng giá đổi; tổng hóa đơn luôn bằng tổng thành tiền các dòng (QĐ3).

### UC34 — Thu tiền
- **Tác nhân:** Lễ tân
- **Luồng chính:** chọn hóa đơn còn nợ → nhập số tiền và hình thức (tiền mặt / chuyển khoản) → hệ thống ghi lần thu (người thu, thời điểm, ca) và cập nhật số còn nợ → (tùy chọn) in biên lai (UC35) → nếu phiếu có chỉ định tái khám thì đặt lịch luôn (UC13).
- **Luật:** số tiền thu ≤ số còn nợ; còn nợ = tổng hóa đơn − tổng các lần thu.

### UC37 — Chốt két cuối ca
- **Tác nhân:** Lễ tân
- **Luồng chính:** hệ thống tính tổng tiền mặt đã thu trong ca → lễ tân nhập số tiền đếm được trong két → hệ thống ghi chênh lệch (nếu có) và yêu cầu lễ tân ghi chú giải thích → khóa ca. Danh sách chuyển khoản trong ca được in riêng để đối chiếu.

---

## 7. Truy vết

### 7.1 Luật phòng khám → use case

| Luật | Use case đáp ứng |
|---|---|
| Nhận biết bệnh nhân bằng SĐT; trùng tên là thường | UC04, UC05 (QĐ2) |
| Lịch = 1 bác sĩ, 1 ghế, 1 khung 30 phút | UC12, UC13, UC14 |
| Không trùng ghế / bác sĩ cùng giờ | UC12 |
| Một lần khám nhiều việc, mỗi việc ghi răng | UC21 |
| Bảng giá đổi theo thời gian; hóa đơn giữ giá lúc làm | UC38, UC31 |
| Liệu trình nhiều buổi, trả theo đợt | UC23, UC24, UC33 |
| Thuốc kê theo lần khám, ghi liều và số lượng | UC22 |
| Hóa đơn thu nhiều lần, tiền mặt hoặc chuyển khoản | UC34 |
| Luôn biết hóa đơn còn nợ bao nhiêu | UC34, UC36 |
| Hủy lịch ghi lý do, ai hủy, lúc nào | UC15 |
| Lịch chỉ xếp vào ca bác sĩ trực | UC09, UC12 |
| Giữ hồ sơ 5 năm | A26 (áp dụng cho mọi UC: không xóa cứng) |
| Sửa phiếu phải biết ai sửa, lúc nào | UC28, UC29 |
| Vật tư trừ khi dùng; dưới ngưỡng phải báo | UC26, UC42 |

### 7.2 Tám câu hỏi của quản lý → use case → dữ liệu cần có

| # | Câu hỏi | Use case | Dữ liệu phải ghi từ trước |
|---|---|---|---|
| 1 | Mỗi bác sĩ làm ra bao nhiêu tiền | UC45.1, UC44 | Bác sĩ thực hiện trên từng dòng (QĐ1), giảm giá phân bổ xuống dòng (QĐ3) |
| 2 | Ghế nào trống nhiều nhất, khung giờ nào | UC45.2 | Lịch hẹn có ghế, khung, trạng thái; giờ mở cửa |
| 3 | Bệnh nhân quá 6 tháng chưa quay lại | UC45.3 | Ngày khám hoàn thành gần nhất, ngày khám gần nhất từ hồ sơ giấy (A27) |
| 4 | Việc gì hay bị hủy, vì lý do gì | UC45.4 | Dịch vụ dự kiến trên lịch (A10), lý do hủy theo danh mục (A12) |
| 5 | Tổng nợ, chia theo từng người | UC45.5 | Hóa đơn và các lần thu |
| 6 | Liệu trình nào đang dở, còn mấy buổi | UC45.6 | Số buổi dự kiến, các dòng điều trị đã gắn liệu trình |
| 7 | Thuốc hoặc vật tư nào sắp hết | UC45.7 | Tồn kho, ngưỡng tối thiểu |
| 8 | Doanh thu tăng hay giảm bao nhiêu % so với tháng trước | UC45.8 | Như câu 1, theo định nghĩa A28 |

---

## 8. Ngoài phạm vi giai đoạn này

- Bệnh nhân tự đặt lịch online, cổng hoặc ứng dụng cho bệnh nhân.
- Gửi tin qua Zalo, email; tự động gọi điện.
- Hóa đơn điện tử VAT, tích hợp cổng thanh toán, bảo hiểm.
- Tính lương nhân viên (chỉ tính phần chia doanh thu của bác sĩ).
- Lưu trữ ảnh X-quang, sơ đồ răng dạng hình vẽ.
- Nhiều chi nhánh.
- Tự động xóa hồ sơ hết hạn lưu trữ.
