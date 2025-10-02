# 📋 HƯỚNG DẪN SỬ DỤNG WEB PHÂN TÍCH DOANH NGHIỆP

## 🎯 TỔNG QUAN DỰ ÁN

**Web-App Phân Cụm & Đánh Giá Doanh Nghiệp** là một hệ thống phân tích dữ liệu chuyên dụng giúp:
- **Phân cụm doanh nghiệp** dựa trên dữ liệu tài chính và embedding
- **Đánh giá xếp hạng** doanh nghiệp theo các chỉ số tài chính  
- **Tính điểm tier** (T1-T8) cho từng chỉ số của doanh nghiệp
- **Trực quan hóa dữ liệu** bằng biểu đồ PCA 2D, scatter plot
- **Xuất báo cáo** định dạng CSV, Excel cho phân tích tiếp

---

## 🚀 KHỞI ĐỘNG WEB

### Bước 1: Mở Web
1. Mở trình duyệt (Chrome, Firefox, Edge...)
2. Truy cập địa chỉ web: `http://localhost:3000` (hoặc địa chỉ được cung cấp)
3. Web sẽ tự động tải và hiển thị trang chủ

### Bước 2: Hiểu Giao Diện Chính
Web có **5 tabs chính** ở phía trên:

🔸 **Cluster Visualization** - Phân cụm doanh nghiệp  
🔸 **Test Real Data** - Kiểm tra dữ liệu thực  
🔸 **Optimal K-Value** - Tìm số cụm tối ưu  
🔸 **Company Rating** - Đánh giá xếp hạng doanh nghiệp  
🔸 **Company Scoring** - Tính điểm tier cho doanh nghiệp  

---

## 📊 PHẦN 1: PHÂN CỤM DOANH NGHIỆP (CLUSTERING)

### A. Chuẩn Bị Dữ Liệu

**Cần 2 file dữ liệu:**
1. **File Embedding** (.csv/.txt): Chứa vector đặc trưng của doanh nghiệp
2. **File Info** (.csv/.txt): Chứa thông tin bổ sung (sector, quy mô...)

**Format File Embedding:**
```csv
id,feature_1,feature_2,feature_3,...,feature_n
COMP001,0.123,0.456,0.789,...,0.321
COMP002,0.234,0.567,0.890,...,0.432
```

**Format File Info:**
```csv
id,sector,size,revenue,employees
COMP001,Manufacturing,Large,1000000,500
COMP002,Technology,Medium,500000,200
```

### B. Thực Hiện Phân Cụm

#### Bước 1: Upload File Dữ Liệu
1. Ở tab **"Cluster Visualization"**, tìm sidebar bên trái
2. Kéo thả hoặc click vào vùng **"Embeddings file"**
3. Chọn file embedding từ máy tính
4. Kéo thả hoặc click vào vùng **"Info file"**  
5. Chọn file info từ máy tính
6. Web sẽ tự động:
   - Phát hiện delimiter (dấu phân cách: `,` hoặc tab)
   - Hiển thị preview 20 dòng đầu
   - Kiểm tra tính hợp lệ của dữ liệu

#### Bước 2: Cấu Hình Tham Số
**Lambda (λ):**
- Nhập số thực > 0 (ví dụ: 0.5)
- Điều chỉnh tỷ trọng giữa embedding và info data

**K (số cụm):**
- Nhập số nguyên ≥ 2 (ví dụ: 8)
- Số lượng cụm muốn chia

#### Bước 3: Cấu Hình API
1. Nhập **Endpoint URL** của API clustering
2. Nhập **API Key** (nếu có)
3. Click **"Test Connection"** để kiểm tra kết nối

#### Bước 4: Chạy Phân Cụm  
1. Click nút **"Run Clustering Analysis"**
2. Theo dõi thanh tiến trình:
   - ✅ Files processed (20%)
   - ✅ PCA computation completed (60%)  
   - ✅ Running clustering API... (90%)
3. Đợi kết quả (thường 30s - 2 phút)

### C. Xem Kết Quả Phân Cụm

#### Scatter Plot 2D
- **Mỗi điểm** = 1 doanh nghiệp
- **Màu sắc** = nhãn cụm (cluster label)
- **Hover tooltip** hiển thị: ID, sector, tọa độ PCA

#### Tương Tác Với Biểu Đồ
- **Zoom**: Cuộn chuột để phóng to/thu nhỏ
- **Pan**: Kéo thả để di chuyển
- **Filter**: Click legend để ẩn/hiện cụm
- **Lasso**: Chọn nhiều điểm bằng công cụ lasso

#### Xuất Dữ Liệu
1. Click nút **"Export CSV"** - xuất dữ liệu định dạng CSV
2. Click nút **"Export Image"** - xuất biểu đồ PNG/SVG
3. File sẽ tự động tải về máy tính

---

## 🏆 PHẦN 2: ĐÁNH GIÁ XẾP HẠNG DOANH NGHIỆP (COMPANY RATING)

### A. Kích Hoạt Company Rating
1. Click tab **"Company Rating"** ở phía trên
2. Sidebar bên trái sẽ hiển thị bảng điều khiển Rating

### B. Cấu Hình API Rating
1. **Nhập Rating API URL:**
   ```
   https://rating-api.example.com
   ```
2. Click **"Connect"** để kết nối
3. Trạng thái kết nối sẽ hiển thị:
   - 🟢 **Connected** - Kết nối thành công
   - 🔴 **Disconnected** - Lỗi kết nối
   - 🟡 **Checking** - Đang kiểm tra

### C. Chọn Chỉ Số Phân Tích

#### Chế Độ Individual (Chỉ số đơn lẻ)
1. Chọn **"Individual"** mode
2. Trong dropdown **"Select Indicators"**:
   - Chọn 1 hoặc nhiều chỉ số tài chính (VD: STD_RTD97, STD_RTD71)
   - Mỗi chỉ số có mô tả chi tiết

#### Chế Độ Group (Nhóm chỉ số)  
1. Chọn **"Group"** mode
2. Click **"Add Group"** để tạo nhóm
3. Chọn nhiều chỉ số cho mỗi nhóm
4. Điều chỉnh trọng số (weight) cho từng nhóm

### D. Cấu Hình Phân Tích

#### Chọn Sector (Ngành)
- Dropdown hiển thị các mã ngành: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T
- Mỗi mã có tên đầy đủ (VD: G - BÁN BUÔN VÀ BÁN LẺ...)

#### Cấu Hình Clustering
- **Algorithm**: KMeans, DBSCAN, MeanShift
- **K value**: Số cụm (mặc định: 8)

### E. Chạy Phân Tích Rating
1. Click **"Generate Company Rating"**
2. Đợi API xử lý (30s - 1 phút)
3. Kết quả hiển thị dưới dạng:
   - **Biểu đồ phân phối Tier** (T1-T8)
   - **Bảng chi tiết** các doanh nghiệp
   - **Thống kê** theo từng tier

### F. Xem Chi Tiết Kết Quả

#### Biểu Đồ Tier Distribution
- **Trục X**: Các tier (T1, T2, ..., T8)
- **Trục Y**: Số lượng doanh nghiệp
- **Màu sắc**: Phân biệt các tier
- **Click vào cột** để xem chi tiết

#### Bảng Doanh Nghiệp
| Tax Code | Sector | Tier | Score | Risk Level |
|----------|--------|------|-------|------------|
| 0100100001 | G | T2 | 85.5 | Low |
| 0100100002 | A | T5 | 45.2 | High |

#### Xuất Báo Cáo Rating
1. Click **"Export Rating Report"**
2. Chọn định dạng: CSV hoặc Excel
3. File chứa đầy đủ thông tin tier, score, risk level

---

## 💯 PHẦN 3: TÍNH ĐIỂM TIER CHO DOANH NGHIỆP (COMPANY SCORING)

### A. Kích Hoạt Company Scoring
1. Click tab **"Company Scoring"** ở phía trên  
2. Sidebar hiển thị 2 phần chính:
   - **Single Company Scoring** - Tính điểm 1 doanh nghiệp
   - **Bulk Company Scoring** - Tính điểm hàng loạt từ CSV

### B. Cấu Hình API Scoring
1. **Nhập Scoring API URL:**
   ```
   https://scoring-api.example.com
   ```
2. Click **"Connect"**
3. Kiểm tra trạng thái kết nối
4. Click **"Test API"** để thử nghiệm

### C. Tính Điểm Đơn Lẻ (Single Company)

#### Bước 1: Nhập Thông Tin Cơ Bản
```
Tax Code: 0100100008
Sector: G
```

#### Bước 2: Thêm Chỉ Số Tài Chính
1. Click **"+ Add Feature"** 
2. Nhập tên chỉ số (VD: STD_RTD97)
3. Nhập giá trị số (VD: 6.686)
4. Lặp lại cho các chỉ số khác

**Hoặc sử dụng dữ liệu mẫu:**
- Click **"📊 Load Sample"** - tải dữ liệu mẫu
- Click **"🎭 Test Results"** - xem kết quả mẫu

#### Bước 3: Tính Điểm
1. Click **"Calculate Score"**
2. Đợi API xử lý
3. Xem kết quả trong bảng bên phải

#### Kết Quả Single Scoring
```
Company: 0100100008 (Sector: G)
┌─────────────┬──────┐
│ Indicator   │ Tier │
├─────────────┼──────┤
│ STD_RTD97   │ T2   │
│ STD_RTD71   │ T4   │ 
│ STD_RTD146  │ T1   │
└─────────────┴──────┘
Tier Distribution: T1(1), T2(1), T4(1)
```

### D. Tính Điểm Hàng Loạt (Bulk CSV)

#### Bước 1: Chuẩn Bị File CSV
**Format CSV yêu cầu:**
```csv
taxcode,sector_unique_id,empl_qtty,yearreport,length_report,STD_RTD146,STD_RTD71,STD_RTD96,STD_RTD97,STD_RTD98,...
0100100008,G,6132,2023,12,0.178,0.374,4.596,6.686,-0.210,...
0100100009,A,3500,2023,11,0.200,0.500,3.200,5.400,-0.150,...
```

#### Bước 2: Upload CSV
1. Click vùng **"Drop CSV file here"**
2. Chọn file CSV từ máy tính
3. Web tự động:
   - Phát hiện format (comma/tab separated)
   - Parse và validate dữ liệu
   - Hiển thị số lượng doanh nghiệp đã tải

#### Bước 3: Xử Lý Hàng Loạt
1. Click **"📊 Score X Companies"**
2. Theo dõi tiến trình processing
3. Đợi hoàn thành (có thể 2-5 phút cho file lớn)

#### Kết Quả Bulk Scoring
**Bảng kết quả:**
| TaxCode | Sector | Cluster | STD_RTD97 | STD_RTD71 | STD_RTD146 | ... |
|---------|--------|---------|-----------|-----------|------------|-----|
| 0100100008 | G | - | T2 | T4 | T1 | ... |
| 0100100009 | A | - | T3 | T2 | T2 | ... |

**Thống kê:**
- 📊 Total Companies: 150
- ✅ Successfully Scored: 148  
- ❌ Failed: 2
- 📈 Indicators Processed: 25

#### Xuất Kết Quả Bulk
1. **📄 CSV (Comma)** - xuất định dạng comma-separated
2. **📄 CSV (Tab)** - xuất định dạng tab-separated  
3. **📊 Export Excel** - xuất định dạng Excel (.xlsx)

---

## 🔧 PHẦN 4: TÍNH NĂNG BỔ SUNG

### A. Mock Test Panel
1. Click nút **"Mock Test"** ở góc phải sidebar
2. Truy cập `/mock-test` để test API không cần dữ liệu thật

### B. Optimal K-Value  
1. Tab **"Optimal K-Value"** giúp tìm số cụm tối ưu
2. Hiển thị:
   - **Elbow Method** chart
   - **Silhouette Score** chart
   - Khuyến nghị K value tốt nhất

### C. Test Real Data
1. Tab **"Test Real Data"** để kiểm tra dữ liệu thực
2. Upload file và xem preview chi tiết
3. Validate format trước khi chạy clustering

---

## ⚠️ XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi Upload File
**Hiện tượng:** "File format not supported"  
**Giải pháp:**
- Đảm bảo file .csv hoặc .txt
- Kiểm tra encoding UTF-8
- Đảm bảo có header row

**Hiện tượng:** "ID mismatch between files"  
**Giải pháp:**
- Cột ID trong 2 file phải trùng tên
- Kiểm tra có dữ liệu trùng lặp
- Đảm bảo ít nhất 50% ID trùng khớp

### Lỗi API Connection
**Hiện tượng:** "Connection failed"  
**Giải pháp:**
- Kiểm tra URL API đúng format
- Đảm bảo API server đang chạy
- Kiểm tra CORS settings
- Thử API test endpoint

**Hiện tượng:** "API key invalid"  
**Giải pháp:**
- Kiểm tra API key chính xác
- Đảm bảo key chưa expire
- Liên hệ admin để cấp key mới

### Lỗi Clustering
**Hiện tượng:** "Clustering failed"  
**Giải pháp:**
- Kiểm tra lambda > 0
- Kiểm tra k ≥ 2
- Đảm bảo đủ dữ liệu (ít nhất 100 samples)
- Thử giảm k value

### Lỗi Scoring
**Hiện tượng:** "Invalid indicator values"  
**Giải pháp:**
- Đảm bảo tất cả values là số
- Không để trống indicator name
- Kiểm tra range hợp lý của values

**Hiện tượng:** "No scoring results"  
**Giải pháp:**
- Kiểm tra API scoring endpoint
- Đảm bảo có ít nhất 1 indicator
- Kiểm tra taxcode format đúng

---

## 📈 PHẦN 5: HIỂU KẾT QUẢ PHÂN TÍCH

### A. Tier System (T1-T8)
**Ý nghĩa các Tier:**
- **T1-T2**: 🟢 **Tốt** - Hiệu suất cao, rủi ro thấp
- **T3-T5**: 🟡 **Trung bình** - Hiệu suất ổn định
- **T6-T8**: 🔴 **Kém** - Hiệu suất thấp, rủi ro cao

**Màu sắc Badge:**
- 🟢 **Green** - T1, T2 (Good performance)
- 🟡 **Yellow** - T3, T4, T5 (Medium performance)  
- 🔴 **Red** - T6, T7, T8 (Poor performance)

### B. Chỉ Số Tài Chính (Financial Indicators)
**Các nhóm chỉ số chính:**
- **STD_RTD1-99**: Chỉ số tài chính chuẩn hóa
- **empl_qtty**: Số lượng nhân viên
- **yearreport**: Năm báo cáo
- **length_report**: Độ dài báo cáo

### C. Cluster Analysis
**Phân tích kết quả clustering:**
- **Cluster 0,1,2...**: Các nhóm doanh nghiệp tương đồng
- **PCA coordinates**: Tọa độ sau giảm chiều
- **Sector distribution**: Phân bố theo ngành
- **Size pattern**: Mẫu phân bố quy mô

---

## 💡 PHẦN 6: TIPS & BEST PRACTICES

### A. Chuẩn Bị Dữ Liệu Tốt
1. **Làm sạch dữ liệu** trước khi upload:
   - Loại bỏ missing values
   - Chuẩn hóa format ngày tháng
   - Kiểm tra outliers

2. **Đảm bảo quality**:
   - ID column phải unique
   - Numeric columns không chứa text
   - File size < 50MB để tải nhanh

### B. Tối Ưu Performance
1. **File size**: Nên chia nhỏ file lớn (>10,000 rows)
2. **Network**: Đảm bảo kết nối internet ổn định
3. **Browser**: Sử dụng Chrome/Firefox phiên bản mới
4. **Memory**: Đóng các tab không cần thiết

### C. Backup & Export
1. **Export thường xuyên** để backup kết quả
2. **Save session config** trước khi đóng browser
3. **Screenshot biểu đồ** quan trọng
4. **Note down** API endpoints và settings

### D. Troubleshooting
1. **F12 Console** để xem lỗi technical
2. **Network tab** để debug API calls
3. **Clear cache** nếu web không load
4. **Try incognito mode** nếu có lỗi cache

---

## 📞 HỖ TRỢ & LIÊN HỆ

### Khi Cần Hỗ Trợ:
1. **Chụp screenshot** màn hình lỗi
2. **Copy error message** từ console (F12)
3. **Note down** các bước đã thực hiện
4. **Cung cấp** sample data gây lỗi

### Thông Tin Technical:
- **Framework**: React + TypeScript
- **Charts**: Plotly.js
- **UI Library**: shadcn/ui + Tailwind
- **Backend**: API RESTful
- **Browser Support**: Chrome 90+, Firefox 88+, Edge 90+

---

## 🎉 KẾT LUẬN

Web này là công cụ mạnh mẽ để:
- ✅ **Phân cụm** doanh nghiệp dựa trên đặc trưng tài chính
- ✅ **Đánh giá & xếp hạng** hiệu suất doanh nghiệp  
- ✅ **Tính điểm tier** chi tiết cho từng chỉ số
- ✅ **Trực quan hóa** dữ liệu phức tạp
- ✅ **Xuất báo cáo** chuyên nghiệp

**Chúc bạn sử dụng web hiệu quả! 🚀**

---

*Tài liệu này được cập nhật thường xuyên. Phiên bản mới nhất luôn có trên trang web.*