import { db } from '../core/database.js';
import { getSettings, saveSettings } from '../core/storage.js';
import { seedSampleBM11IfNeeded } from '../core/seed.js';
import { escapeHtml, formatBytes } from '../utils/helpers.js';
import { confirmDialog, showToast } from '../utils/ui.js';

export async function renderSettings(container) {
  const s = getSettings();
  const est = await db.getStorageEstimate();
  const pct = est.quota ? Math.min(100, (est.usage / est.quota) * 100) : 0;

  container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Cấu hình ứng dụng</h3>
        </div>
        <form id="settingsForm">
          <div class="form-group">
            <label>Tên ứng dụng hiển thị</label>
            <input type="text" id="setAppName" value="${escapeHtml(s.appName)}" />
          </div>
          <div class="form-group">
            <label>Giao diện (Theme)</label>
            <select id="setTheme">
              <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Sáng (Light)</option>
              <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Tối (Dark)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Định dạng ngày tháng mặc định</label>
            <select id="setDateFormat">
              <option value="dd/MM/yyyy" ${s.dateFormat === 'dd/MM/yyyy' ? 'selected' : ''}>dd/MM/yyyy (VD: 21/11/2026)</option>
              <option value="yyyy-MM-dd" ${s.dateFormat === 'yyyy-MM-dd' ? 'selected' : ''}>yyyy-MM-dd (VD: 2026-11-21)</option>
              <option value="MM/dd/yyyy" ${s.dateFormat === 'MM/dd/yyyy' ? 'selected' : ''}>MM/dd/yyyy (VD: 11/21/2026)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Địa danh mặc định</label>
            <input type="text" id="setPlace" value="${escapeHtml(s.defaultPlace)}" />
          </div>
          <div class="form-group">
            <label>Giới hạn dung lượng mỗi file DOCX (MB)</label>
            <input type="number" id="setMaxSize" min="1" max="100" value="${escapeHtml(s.maxFileSizeMB)}" />
          </div>
          <button type="submit" class="btn btn-primary">💾 Lưu cài đặt</button>
        </form>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Quản lý lưu trữ IndexedDB</h3>
        </div>
        <div class="alert alert-info">
          Dữ liệu ứng dụng được lưu cục bộ trực tiếp trên trình duyệt và thiết bị hiện tại. Không tự đồng bộ giữa các máy tính khác nhau.
        </div>
        <div style="margin-bottom:18px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
            <span>Đã dùng / Hạn mức trình duyệt</span>
            <strong>${formatBytes(est.usage)} / ${formatBytes(est.quota)}</strong>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.max(pct, est.usage ? 2 : 0)}%"></div>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn" id="reseedBM11Btn">🔄 Nạp lại toàn bộ 8 biểu mẫu mặc định</button>
          <button class="btn btn-danger" id="clearAllDataBtn">🗑️ Xóa toàn bộ dữ liệu</button>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#settingsForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings({
      appName: container.querySelector('#setAppName').value.trim() || 'AUTO WORD',
      theme: container.querySelector('#setTheme').value,
      dateFormat: container.querySelector('#setDateFormat').value,
      defaultPlace: container.querySelector('#setPlace').value.trim() || 'Đồng Tháp',
      maxFileSizeMB: Number(container.querySelector('#setMaxSize').value) || 15,
    });
    showToast('Đã lưu cài đặt thành công!', 'success');
  });

  container.querySelector('#reseedBM11Btn')?.addEventListener('click', async () => {
    const ok = await seedSampleBM11IfNeeded(true);
    if (ok) showToast('Đã nạp lại toàn bộ 8 biểu mẫu sinh viên Đào tạo Từ xa.', 'success');
    else showToast('Không thể nạp mẫu từ ./templates/. Hãy chạy qua máy chủ web cục bộ hoặc GitHub Pages.', 'warning', 5000);
  });

  container.querySelector('#clearAllDataBtn')?.addEventListener('click', async () => {
    const ok = await confirmDialog(
      'Xóa toàn bộ thư mục, mẫu Word, lịch sử và nhật ký hoạt động trên trình duyệt này? Hãy sao lưu trước nếu cần.',
      'Cảnh báo xóa toàn bộ dữ liệu'
    );
    if (!ok) return;
    await Promise.all([
      db.clear('folders'),
      db.clear('templates'),
      db.clear('history'),
      db.clear('activities'),
    ]);
    showToast('Đã xóa toàn bộ dữ liệu IndexedDB.', 'success');
    renderSettings(container);
  });
}
