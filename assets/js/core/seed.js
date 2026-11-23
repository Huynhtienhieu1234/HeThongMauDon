import { db } from './database.js';
import { todayISO } from '../utils/helpers.js';

export const BM11_TEMPLATE_ID = 'tpl_bm11_diem_i';
export const DEFAULT_FOLDER_ID = 'fld_dttx_2026';
const BUILTIN_TEMPLATE_VERSION = 5; // v5: Đồng bộ căn chỉnh khối chữ ký trên toàn bộ 8 mẫu DOCX

export const BM11_FIELDS = [
  { id: 'f_ho_ten', label: 'Họ và tên sinh viên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: 'Nhập đầy đủ họ tên có dấu (VD: Nguyễn Văn An)' },
  { id: 'f_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: 'VD: 0023410123' },
  { id: 'f_dien_thoai', label: 'Số điện thoại', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: 'Số điện thoại liên hệ của sinh viên' },
  { id: 'f_email', label: 'Email', varName: 'email', type: 'text', required: true, defaultValue: '', hint: 'VD: nguyenvanan@student.dthu.edu.vn' },
  { id: 'f_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: 'VD: ĐHGDTH23A - TX' },
  { id: 'f_khoa', label: 'Khoa', varName: 'khoa', type: 'text', required: true, defaultValue: '', hint: 'VD: Khoa Giáo dục Tiểu học - Mầm non' },
  { id: 'f_dia_diem_hoc', label: 'Địa điểm học / Cơ sở liên kết', varName: 'dia_diem_hoc', type: 'text', required: true, defaultValue: 'Trường Đại học Đồng Tháp', hint: 'Tên trạm/cơ sở liên kết đào tạo hoặc Trường ĐH Đồng Tháp' },
  { id: 'f_hoc_ky', label: 'Học kỳ', varName: 'hoc_ky', type: 'select', options: ['1', '2', 'Hè'], required: true, defaultValue: '1', hint: 'Chọn học kỳ xin nhận điểm I' },
  { id: 'f_nam_hoc', label: 'Năm học', varName: 'nam_hoc', type: 'text', required: true, defaultValue: '2025 - 2026', hint: 'VD: 2025 - 2026' },
  {
    id: 'f_ds_hoc_phan',
    label: 'Danh sách học phần xin nhận điểm I',
    varName: 'ds_hoc_phan',
    type: 'table',
    required: true,
    hint: 'Thêm một hoặc nhiều học phần; cột TT sẽ tự động đánh số.',
    columns: [
      { key: 'ma_hp', label: 'Mã HP', placeholder: 'VD: GE4011' },
      { key: 'ten_hp', label: 'Tên học phần', placeholder: 'VD: Tâm lý học đại cương' },
      { key: 'so_tc', label: 'Số TC', placeholder: '2' },
      { key: 'ghi_chu', label: 'Ghi chú', placeholder: 'VD: Đã nộp giấy khám bệnh' },
    ],
  },
  { id: 'f_ly_do', label: 'Lý do xin nhận điểm I (kèm minh chứng)', varName: 'ly_do', type: 'textarea', required: true, defaultValue: '', hint: 'Trình bày rõ lý do bất khả kháng và minh chứng đính kèm.' },
  { id: 'f_dia_danh', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: 'VD: Đồng Tháp, Cần Thơ, Vĩnh Long...' },
  { id: 'f_ngay_lam_don', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: 'Tự động tách thành ngày / tháng / năm trên đơn.' },
  { id: 'f_nguoi_lam_don', label: 'Họ tên người ký đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống sẽ tự động lấy theo Họ và tên sinh viên.' },
];

export const BUILTIN_TEMPLATES = [
  {
    id: BM11_TEMPLATE_ID,
    name: '1. BM11 - Đơn xin nhận điểm I',
    file: 'BM11-Don-xin-nhan-diem-I.docx',
    description: 'Biểu mẫu BM11 dùng cho sinh viên xin hoãn thi / nhận điểm I có minh chứng.',
    fields: BM11_FIELDS,
  },
  {
    id: 'tpl_hoc_lai_cai_thien',
    name: '2. Đơn xin học lại, học cải thiện',
    file: 'Don-xin-hoc-lai-cai-thien.docx',
    description: 'Đăng ký học lại hoặc học cải thiện điểm học phần (hệ đào tạo từ xa).',
    fields: [
      { id: 'hl_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: 'Nhập MSSV để tự động điền thông tin' },
      { id: 'hl_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hl_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hl_nganh', label: 'Ngành đào tạo', varName: 'nganh', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hl_dt', label: 'Điện thoại', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hl_email', label: 'Email', varName: 'email', type: 'text', required: true, defaultValue: '', hint: 'VD: ten@student.dthu.edu.vn' },
      { id: 'hl_hk', label: 'Học kỳ', varName: 'hoc_ky', type: 'select', options: ['1', '2', 'Hè'], required: true, defaultValue: '1', hint: '' },
      { id: 'hl_nh', label: 'Năm học', varName: 'nam_hoc', type: 'text', required: true, defaultValue: '2025 - 2026', hint: '' },
      {
        id: 'hl_ds',
        label: 'Danh sách học phần đăng ký học lại / cải thiện',
        varName: 'ds_hoc_phan',
        type: 'table',
        required: true,
        hint: 'Đánh dấu "X" vào cột Học lại hoặc Học cải thiện tương ứng.',
        columns: [
          { key: 'ma_hp', label: 'Mã HP', placeholder: 'VD: GE4011' },
          { key: 'ten_hp', label: 'Tên học phần', placeholder: 'Tên học phần' },
          { key: 'so_tc', label: 'Số TC', placeholder: '2' },
          { key: 'hoc_lai', label: 'Học lại', placeholder: 'X' },
          { key: 'hoc_cai_thien', label: 'Học cải thiện', placeholder: 'X' },
        ],
      },
      { id: 'hl_dd', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'hl_ngay', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'hl_nld', label: 'Họ tên sinh viên ký đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống tự lấy theo Họ và tên' },
    ],
  },
  {
    id: 'tpl_hoc_vuot',
    name: '3. Đơn đăng ký học vượt',
    file: 'Don-dang-ky-hoc-vuot.docx',
    description: 'Đề nghị đăng ký học vượt học phần đối với hình thức đào tạo từ xa.',
    fields: [
      { id: 'hv_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hv_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hv_ns', label: 'Ngày sinh', varName: 'ngay_sinh', type: 'text', required: true, defaultValue: '', hint: 'VD: 05/08/1995' },
      { id: 'hv_dt', label: 'Điện thoại', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hv_tram', label: 'Trạm thi', varName: 'tram_thi', type: 'text', required: true, defaultValue: 'Trường Đại học Đồng Tháp', hint: 'Nơi dự thi / Trạm thi của sinh viên' },
      { id: 'hv_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hv_nganh', label: 'Ngành đào tạo', varName: 'nganh', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'hv_hk', label: 'Học kỳ đăng ký', varName: 'hoc_ky', type: 'select', options: ['1', '2', 'Hè'], required: true, defaultValue: '1', hint: '' },
      { id: 'hv_nh', label: 'Năm học', varName: 'nam_hoc', type: 'text', required: true, defaultValue: '2025 - 2026', hint: '' },
      {
        id: 'hv_ds',
        label: 'Danh sách học phần đề nghị học vượt',
        varName: 'ds_hoc_phan',
        type: 'table',
        required: true,
        hint: 'Nhập các học phần muốn đăng ký học vượt.',
        columns: [
          { key: 'ma_hp', label: 'Mã HP', placeholder: 'VD: ED4105' },
          { key: 'ten_hp', label: 'Tên học phần', placeholder: 'Tên học phần' },
          { key: 'so_tc', label: 'Số TC', placeholder: '3' },
          { key: 'hoc_ky_ctdt', label: 'HK theo CTĐT', placeholder: 'VD: HK5' },
          { key: 'ghi_chu', label: 'Ghi chú', placeholder: '' },
        ],
      },
      { id: 'hv_tc_ht', label: 'Số tín chỉ học kỳ hiện tại', varName: 'so_tc_hien_tai', type: 'number', required: true, defaultValue: '', hint: 'VD: 15' },
      { id: 'hv_tc_hv', label: 'Số tín chỉ đề nghị học vượt', varName: 'so_tc_hoc_vuot', type: 'number', required: true, defaultValue: '', hint: 'VD: 6' },
      { id: 'hv_dd', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'hv_ngay', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'hv_nld', label: 'Họ tên người làm đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống tự lấy theo Họ và tên' },
    ],
  },
  {
    id: 'tpl_nghi_hoc_tam_thoi',
    name: '4. Đơn xin nghỉ học tạm thời',
    file: 'Don-xin-nghi-hoc-tam-thoi.docx',
    description: 'Đơn xin nghỉ học tạm thời (hệ không chính quy / đào tạo từ xa) kèm danh sách học phần rút bớt.',
    fields: [
      { id: 'nh_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'nh_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'nh_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'nh_tai', label: 'Địa điểm học (Tại)', varName: 'dia_diem_hoc', type: 'text', required: true, defaultValue: 'Trường Đại học Đồng Tháp', hint: 'Trường ĐHĐT hoặc Cơ sở liên kết' },
      { id: 'nh_dt', label: 'Điện thoại', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'nh_email', label: 'Email', varName: 'email', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'nh_tu_hk', label: 'Nghỉ từ học kỳ', varName: 'tu_hoc_ky', type: 'select', options: ['1', '2', 'Hè'], required: true, defaultValue: '1', hint: '' },
      { id: 'nh_tu_nh', label: 'Từ năm học', varName: 'tu_nam_hoc', type: 'text', required: true, defaultValue: '2025 - 2026', hint: '' },
      { id: 'nh_den_hk', label: 'Đến học kỳ', varName: 'den_hoc_ky', type: 'select', options: ['1', '2', 'Hè'], required: true, defaultValue: '2', hint: '' },
      { id: 'nh_den_nh', label: 'Đến năm học', varName: 'den_nam_hoc', type: 'text', required: true, defaultValue: '2025 - 2026', hint: '' },
      { id: 'nh_tu_ngay', label: 'Cụ thể từ ngày', varName: 'tu_ngay', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'nh_den_ngay', label: 'Đến ngày', varName: 'den_ngay', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'nh_ld1', label: 'Lý do: Điều động lực lượng vũ trang (có giấy nhập ngũ)', varName: 'ly_do_nvqs', type: 'checkbox', required: false, defaultValue: '', hint: '' },
      { id: 'nh_ld2', label: 'Lý do: Bị ốm hoặc tai nạn (có giấy xác nhận y tế)', varName: 'ly_do_om', type: 'checkbox', required: false, defaultValue: '', hint: '' },
      { id: 'nh_ld3', label: 'Lý do: Vì nhu cầu cá nhân', varName: 'ly_do_ca_nhan', type: 'checkbox', required: false, defaultValue: '', hint: '' },
      { id: 'nh_dtb', label: 'Điểm TBC tích lũy (nếu nghỉ vì nhu cầu cá nhân)', varName: 'diem_tb_tich_luy', type: 'text', required: false, defaultValue: '', hint: 'VD: 2.85 / 4.00' },
      {
        id: 'nh_ds',
        label: 'Danh sách học phần xin rút bớt (nếu có)',
        varName: 'ds_hoc_phan',
        type: 'table',
        required: false,
        hint: 'Để trống nếu không rút bớt học phần.',
        columns: [
          { key: 'ma_hp', label: 'Mã HP', placeholder: '' },
          { key: 'ten_hp', label: 'Tên học phần', placeholder: '' },
          { key: 'so_tc', label: 'STC', placeholder: '' },
          { key: 'ghi_chu', label: 'Ghi chú', placeholder: '' },
        ],
      },
      { id: 'nh_dd', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'nh_ngay', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'nh_nld', label: 'Họ tên người làm đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống tự lấy theo Họ và tên' },
    ],
  },
  {
    id: 'tpl_tiep_tuc_hoc',
    name: '5. BM.02 - Đơn xin tiếp tục học',
    file: 'Don-xin-tiep-tuc-hoc.docx',
    description: 'Đơn xin tiếp tục học sau thời gian nghỉ học tạm thời (BM.02-QT02/TLKĐT).',
    fields: [
      { id: 'tt_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'tt_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'tt_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'tt_tai', label: 'Địa điểm học (Tại)', varName: 'dia_diem_hoc', type: 'text', required: true, defaultValue: 'Trường Đại học Đồng Tháp', hint: '' },
      { id: 'tt_dt', label: 'Điện thoại', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'tt_email', label: 'Email', varName: 'email', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'tt_tu_ngay', label: 'Đã nghỉ học tạm thời từ ngày', varName: 'tu_ngay', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'tt_den_ngay', label: 'Đến ngày', varName: 'den_ngay', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'tt_ly_do', label: 'Lý do đã nghỉ học tạm thời', varName: 'ly_do', type: 'textarea', required: true, defaultValue: '', hint: '' },
      { id: 'tt_hk', label: 'Xin tiếp tục học từ học kỳ', varName: 'hoc_ky', type: 'select', options: ['1', '2', 'Hè'], required: true, defaultValue: '1', hint: '' },
      { id: 'tt_nh', label: 'Năm học', varName: 'nam_hoc', type: 'text', required: true, defaultValue: '2025 - 2026', hint: '' },
      {
        id: 'tt_ds',
        label: 'Danh sách học phần đăng ký học cùng lớp',
        varName: 'ds_hoc_phan',
        type: 'table',
        required: false,
        hint: 'Các học phần đã tổ chức trong thời gian nghỉ học tạm thời.',
        columns: [
          { key: 'ma_hp', label: 'Mã HP', placeholder: '' },
          { key: 'ten_hp', label: 'Tên học phần', placeholder: '' },
          { key: 'so_tc', label: 'STC', placeholder: '' },
          { key: 'lop_dk_hoc', label: 'Tên lớp ĐK học', placeholder: '' },
        ],
      },
      { id: 'tt_dd', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'tt_ngay', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'tt_nld', label: 'Họ tên người làm đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống tự lấy theo Họ và tên' },
    ],
  },
  {
    id: 'tpl_vay_von_sv',
    name: '6. Giấy xác nhận vay vốn sinh viên',
    file: 'Giay-xac-nhan-vay-von-sv.docx',
    description: 'Giấy xác nhận đang theo học tại Trường ĐH Đồng Tháp để làm thủ tục vay vốn sinh viên.',
    fields: [
      { id: 'vv_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'vv_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'vv_ns', label: 'Ngày sinh', varName: 'ngay_sinh', type: 'text', required: true, defaultValue: '', hint: 'VD: 05/08/1995' },
      { id: 'vv_gt', label: 'Giới tính', varName: 'gioi_tinh', type: 'select', options: ['Nam', 'Nữ'], required: true, defaultValue: 'Nam', hint: '' },
      { id: 'vv_cccd', label: 'Số CCCD', varName: 'so_cccd', type: 'text', required: true, defaultValue: '', hint: '12 chữ số CCCD' },
      { id: 'vv_ngay_cap', label: 'Ngày cấp CCCD', varName: 'ngay_cap_cccd', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'vv_noi_cap', label: 'Nơi cấp CCCD', varName: 'noi_cap_cccd', type: 'text', required: true, defaultValue: 'Cục Cảnh sát QLHC về TTXH', hint: '' },
      { id: 'vv_nganh', label: 'Ngành học', varName: 'nganh', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'vv_he', label: 'Hệ đào tạo (Bậc đào tạo)', varName: 'bac_dao_tao', type: 'text', required: true, defaultValue: 'Đại học', hint: '' },
      { id: 'vv_khoa_hoc', label: 'Khóa học', varName: 'khoa_hoc', type: 'text', required: true, defaultValue: '', hint: 'VD: Khóa 2024 (2024 - 2028)' },
      { id: 'vv_loai_dt', label: 'Loại hình đào tạo', varName: 'loai_dao_tao', type: 'text', required: true, defaultValue: 'Đào tạo từ xa', hint: '' },
      { id: 'vv_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'vv_khoa', label: 'Khoa', varName: 'khoa', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'vv_nnh', label: 'Ngày nhập học', varName: 'ngay_nhap_hoc', type: 'text', required: true, defaultValue: '', hint: 'VD: 26/05/2023' },
      { id: 'vv_ra_truong', label: 'Thời gian ra trường dự kiến', varName: 'thoi_gian_ra_truong', type: 'text', required: true, defaultValue: '', hint: 'VD: 06/2027' },
      { id: 'vv_so_thang', label: 'Thời gian học tại trường (tháng)', varName: 'thoi_gian_hoc_thang', type: 'number', required: true, defaultValue: '40', hint: 'VD: 40' },
      { id: 'vv_hp', label: 'Số tiền học phí hàng tháng (đồng)', varName: 'hoc_phi_thang', type: 'text', required: true, defaultValue: '', hint: 'VD: 1.450.000' },
      { id: 'vv_d1', label: 'Thuộc diện: Không miễn giảm', varName: 'dien_khong_mien_giam', type: 'checkbox', required: false, defaultValue: '1', hint: '' },
      { id: 'vv_d2', label: 'Thuộc diện: Giảm học phí', varName: 'dien_giam_hoc_phi', type: 'checkbox', required: false, defaultValue: '', hint: '' },
      { id: 'vv_d3', label: 'Thuộc diện: Miễn học phí', varName: 'dien_mien_hoc_phi', type: 'checkbox', required: false, defaultValue: '', hint: '' },
      { id: 'vv_o1', label: 'Đối tượng: Mồ côi', varName: 'dt_mo_coi', type: 'checkbox', required: false, defaultValue: '', hint: '' },
      { id: 'vv_o2', label: 'Đối tượng: Không mồ côi', varName: 'dt_khong_mo_coi', type: 'checkbox', required: false, defaultValue: '1', hint: '' },
      { id: 'vv_dd', label: 'Địa danh', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'vv_ngay', label: 'Ngày xác nhận', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
    ],
  },
  {
    id: 'tpl_bao_luu_kqht',
    name: '7. Đơn xin bảo lưu kết quả học tập',
    file: 'Don-xin-bao-luu-ket-qua-hoc-tap.docx',
    description: 'Đơn xin xét bảo lưu / công nhận điểm các học phần đã tích lũy tương đương.',
    fields: [
      { id: 'bl_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_dt', label: 'Điện thoại', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_email', label: 'Email', varName: 'email', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_nganh', label: 'Ngành đào tạo hiện tại', varName: 'nganh', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_khoa', label: 'Khoa', varName: 'khoa', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'bl_nganh_cu', label: 'Đã học ngành (trước đây)', varName: 'da_hoc_nganh', type: 'text', required: true, defaultValue: '', hint: 'Tên ngành đã tốt nghiệp hoặc đã học trước đó' },
      { id: 'bl_truong_cu', label: 'Tại Trường (trước đây)', varName: 'da_hoc_truong', type: 'text', required: true, defaultValue: '', hint: 'Tên trường đã học các học phần đề nghị bảo lưu' },
      {
        id: 'bl_ds',
        label: 'Danh sách học phần đề nghị bảo lưu kết quả',
        varName: 'ds_hoc_phan',
        type: 'table',
        required: true,
        hint: 'Ghi tương ứng giữa học phần đã tích lũy và học phần trong CTĐT của ĐHĐT.',
        columns: [
          { key: 'ten_hp_cu', label: 'Tên HP đã tích lũy', placeholder: 'Tên môn cũ' },
          { key: 'so_tc_cu', label: 'Số TC cũ', placeholder: '2' },
          { key: 'ten_hp_moi', label: 'Tên HP đề nghị nhận điểm (ĐHĐT)', placeholder: 'Tên môn tương đương' },
          { key: 'so_tc_moi', label: 'Số TC mới', placeholder: '2' },
        ],
      },
      { id: 'bl_dd', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'bl_ngay', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'bl_nld', label: 'Họ tên người làm đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống tự lấy theo Họ và tên' },
    ],
  },
  {
    id: 'tpl_xac_nhan_sv',
    name: '8. Đơn xin xác nhận sinh viên (Từ xa)',
    file: 'Don-xin-xac-nhan-sinh-vien.docx',
    description: 'Đơn xin xác nhận đang là sinh viên hệ Đào tạo từ xa tại Trường Đại học Đồng Tháp.',
    fields: [
      { id: 'xn_mssv', label: 'Mã số sinh viên (MSSV)', varName: 'mssv', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_ho_ten', label: 'Họ và tên', varName: 'ho_ten', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_ns', label: 'Ngày sinh', varName: 'ngay_sinh', type: 'text', required: true, defaultValue: '', hint: 'VD: 05/08/1995' },
      { id: 'xn_dc', label: 'Địa chỉ thường trú', varName: 'dia_chi', type: 'text', required: true, defaultValue: '', hint: 'Ghi đầy đủ ấp/khóm, xã/phường, tỉnh/thành phố' },
      { id: 'xn_cccd', label: 'Số CCCD', varName: 'so_cccd', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_nc', label: 'Ngày cấp CCCD', varName: 'ngay_cap_cccd', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'xn_noic', label: 'Nơi cấp CCCD', varName: 'noi_cap_cccd', type: 'text', required: true, defaultValue: 'Cục Cảnh sát QLHC về TTXH', hint: '' },
      { id: 'xn_lop', label: 'Lớp', varName: 'lop', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_nganh', label: 'Ngành đào tạo', varName: 'nganh', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_kh', label: 'Khóa đào tạo', varName: 'khoa_hoc', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_ht', label: 'Hình thức đào tạo', varName: 'loai_dao_tao', type: 'text', required: true, defaultValue: 'Từ xa', hint: 'VD: Từ xa / VLVH / Chính quy' },
      { id: 'xn_dt', label: 'Điện thoại liên lạc', varName: 'dien_thoai', type: 'text', required: true, defaultValue: '', hint: '' },
      { id: 'xn_ly_do', label: 'Lý do xin xác nhận', varName: 'ly_do', type: 'textarea', required: true, defaultValue: '', hint: 'VD: Bổ sung hồ sơ tại cơ quan công tác / địa phương...' },
      { id: 'xn_dd', label: 'Địa danh ký đơn', varName: 'dia_danh', type: 'text', required: true, defaultValue: 'Đồng Tháp', hint: '' },
      { id: 'xn_ngay', label: 'Ngày làm đơn', varName: 'ngay_lam_don', type: 'date', required: true, defaultValue: '', hint: '' },
      { id: 'xn_nld', label: 'Họ tên người làm đơn', varName: 'nguoi_lam_don', type: 'text', required: false, defaultValue: '', hint: 'Để trống tự lấy theo Họ và tên' },
    ],
  },
];

export async function seedSampleBM11IfNeeded(force = false) {
  const existingTemplates = await db.getAll('templates');
  const existingFolders = await db.getAll('folders');
  const existingMap = new Map(existingTemplates.map((t) => [t.id, t]));
  const now = new Date().toISOString();

  if (!existingFolders.some((f) => f.id === DEFAULT_FOLDER_ID)) {
    await db.put('folders', {
      id: DEFAULT_FOLDER_ID,
      name: 'Biểu mẫu Đào tạo Từ xa',
      description: 'Bộ 8 biểu mẫu hành chính sinh viên hệ Đào tạo Từ xa (2026)',
      parentId: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  let addedCount = 0;

  for (let idx = 0; idx < BUILTIN_TEMPLATES.length; idx++) {
    const spec = BUILTIN_TEMPLATES[idx];
    const sortOrder = idx + 1;
    const existing = existingMap.get(spec.id);
    const needsUpgrade = !existing || (existing.builtinVersion || 1) < BUILTIN_TEMPLATE_VERSION;

    if (!force && !needsUpgrade) {
      continue;
    }

    try {
      const resp = await fetch(`./templates/${spec.file}?v=${BUILTIN_TEMPLATE_VERSION}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();

      await db.put('templates', {
        id: spec.id,
        name: spec.name,
        sortOrder,
        builtinVersion: BUILTIN_TEMPLATE_VERSION,
        originalFileName: spec.file,
        folderId: DEFAULT_FOLDER_ID,
        description: spec.description,
        size: blob.size,
        fileBlob: blob,
        fields: spec.fields.map((f) => ({
          ...f,
          defaultValue: f.varName === 'ngay_lam_don' ? todayISO() : f.defaultValue,
        })),
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
        lastUsedAt: existing ? existing.lastUsedAt : null,
      });
      addedCount++;
    } catch (err) {
      console.warn(`Không thể nạp mẫu ${spec.file}:`, err);
    }
  }

  if (addedCount > 0) {
    await db.logActivity('Nạp bộ biểu mẫu sẵn', `Đã nạp ${addedCount} biểu mẫu Đào tạo Từ xa vào thư viện.`);
    return true;
  }
  return false;
}
