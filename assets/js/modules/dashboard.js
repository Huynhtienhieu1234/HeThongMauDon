import { db } from '../core/database.js';
import { escapeHtml, formatBytes, formatDateTime } from '../utils/helpers.js';
import { navigateTo } from './navigation.js';
import { BM11_TEMPLATE_ID } from '../core/seed.js';

export async function renderDashboard(container) {
  const [folders, rawTemplates, history, activities, storageEst] = await Promise.all([
    db.getAll('folders'),
    db.getAll('templates'),
    db.getAll('history'),
    db.getAll('activities'),
    db.getStorageEstimate(),
  ]);
  const templates = rawTemplates.sort((a, b) => {
    const oa = a.sortOrder ?? 999;
    const ob = b.sortOrder ?? 999;
    if (oa !== ob) return oa - ob;
    return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
  });

  const recentUsed = templates
    .filter((t) => t.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt) - new Date(a.lastUsedAt));

  const sortedActivities = activities
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const bm11 = templates.find((t) => t.id === BM11_TEMPLATE_ID) || templates[0];
  const pct = storageEst.quota ? Math.min(100, (storageEst.usage / storageEst.quota) * 100) : 0;

  container.innerHTML = `
    ${
      bm11
        ? `
      <div class="alert alert-info" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <strong>🚀 Sẵn sàng dùng thử:</strong> Mẫu <strong>${escapeHtml(bm11.name)}</strong> đã được cấu hình đầy đủ trường dữ liệu.
        </div>
        <div class="btn-group">
          <button class="btn btn-primary btn-sm" id="dashTryBM11Btn">📝 Tạo đơn nhận điểm I ngay</button>
          <button class="btn btn-sm" id="dashSetupBM11Btn">⚙️ Xem cấu hình trường</button>
        </div>
      </div>`
        : ''
    }

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📄</div>
        <div>
          <div class="stat-value">${templates.length}</div>
          <div class="stat-label">Tổng số mẫu văn bản</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📁</div>
        <div>
          <div class="stat-value">${folders.length}</div>
          <div class="stat-label">Tổng số thư mục</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div>
          <div class="stat-value">${history.length}</div>
          <div class="stat-label">Văn bản đã tạo</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⚡</div>
        <div>
          <div class="stat-value">${recentUsed.length}</div>
          <div class="stat-label">Mẫu sử dụng gần đây</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Lối tắt nhanh</h3>
      </div>
      <div class="btn-group">
        <button class="btn btn-primary" data-jump="generator">📝 Tạo văn bản tự động</button>
        <button class="btn" data-jump="library">📁 Quản lý thư viện mẫu</button>
        <button class="btn" data-jump="setup">⚙️ Thiết lập trường dữ liệu</button>
        <button class="btn" data-jump="history">🕘 Xem lịch sử văn bản</button>
        <button class="btn" data-jump="backup">💾 Sao lưu dữ liệu</button>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Mẫu văn bản hiện có</h3>
          <button class="btn btn-sm btn-ghost" data-jump="library">Xem tất cả →</button>
        </div>
        ${
          templates.length === 0
            ? '<div class="empty-state"><div class="empty-icon">📂</div><p>Chưa có mẫu DOCX nào. Hãy tải mẫu lên ở Thư viện mẫu.</p></div>'
            : `<div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tên mẫu</th>
                      <th>Số trường</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${templates
                      .slice(0, 6)
                      .map(
                        (t) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(t.name)}</strong><br/>
                          <span class="form-hint">${escapeHtml(t.originalFileName)} • ${formatBytes(t.size)}</span>
                        </td>
                        <td><span class="badge badge-primary">${(t.fields || []).length} trường</span></td>
                        <td>
                          <button class="btn btn-sm btn-primary js-use-tpl" data-id="${escapeHtml(t.id)}">Tạo đơn</button>
                        </td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Hoạt động gần đây &amp; Lưu trữ</h3>
        </div>
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
            <span>Dung lượng IndexedDB đang sử dụng</span>
            <strong>${formatBytes(storageEst.usage)} / ${formatBytes(storageEst.quota)}</strong>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${Math.max(pct, storageEst.usage ? 2 : 0)}%"></div>
          </div>
        </div>
        ${
          sortedActivities.length === 0
            ? '<p class="form-hint">Chưa có hoạt động nào được ghi nhận.</p>'
            : `<div class="table-wrap">
                <table>
                  <tbody>
                    ${sortedActivities
                      .map(
                        (a) => `
                      <tr>
                        <td>
                          <strong>${escapeHtml(a.action)}</strong><br/>
                          <span class="form-hint">${escapeHtml(a.detail)}</span>
                        </td>
                        <td style="white-space:nowrap;color:var(--text-muted);font-size:12px;">${formatDateTime(a.createdAt)}</td>
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    </div>
  `;

  container.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.jump));
  });

  container.querySelectorAll('.js-use-tpl').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo('generator', { templateId: btn.dataset.id }));
  });

  if (bm11) {
    container.querySelector('#dashTryBM11Btn')?.addEventListener('click', () => {
      navigateTo('generator', { templateId: bm11.id });
    });
    container.querySelector('#dashSetupBM11Btn')?.addEventListener('click', () => {
      navigateTo('setup', { templateId: bm11.id });
    });
  }
}
