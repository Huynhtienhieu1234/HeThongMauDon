import { db } from '../core/database.js';
import { downloadBlob, escapeHtml, formatBytes, formatDateTime } from '../utils/helpers.js';
import { confirmDialog, openModal, showToast } from '../utils/ui.js';
import { navigateTo } from './navigation.js';

let searchKeyword = '';

export async function renderHistory(container) {
  const history = (await db.getAll('history')).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const kw = searchKeyword.toLowerCase();
  const filtered = history.filter(
    (h) =>
      !kw ||
      (h.docName || '').toLowerCase().includes(kw) ||
      (h.templateName || '').toLowerCase().includes(kw)
  );

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Lịch sử tạo văn bản (${filtered.length})</h3>
        <input type="search" id="hisSearchInput" value="${escapeHtml(searchKeyword)}" placeholder="Tìm theo tên văn bản hoặc tên mẫu..." style="max-width:300px;" />
      </div>

      ${
        filtered.length === 0
          ? '<div class="empty-state"><div class="empty-icon">🕘</div><p>Chưa có lịch sử tạo văn bản nào.</p></div>'
          : `<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên văn bản</th>
                    <th>Mẫu sử dụng</th>
                    <th>Thời gian tạo</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered
                    .map(
                      (h) => `
                    <tr>
                      <td>
                        <strong>${escapeHtml(h.docName)}</strong><br/>
                        <span class="form-hint">${formatBytes(h.size || 0)}</span>
                      </td>
                      <td>${escapeHtml(h.templateName || '—')}</td>
                      <td style="white-space:nowrap;font-size:12px;">${formatDateTime(h.createdAt)}</td>
                      <td><span class="badge badge-success">${escapeHtml(h.status || 'Thành công')}</span></td>
                      <td>
                        <div class="btn-group">
                          <button class="btn btn-sm js-view" data-id="${escapeHtml(h.id)}">👁️ Chi tiết</button>
                          <button class="btn btn-sm btn-primary js-reuse" data-id="${escapeHtml(h.id)}">🔄 Tạo lại</button>
                          ${
                            h.fileBlob
                              ? `<button class="btn btn-sm btn-success js-dl" data-id="${escapeHtml(h.id)}">⬇️ DOCX</button>`
                              : ''
                          }
                          <button class="btn btn-sm btn-danger js-del" data-id="${escapeHtml(h.id)}">🗑️</button>
                        </div>
                      </td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table>
            </div>`
      }
    </div>
  `;

  container.querySelector('#hisSearchInput')?.addEventListener('input', (e) => {
    searchKeyword = e.target.value;
    renderHistory(container);
  });

  container.querySelectorAll('.js-view').forEach((btn) =>
    btn.addEventListener('click', () => {
      const h = history.find((x) => x.id === btn.dataset.id);
      if (!h) return;
      const rows = Object.entries(h.inputData || {})
        .map(([k, v]) => {
          const valStr = Array.isArray(v) ? `${v.length} dòng bảng` : String(v ?? '');
          return `<tr><td><code>${escapeHtml(k)}</code></td><td>${escapeHtml(valStr)}</td></tr>`;
        })
        .join('');
      openModal({
        title: `Chi tiết: ${h.docName}`,
        bodyHtml: `<div class="table-wrap"><table><thead><tr><th>Biến</th><th>Giá trị đã nhập</th></tr></thead><tbody>${rows}</tbody></table></div>`,
        buttons: [{ label: 'Đóng', className: 'btn-primary' }],
      });
    })
  );

  container.querySelectorAll('.js-reuse').forEach((btn) =>
    btn.addEventListener('click', () => {
      const h = history.find((x) => x.id === btn.dataset.id);
      if (!h) return;
      navigateTo('generator', { templateId: h.templateId, prefillData: h.inputData || {} });
    })
  );

  container.querySelectorAll('.js-dl').forEach((btn) =>
    btn.addEventListener('click', () => {
      const h = history.find((x) => x.id === btn.dataset.id);
      if (h?.fileBlob) downloadBlob(h.fileBlob, h.docName || 'van-ban.docx');
    })
  );

  container.querySelectorAll('.js-del').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const h = history.find((x) => x.id === btn.dataset.id);
      if (!h) return;
      const ok = await confirmDialog(`Xóa bản ghi lịch sử "${h.docName}"?`);
      if (!ok) return;
      await db.delete('history', h.id);
      showToast('Đã xóa mục lịch sử.', 'success');
      renderHistory(container);
    })
  );
}
