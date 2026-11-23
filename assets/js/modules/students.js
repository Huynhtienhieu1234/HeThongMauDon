import {
  ensureStudentDbLoaded,
  getStudentDbStats,
  importStudentsFromExcelFile,
  searchStudents,
} from '../core/studentService.js';
import { escapeHtml, formatDateTime } from '../utils/helpers.js';
import { showToast } from '../utils/ui.js';

let searchKw = '';

export async function renderStudentsModule(container) {
  await ensureStudentDbLoaded();
  const stats = getStudentDbStats();
  const rows = await searchStudents(searchKw, 50);

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h3 class="card-title">👨‍🎓 Cơ sở dữ liệu Sinh viên (${stats.count.toLocaleString('vi-VN')} hồ sơ)</h3>
          <span class="form-hint">Nguồn: ${escapeHtml(stats.source)} • Cập nhật: ${formatDateTime(stats.updatedAt)}</span>
        </div>
        <div class="btn-group">
          <label class="btn btn-primary btn-sm" style="cursor:pointer;">
            ⬆️ Nhập file Excel (.xls / .xlsx)
            <input type="file" id="importStudentXlsInput" accept=".xls,.xlsx,.csv" hidden />
          </label>
          <button class="btn btn-sm" id="reloadDefaultDbBtn">🔄 Nạp lại DB mặc định</button>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
        <input type="search" id="stuDbSearchInput" value="${escapeHtml(searchKw)}" placeholder="Tìm theo Mã SV, Họ tên, Lớp học hoặc Ngành..." style="flex:1;min-width:240px;" />
        <span class="form-hint">Hiển thị tối đa 50 kết quả đầu tiên</span>
      </div>

      ${
        rows.length === 0
          ? '<div class="empty-state"><p>Không tìm thấy sinh viên phù hợp.</p></div>'
          : `<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Mã SV</th>
                    <th>Họ đệm</th>
                    <th>Tên</th>
                    <th>Giới tính</th>
                    <th>Ngày sinh</th>
                    <th>Mã lớp</th>
                    <th>Lớp học</th>
                    <th>Dân tộc</th>
                    <th>Khóa học</th>
                    <th>Bậc ĐT</th>
                    <th>Loại ĐT</th>
                    <th>Ngành</th>
                    <th>Chuyên ngành</th>
                    <th>Trạng thái</th>
                    <th>Ngày nhập học</th>
                    <th>Khoa</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows
                    .map(
                      (s) => `
                    <tr>
                      <td>${escapeHtml(s.stt)}</td>
                      <td><strong>${escapeHtml(s.mssv)}</strong></td>
                      <td>${escapeHtml(s.ho_dem)}</td>
                      <td><strong>${escapeHtml(s.ten)}</strong></td>
                      <td>${escapeHtml(s.gioi_tinh)}</td>
                      <td>${escapeHtml(s.ngay_sinh)}</td>
                      <td>${escapeHtml(s.ma_lop)}</td>
                      <td>${escapeHtml(s.lop_hoc)}</td>
                      <td>${escapeHtml(s.dan_toc)}</td>
                      <td>${escapeHtml(s.khoa_hoc)}</td>
                      <td>${escapeHtml(s.bac_dao_tao)}</td>
                      <td>${escapeHtml(s.loai_dao_tao)}</td>
                      <td>${escapeHtml(s.nganh)}</td>
                      <td>${escapeHtml(s.chuyen_nganh)}</td>
                      <td><span class="badge badge-success">${escapeHtml(s.trang_thai)}</span></td>
                      <td>${escapeHtml(s.ngay_nhap_hoc)}</td>
                      <td>${escapeHtml(s.khoa)}</td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;

  container.querySelector('#stuDbSearchInput')?.addEventListener('input', (e) => {
    searchKw = e.target.value;
    renderStudentsModule(container);
  });

  container.querySelector('#reloadDefaultDbBtn')?.addEventListener('click', async () => {
    showToast('Đang nạp lại dữ liệu từ DB/students.json...', 'info');
    await ensureStudentDbLoaded(true);
    showToast('Đã nạp lại dữ liệu sinh viên mặc định!', 'success');
    renderStudentsModule(container);
  });

  container.querySelector('#importStudentXlsInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      showToast(`Đang đọc file "${file.name}"...`, 'info');
      const res = await importStudentsFromExcelFile(file);
      showToast(`Đã cập nhật thành công ${res.count.toLocaleString('vi-VN')} sinh viên!`, 'success');
      renderStudentsModule(container);
    } catch (err) {
      showToast(`Lỗi nhập file Excel: ${err.message}`, 'error', 5000);
    }
  });
}
