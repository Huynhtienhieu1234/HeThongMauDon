import { renderDocxPreview } from '../core/docxEngine.js';
import { downloadBlob, escapeHtml, formatBytes } from '../utils/helpers.js';
import { showToast } from '../utils/ui.js';
import { appState, navigateTo } from './navigation.js';

export async function renderPreview(container) {
  const blob = appState.lastGeneratedBlob;
  const fileName = appState.lastOutputFileName || 'van-ban.docx';

  if (!blob) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">👁️</div>
        <p>Chưa có văn bản nào vừa được tạo để xem trước.</p>
        <button class="btn btn-primary" style="margin-top:12px;" id="previewGoGenBtn">📝 Đi tới Tạo văn bản</button>
      </div>`;
    container.querySelector('#previewGoGenBtn')?.addEventListener('click', () => navigateTo('generator'));
    return;
  }

  container.innerHTML = `
    <div class="card">
      <div class="preview-toolbar">
        <div>
          <h3 class="card-title">${escapeHtml(fileName)}</h3>
          <span class="form-hint">Dung lượng: ${formatBytes(blob.size)} • Mẫu: ${escapeHtml(appState.lastTemplateName || '—')}</span>
        </div>
        <div class="btn-group">
          <button class="btn" id="backToFormBtn">✏️ Quay lại chỉnh sửa dữ liệu</button>
          <button class="btn btn-success" id="downloadDocxBtn">⬇️ Tải xuống file DOCX</button>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>Lưu ý:</strong> Khung bên dưới là <strong>bản xem trước HTML</strong> trên trình duyệt để bạn kiểm tra nhanh nội dung. File <strong>DOCX tải xuống</strong> giữ nguyên 100% định dạng, lề trang, bảng biểu và font gốc của Microsoft Word.
      </div>

      <div class="preview-stage" id="docxPreviewStage">
        <div class="loading-state">Đang hiển thị bản xem trước...</div>
      </div>
    </div>
  `;

  container.querySelector('#backToFormBtn')?.addEventListener('click', () => {
    navigateTo('generator', {
      templateId: appState.selectedTemplateId,
      keepData: true,
    });
  });

  container.querySelector('#downloadDocxBtn')?.addEventListener('click', () => {
    downloadBlob(blob, fileName);
    showToast(`Đang tải xuống "${fileName}"...`, 'success');
  });

  const stage = container.querySelector('#docxPreviewStage');
  try {
    await renderDocxPreview(blob, stage);
  } catch (err) {
    console.error(err);
    stage.innerHTML = `<div class="alert alert-warning">Không thể hiển thị bản xem trước (${escapeHtml(err.message)}). Bạn vẫn có thể bấm <strong>Tải xuống file DOCX</strong> ở trên.</div>`;
  }
}
