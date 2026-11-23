const VIEW_TITLES = {
  dashboard: 'Tổng quan',
  library: 'Quản lý thư viện mẫu Word',
  setup: 'Thiết lập mẫu văn bản',
  generator: 'Tạo văn bản tự động',
  preview: 'Xem trước văn bản',
  history: 'Lịch sử tạo văn bản',
  students: 'Cơ sở dữ liệu sinh viên',
  backup: 'Sao lưu & Khôi phục dữ liệu',
  settings: 'Cài đặt hệ thống',
};

const handlers = {};
export const appState = {
  currentView: 'dashboard',
  selectedTemplateId: null,
  lastFormData: null,
  lastGeneratedBlob: null,
  lastOutputFileName: null,
  lastTemplateName: null,
  globalSearch: '',
};

export function registerView(name, renderFn) {
  handlers[name] = renderFn;
}

export async function navigateTo(viewName, params = {}) {
  if (!handlers[viewName]) {
    console.warn(`View không tồn tại: ${viewName}`);
    return;
  }
  appState.currentView = viewName;
  if (params.templateId) appState.selectedTemplateId = params.templateId;
  if (params.formData !== undefined) appState.lastFormData = params.formData;
  if (params.generatedBlob !== undefined) appState.lastGeneratedBlob = params.generatedBlob;
  if (params.outputFileName !== undefined) appState.lastOutputFileName = params.outputFileName;
  if (params.templateName !== undefined) appState.lastTemplateName = params.templateName;

  document.querySelectorAll('#sidebarNav .nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = VIEW_TITLES[viewName] || 'AUTO WORD GENERATOR';

  closeMobileSidebar();

  const container = document.getElementById('mainContent');
  container.innerHTML = '<div class="loading-state">Đang tải...</div>';
  try {
    await handlers[viewName](container, params);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="alert alert-warning">Đã xảy ra lỗi khi hiển thị trang: ${err.message}</div>`;
  }
}

export function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('open');
}

export function initNavigation() {
  document.querySelectorAll('#sidebarNav .nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  document.getElementById('mobileMenuBtn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.add('open');
    document.getElementById('sidebarBackdrop')?.classList.add('open');
  });

  document.getElementById('sidebarCloseBtn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebarBackdrop')?.addEventListener('click', closeMobileSidebar);

  document.getElementById('quickCreateBtn')?.addEventListener('click', () => {
    navigateTo('generator');
  });

  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        appState.globalSearch = searchInput.value.trim();
        navigateTo('library');
      }
    });
  }
}
