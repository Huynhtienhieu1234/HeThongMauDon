import { openDB } from './core/database.js';
import { applySettingsToUI } from './core/storage.js';
import { seedSampleBM11IfNeeded, BM11_TEMPLATE_ID } from './core/seed.js';
import { initNavigation, navigateTo, registerView } from './modules/navigation.js';
import { renderDashboard } from './modules/dashboard.js';
import { renderLibrary } from './modules/library.js';
import { renderTemplateSetup } from './modules/templateSetup.js';
import { renderGenerator } from './modules/generator.js';
import { renderPreview } from './modules/preview.js';
import { renderHistory } from './modules/history.js';
import { renderStudentsModule } from './modules/students.js';
import { renderBackup } from './modules/backup.js';
import { renderSettings } from './modules/settings.js';
import { ensureStudentDbLoaded } from './core/studentService.js';
import { showToast } from './utils/ui.js';

async function bootstrap() {
  applySettingsToUI();
  initNavigation();

  registerView('dashboard', renderDashboard);
  registerView('library', renderLibrary);
  registerView('setup', renderTemplateSetup);
  registerView('generator', renderGenerator);
  registerView('preview', renderPreview);
  registerView('history', renderHistory);
  registerView('students', renderStudentsModule);
  registerView('backup', renderBackup);
  registerView('settings', renderSettings);

  try {
    await openDB();
    ensureStudentDbLoaded(); // Tải nền DB sinh viên (26.039 hồ sơ)
    const seeded = await seedSampleBM11IfNeeded(false);
    if (seeded) {
      showToast('Đã nạp sẵn bộ 8 biểu mẫu Đào tạo Từ xa!', 'success', 4500);
    }
    await navigateTo('dashboard');
  } catch (err) {
    console.error('Lỗi khởi động ứng dụng:', err);
    document.getElementById('mainContent').innerHTML = `
      <div class="alert alert-warning">
        <strong>Không thể khởi tạo cơ sở dữ liệu trình duyệt:</strong> ${err.message}
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
