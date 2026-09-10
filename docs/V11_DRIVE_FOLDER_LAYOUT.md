# Drive folder layout

Root: `HIU YHCT 4.0 / NGÂN HÀNG TRẮC NGHIỆM`

Input: `00_DOCX_MỚI_CHỜ_XỬ_LÝ`

Subject folders currently provisioned:
- 01_LÝ LUẬN CƠ BẢN YHCT
- 02_GIẢI PHẪU
- 03_SINH LÝ
- 04_MÔ PHÔI
- 05_HÓA HỌC - HÓA HỮU CƠ
- 06_DƯỢC LÝ
- 07_BỆNH HỌC ĐÔNG - TÂY Y
- 08_PHƯƠNG TỄ - DƯỢC LIỆU
- 09_CHÂM CỨU - KINH LẠC
- 10_DINH DƯỠNG - Y HỌC CƠ SỞ
- 99_MÔN KHÁC

Processing/audit folders:
- 01_ĐÃ_TRÍCH_XUẤT_CÂU_HỎI
- 02_TÀI_LIỆU_ĐÃ_XỬ_LÝ
- 99_CẦN_DUYỆT_THỦ_CÔNG

V11 reads DOCX directly under the input folder or one subject-folder level below it. It does not move/delete source files; processing state is stored in Supabase to preserve Drive as immutable provenance.
