import { db } from '../core/database.js';
import { getSettings } from '../core/storage.js';
import { escapeHtml, formatBytes, formatDateTime, uid, downloadBlob } from '../utils/helpers.js';
import { showToast, openModal, confirmDialog } from '../utils/ui.js';
import { appState, navigateTo } from './navigation.js';

let selectedFolderId = 'ALL';
let sortBy = 'orderAsc';

export async function renderLibrary(container) {
  const [folders, templates] = await Promise.all([db.getAll('folders'), db.getAll('templates')]);
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  const search = (appState.globalSearch || '').toLowerCase();

  let filtered = templates.filter((t) => {
    const matchFolder = selectedFolderId === 'ALL' || t.folderId === selectedFolderId;
    const matchSearch =
      !search ||
      t.name.toLowerCase().includes(search) ||
      (t.description || '').toLowerCase().includes(search) ||
      (t.originalFileName || '').toLowerCase().includes(search);
    return matchFolder && matchSearch;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'orderAsc') {
      const oa = a.sortOrder ?? 999;
      const ob = b.sortOrder ?? 999;
      if (oa !== ob) return oa - ob;
      return a.name.localeCompare(b.name, 'vi', { numeric: true });
    }
    if (sortBy === 'nameAsc') return a.name.localeCompare(b.name, 'vi', { numeric: true });
    if (sortBy === 'createdDesc') return new Date(b.createdAt) - new Date(a.createdAt);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const buildFolderTree = (parentId = null, depth = 0) => {
    return folders
      .filter((f) => (f.parentId || null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((f) => {
        const count = templates.filter((t) => t.folderId === f.id).length;
        return `
          <div class="folder-item ${selectedFolderId === f.id ? 'active' : ''}" data-folder="${escapeHtml(f.id)}" style="padding-left:${10 + depth * 16}px;">
            <span class="folder-item-label">📁 ${escapeHtml(f.name)}</span>
            <span class="badge badge-primary">${count}</span>
          </div>
          ${buildFolderTree(f.id, depth + 1)}
        `;
      })
      .join('');
  };

  container.innerHTML = `
    <div class="library-layout">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Thư mục</h3>
          <button class="btn btn-sm btn-primary" id="newFolderBtn">+ Mới</button>
        </div>
        <div class="folder-list">
          <div class="folder-item ${selectedFolderId === 'ALL' ? 'active' : ''}" data-folder="ALL">
            <span class="folder-item-label">📚 Tất cả mẫu</span>
            <span class="badge badge-primary">${templates.length}</span>
          </div>
          ${buildFolderTree(null, 0)}
        </div>
        ${
          selectedFolderId !== 'ALL' && folderMap.has(selectedFolderId)
            ? `
          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-sm" id="editFolderBtn">✏️ Sửa thư mục</button>
            <button class="btn btn-sm btn-danger" id="deleteFolderBtn">🗑️ Xóa</button>
          </div>`
            : ''
        }
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Danh sách mẫu Word (${filtered.length})</h3>
          <div class="btn-group">
            <label class="btn btn-primary" style="cursor:pointer;">
              ⬆️ Tải lên DOCX
              <input type="file" id="uploadDocxInput" accept=".docx" multiple hidden />
            </label>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
          <input type="search" id="libSearchInput" value="${escapeHtml(appState.globalSearch)}" placeholder="Tìm theo tên mẫu, tên file, mô tả..." style="flex:1;min-width:200px;" />
          <select id="libSortSelect" style="width:200px;">
            <option value="orderAsc" ${sortBy === 'orderAsc' ? 'selected' : ''}>Thứ tự mẫu (1 → 8)</option>
            <option value="updatedDesc" ${sortBy === 'updatedDesc' ? 'selected' : ''}>Mới cập nhật</option>
            <option value="createdDesc" ${sortBy === 'createdDesc' ? 'selected' : ''}>Mới tạo</option>
            <option value="nameAsc" ${sortBy === 'nameAsc' ? 'selected' : ''}>Tên A → Z</option>
          </select>
        </div>

        ${
          filtered.length === 0
            ? '<div class="empty-state"><div class="empty-icon">📄</div><p>Không tìm thấy mẫu Word nào trong thư mục này.</p></div>'
            : `<div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mẫu văn bản</th>
                      <th>Thư mục</th>
                      <th>Trường / Dung lượng</th>
                      <th>Cập nhật</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered
                      .map((t) => {
                        const fld = folderMap.get(t.folderId);
                        return `
                        <tr>
                          <td>
                            <strong>${escapeHtml(t.name)}</strong><br/>
                            <span class="form-hint">${escapeHtml(t.originalFileName)}</span>
                            ${t.description ? `<div class="form-hint">${escapeHtml(t.description)}</div>` : ''}
                          </td>
                          <td>${fld ? escapeHtml(fld.name) : '<span class="form-hint">Chưa phân loại</span>'}</td>
                          <td>
                            <span class="badge badge-primary">${(t.fields || []).length} trường</span>
                            <div class="form-hint">${formatBytes(t.size)}</div>
                          </td>
                          <td style="font-size:12px;white-space:nowrap;">${formatDateTime(t.updatedAt)}</td>
                          <td>
                            <div class="btn-group">
                              <button class="btn btn-sm btn-primary js-gen" data-id="${escapeHtml(t.id)}" title="Tạo văn bản">📝 Tạo</button>
                              <button class="btn btn-sm js-setup" data-id="${escapeHtml(t.id)}" title="Thiết lập trường">⚙️ Trường</button>
                              <button class="btn btn-sm js-edit" data-id="${escapeHtml(t.id)}" title="Sửa thông tin / di chuyển">✏️</button>
                              <button class="btn btn-sm js-dl" data-id="${escapeHtml(t.id)}" title="Tải mẫu gốc">⬇️</button>
                              <button class="btn btn-sm btn-danger js-del" data-id="${escapeHtml(t.id)}" title="Xóa mẫu">🗑️</button>
                            </div>
                          </td>
                        </tr>`;
                      })
                      .join('')}
                  </tbody>
                </table>
              </div>`
        }
      </div>
    </div>
  `;

  // Folder selection
  container.querySelectorAll('.folder-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectedFolderId = el.dataset.folder;
      renderLibrary(container);
    });
  });

  // Search & Sort
  container.querySelector('#libSearchInput')?.addEventListener('input', (e) => {
    appState.globalSearch = e.target.value;
    renderLibrary(container);
  });
  container.querySelector('#libSortSelect')?.addEventListener('change', (e) => {
    sortBy = e.target.value;
    renderLibrary(container);
  });

  // Folder CRUD
  container.querySelector('#newFolderBtn')?.addEventListener('click', () => {
    openFolderModal(null, folders, () => renderLibrary(container));
  });
  container.querySelector('#editFolderBtn')?.addEventListener('click', () => {
    const f = folderMap.get(selectedFolderId);
    if (f) openFolderModal(f, folders, () => renderLibrary(container));
  });
  container.querySelector('#deleteFolderBtn')?.addEventListener('click', async () => {
    const f = folderMap.get(selectedFolderId);
    if (!f) return;
    const ok = await confirmDialog(`Xóa thư mục "${f.name}"? Các mẫu bên trong sẽ được chuyển về "Chưa phân loại".`);
    if (!ok) return;
    for (const t of templates.filter((x) => x.folderId === f.id)) {
      await db.put('templates', { ...t, folderId: null, updatedAt: new Date().toISOString() });
    }
    for (const sub of folders.filter((x) => x.parentId === f.id)) {
      await db.put('folders', { ...sub, parentId: null, updatedAt: new Date().toISOString() });
    }
    await db.delete('folders', f.id);
    await db.logActivity('Xóa thư mục', f.name);
    selectedFolderId = 'ALL';
    showToast('Đã xóa thư mục.', 'success');
    renderLibrary(container);
  });

  // Upload DOCX
  container.querySelector('#uploadDocxInput')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxBytes = (getSettings().maxFileSizeMB || 15) * 1024 * 1024;
    let uploaded = 0;

    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.doc')) {
        showToast(`File "${file.name}" là định dạng .doc cũ. Vui lòng lưu lại dưới dạng .docx trong Word trước khi tải lên.`, 'warning', 5500);
        continue;
      }
      if (!lower.endsWith('.docx')) {
        showToast(`Bỏ qua "${file.name}": chỉ chấp nhận tệp .docx.`, 'error');
        continue;
      }
      if (file.size > maxBytes) {
        showToast(`File "${file.name}" vượt giới hạn ${getSettings().maxFileSizeMB}MB.`, 'error');
        continue;
      }

      const now = new Date().toISOString();
      const tpl = {
        id: uid('tpl'),
        name: file.name.replace(/\.docx$/i, ''),
        originalFileName: file.name,
        folderId: selectedFolderId === 'ALL' ? null : selectedFolderId,
        description: '',
        size: file.size,
        fileBlob: file,
        fields: [],
        createdAt: now,
        updatedAt: now,
        lastUsedAt: null,
      };
      await db.put('templates', tpl);
      await db.logActivity('Tải lên mẫu DOCX', file.name);
      uploaded++;
    }

    if (uploaded > 0) {
      showToast(`Đã tải lên thành công ${uploaded} mẫu Word.`, 'success');
      renderLibrary(container);
    }
    e.target.value = '';
  });

  // Template actions
  container.querySelectorAll('.js-gen').forEach((b) =>
    b.addEventListener('click', () => navigateTo('generator', { templateId: b.dataset.id }))
  );
  container.querySelectorAll('.js-setup').forEach((b) =>
    b.addEventListener('click', () => navigateTo('setup', { templateId: b.dataset.id }))
  );
  container.querySelectorAll('.js-edit').forEach((b) =>
    b.addEventListener('click', () => {
      const t = templates.find((x) => x.id === b.dataset.id);
      if (t) openEditTemplateModal(t, folders, () => renderLibrary(container));
    })
  );
  container.querySelectorAll('.js-dl').forEach((b) =>
    b.addEventListener('click', () => {
      const t = templates.find((x) => x.id === b.dataset.id);
      if (t?.fileBlob) downloadBlob(t.fileBlob, t.originalFileName || `${t.name}.docx`);
    })
  );
  container.querySelectorAll('.js-del').forEach((b) =>
    b.addEventListener('click', async () => {
      const t = templates.find((x) => x.id === b.dataset.id);
      if (!t) return;
      const ok = await confirmDialog(`Bạn chắc chắn muốn xóa mẫu "${t.name}"? Thao tác này không thể hoàn tác.`);
      if (!ok) return;
      await db.delete('templates', t.id);
      await db.logActivity('Xóa mẫu văn bản', t.name);
      showToast('Đã xóa mẫu văn bản.', 'success');
      renderLibrary(container);
    })
  );
}

function openFolderModal(folder, allFolders, onSaved) {
  const isEdit = Boolean(folder);
  const parentOptions = allFolders
    .filter((f) => !folder || f.id !== folder.id)
    .map(
      (f) =>
        `<option value="${escapeHtml(f.id)}" ${folder?.parentId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
    )
    .join('');

  openModal({
    title: isEdit ? 'Chỉnh sửa thư mục' : 'Tạo thư mục mới',
    bodyHtml: `
      <div class="form-group">
        <label>Tên thư mục <span class="required-mark">*</span></label>
        <input type="text" id="fldName" value="${escapeHtml(folder?.name || '')}" placeholder="VD: Biểu mẫu sinh viên" />
      </div>
      <div class="form-group">
        <label>Thư mục cha (tùy chọn)</label>
        <select id="fldParent">
          <option value="">-- Không có (Thư mục gốc) --</option>
          ${parentOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Mô tả</label>
        <textarea id="fldDesc" placeholder="Mô tả ngắn về nhóm biểu mẫu...">${escapeHtml(folder?.description || '')}</textarea>
      </div>
    `,
    buttons: [
      { label: 'Hủy' },
      {
        label: 'Lưu thư mục',
        className: 'btn-primary',
        onClick: async (_, bodyEl) => {
          const name = bodyEl.querySelector('#fldName').value.trim();
          if (!name) {
            showToast('Vui lòng nhập tên thư mục.', 'error');
            return false;
          }
          const now = new Date().toISOString();
          await db.put('folders', {
            id: folder ? folder.id : uid('fld'),
            name,
            parentId: bodyEl.querySelector('#fldParent').value || null,
            description: bodyEl.querySelector('#fldDesc').value.trim(),
            createdAt: folder ? folder.createdAt : now,
            updatedAt: now,
          });
          await db.logActivity(isEdit ? 'Cập nhật thư mục' : 'Tạo thư mục', name);
          showToast('Đã lưu thư mục.', 'success');
          onSaved();
        },
      },
    ],
  });
}

function openEditTemplateModal(tpl, folders, onSaved) {
  const folderOptions = folders
    .map(
      (f) => `<option value="${escapeHtml(f.id)}" ${tpl.folderId === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
    )
    .join('');

  openModal({
    title: 'Chỉnh sửa thông tin mẫu',
    bodyHtml: `
      <div class="form-group">
        <label>Tên mẫu <span class="required-mark">*</span></label>
        <input type="text" id="tplName" value="${escapeHtml(tpl.name)}" />
      </div>
      <div class="form-group">
        <label>Thư mục</label>
        <select id="tplFolder">
          <option value="">-- Chưa phân loại --</option>
          ${folderOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Mô tả</label>
        <textarea id="tplDesc">${escapeHtml(tpl.description || '')}</textarea>
      </div>
    `,
    buttons: [
      { label: 'Hủy' },
      {
        label: 'Lưu thay đổi',
        className: 'btn-primary',
        onClick: async (_, bodyEl) => {
          const name = bodyEl.querySelector('#tplName').value.trim();
          if (!name) {
            showToast('Tên mẫu không được để trống.', 'error');
            return false;
          }
          await db.put('templates', {
            ...tpl,
            name,
            folderId: bodyEl.querySelector('#tplFolder').value || null,
            description: bodyEl.querySelector('#tplDesc').value.trim(),
            updatedAt: new Date().toISOString(),
          });
          await db.logActivity('Cập nhật mẫu', name);
          showToast('Đã cập nhật mẫu văn bản.', 'success');
          onSaved();
        },
      },
    ],
  });
}
