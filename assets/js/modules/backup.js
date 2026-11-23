import { db } from '../core/database.js';
import { getSettings, saveSettings } from '../core/storage.js';
import { downloadBlob, todayISO } from '../utils/helpers.js';
import { confirmDialog, showToast } from '../utils/ui.js';

export async function renderBackup(container) {
  const [folders, templates, history] = await Promise.all([
    db.getAll('folders'),
    db.getAll('templates'),
    db.getAll('history'),
  ]);

  container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📤 Xuất gói sao lưu (.ZIP)</h3>
        </div>
        <p class="form-hint" style="margin-bottom:14px;">
          Đóng gói toàn bộ thư mục (${folders.length}), mẫu Word DOCX (${templates.length}), cấu hình trường dữ liệu, lịch sử (${history.length}) và cài đặt vào 1 file ZIP duy nhất.
        </p>
        <button class="btn btn-primary" id="exportBackupBtn">💾 Tải xuống file sao lưu (.ZIP)</button>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📥 Khôi phục từ file sao lưu</h3>
        </div>
        <p class="form-hint" style="margin-bottom:14px;">
          Chọn file <code>.zip</code> đã xuất từ AUTO WORD GENERATOR. Hệ thống sẽ kiểm tra tính hợp lệ trước khi khôi phục.
        </p>
        <div class="form-group">
          <label>Chế độ khôi phục</label>
          <select id="restoreModeSelect">
            <option value="merge">Gộp thêm (giữ dữ liệu hiện tại, cập nhật mục trùng ID)</option>
            <option value="replace">Thay thế toàn bộ (xóa dữ liệu hiện tại trước khi nạp)</option>
          </select>
        </div>
        <label class="btn btn-success" style="cursor:pointer;">
          📂 Chọn file sao lưu (.ZIP)
          <input type="file" id="importBackupInput" accept=".zip" hidden />
        </label>
      </div>
    </div>
  `;

  container.querySelector('#exportBackupBtn')?.addEventListener('click', async () => {
    if (typeof window.JSZip === 'undefined') {
      showToast('Thiếu thư viện JSZip. Vui lòng kiểm tra kết nối mạng.', 'error');
      return;
    }
    try {
      const zip = new window.JSZip();
      const tplMeta = [];
      for (const t of templates) {
        const { fileBlob, ...rest } = t;
        tplMeta.push(rest);
        if (fileBlob) {
          zip.file(`templates/${t.id}.docx`, fileBlob);
        }
      }
      const hisMeta = [];
      for (const h of history) {
        const { fileBlob, ...rest } = h;
        hisMeta.push(rest);
        if (fileBlob) {
          zip.file(`history/${h.id}.docx`, fileBlob);
        }
      }
      zip.file(
        'metadata.json',
        JSON.stringify(
          {
            app: 'AUTO_WORD_GENERATOR',
            version: '1.0',
            exportedAt: new Date().toISOString(),
            settings: getSettings(),
            folders,
            templates: tplMeta,
            history: hisMeta,
          },
          null,
          2
        )
      );
      const outBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(outBlob, `AutoWordGenerator_Backup_${todayISO()}.zip`);
      await db.logActivity('Sao lưu hệ thống', `${templates.length} mẫu, ${history.length} lịch sử`);
      showToast('Đã xuất file sao lưu thành công!', 'success');
    } catch (err) {
      showToast(`Lỗi xuất sao lưu: ${err.message}`, 'error');
    }
  });

  container.querySelector('#importBackupInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (typeof window.JSZip === 'undefined') {
      showToast('Thiếu thư viện JSZip.', 'error');
      return;
    }
    try {
      const zip = await window.JSZip.loadAsync(file);
      const metaFile = zip.file('metadata.json');
      if (!metaFile) {
        showToast('File ZIP không hợp lệ (thiếu metadata.json).', 'error');
        return;
      }
      const meta = JSON.parse(await metaFile.async('string'));
      if (meta.app !== 'AUTO_WORD_GENERATOR') {
        showToast('File ZIP không phải bản sao lưu của AUTO WORD GENERATOR.', 'error');
        return;
      }

      const mode = container.querySelector('#restoreModeSelect').value;
      const summary = `Bản sao lưu ngày ${meta.exportedAt?.slice(0, 10) || '?'} gồm ${(meta.folders || []).length} thư mục, ${(meta.templates || []).length} mẫu DOCX, ${(meta.history || []).length} lịch sử. Bạn muốn tiến hành khôi phục (${mode === 'replace' ? 'THAY THẾ TOÀN BỘ' : 'GỘP THÊM'})?`;
      const ok = await confirmDialog(summary, 'Xác nhận khôi phục dữ liệu');
      if (!ok) return;

      if (mode === 'replace') {
        await Promise.all([db.clear('folders'), db.clear('templates'), db.clear('history')]);
      }

      for (const f of meta.folders || []) await db.put('folders', f);
      for (const t of meta.templates || []) {
        const zf = zip.file(`templates/${t.id}.docx`);
        const fileBlob = zf ? await zf.async('blob') : null;
        await db.put('templates', { ...t, fileBlob });
      }
      for (const h of meta.history || []) {
        const zf = zip.file(`history/${h.id}.docx`);
        const fileBlob = zf ? await zf.async('blob') : null;
        await db.put('history', { ...h, fileBlob });
      }
      if (meta.settings) saveSettings(meta.settings);

      await db.logActivity('Khôi phục dữ liệu', `Chế độ: ${mode}`);
      showToast('Khôi phục dữ liệu thành công!', 'success');
      renderBackup(container);
    } catch (err) {
      showToast(`Lỗi khôi phục: ${err.message}`, 'error');
    }
  });
}
