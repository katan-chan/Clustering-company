1. Viết thêm một module mới (không sửa file corr.py) để mở rộng chức năng:

- Sử dụng lại các hàm có sẵn trong corr.py để tính toán và vẽ ma trận tương quan cho các chỉ số theo từng nhóm chỉ số trong file field_description.xlsx.
.

- Tổ chức code theo nguyên tắc SOLID: mỗi hàm chỉ làm một nhiệm vụ duy nhất (load dữ liệu, nhóm chỉ số, tính toán, vẽ, hiển thị).

- Kết quả cần được hiển thị trên web như một option mới bên cạnh cluster visualization và optimal k-value.

- Code phải dễ mở rộng: có thể thêm nhóm chỉ số mới hoặc thay đổi cách hiển thị mà không ảnh hưởng đến các phần khác. Bảo đảm tính dễ mở rộng (có thể thêm nhóm chỉ số hoặc phương pháp hiển thị khác mà không cần sửa toàn bộ code).