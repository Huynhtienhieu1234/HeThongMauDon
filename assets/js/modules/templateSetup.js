import { db } from '../core/database.js';
import { extractVariablesFromDocx } from '../core/docxEngine.js';
import { escapeHtml, uid } from '../utils/helpers.js';
import { showToast, openModal, confirmDialog } from '../utils/ui.js';
import { appState, navigateTo } from './navigation.js';

const FIELD_TYPES = [
  { value: 'text', label: 'Văn bản ngắn' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'multiline', label: 'Nội dung nhiều dòng' },
  { value: 'date', label: 'Ngày tháng' },
  { value: 'number', label: 'Số' },
  { value: 'select', label: 'Danh sách lựa chọn' },
  { value: 'checkbox', label: 'Checkbox (Đánh dấu)' },
  { value: 'table', label: 'Bảng danh sách (Lặp dòng)' },
];

export async function renderTemplateSetup(container, params = {}) {
  const templates = await db.getAll('templates');
  if (!templates.length) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">⚙️</div>
        <p>Chưa có mẫu DOCX nào để thiết lập. Hãy tải mẫu lên trong Thư viện mẫu trước.</p>
        <button class="btn btn-primary" style="margin-top:12px;" id="goLibBtn">Đi đến Thư viện mẫu</button>
      </div>`;
    container.querySelector('#goLibBtn')?.addEventListener('click', () => navigateTo('library'));
    return;
  }

  const activeId = params.templateId || appState.selectedTemplateId || templates[0].id;
  const tpl = templates.find((t) => t.id === activeId) || templates[0];
  appState.selectedTemplateId = tpl.id;
  const fields = Array.isArray(tpl.fields) ? [...tpl.fields] : [];

  let detected = { variables: [], loops: [] };
  try {
    if (tpl.fileBlob) {
      detected = await extractVariablesFromDocx(tpl.fileBlob);
    }
  } catch (err) {
    console.warn('Không quét được biến DOCX:', err);
  }

  const typeLabel = (val) => FIELD_TYPES.find((t) => t.value === val)?.label || val;

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex:1;">
          <label style="font-weight:700;">Chọn mẫu thiết lập:</label>
          <select id="setupTplSelect" style="max-width:360px;">
            ${templates
              .map(
                (t) =>
                  `<option value="${escapeHtml(t.id)}" ${t.id === tpl.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="btn-group">
          <button class="btn btn-primary" id="addFieldBtn">+ Thêm trường mới</button>
          <button class="btn btn-success" id="testGenerateBtn">📝 Dùng mẫu này tạo văn bản</button>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>🔍 Biến phát hiện tự động trong file DOCX:</strong>
        ${
          detected.variables.length || detected.loops.length
            ? `<div class="pill-list" style="margin-top:8px;">
                ${detected.variables
                  .map((v) => `<span class="var-pill js-quick-add" data-var="${escapeHtml(v)}" title="Bấm để thêm trường nhanh">{{${escapeHtml(v)}}}</span>`)
                  .join('')}
                ${detected.loops
                  .map((v) => `<span class="var-pill js-quick-add" data-var="${escapeHtml(v)}" data-loop="1" title="Vòng lặp bảng">{{#${escapeHtml(v)}}}</span>`)
                  .join('')}
              </div>`
            : '<span>Chưa tìm thấy thẻ biến <code>{{ten_bien}}</code> trong file DOCX này. Hãy gắn thẻ biến trong Word rồi tải lên lại.</span>'
        }
      </div>

      ${
        fields.length === 0
          ? '<div class="empty-state"><p>Mẫu này chưa có trường dữ liệu nào. Bấm <strong>+ Thêm trường mới</strong> hoặc bấm vào thẻ biến màu xanh phía trên.</p></div>'
          : `<div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tên hiển thị</th>
                    <th>Biến DOCX</th>
                    <th>Loại trường</th>
                    <th>Bắt buộc</th>
                    <th>Mặc định</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  ${fields
                    .map(
                      (f, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>
                        <strong>${escapeHtml(f.label)}</strong>
                        ${f.hint ? `<div class="form-hint">${escapeHtml(f.hint)}</div>` : ''}
                      </td>
                      <td><code>{{${escapeHtml(f.varName)}}}</code></td>
                      <td><span class="badge badge-primary">${escapeHtml(typeLabel(f.type))}</span></td>
                      <td>${f.required ? '<span class="badge badge-danger">Bắt buộc</span>' : '<span class="form-hint">Tùy chọn</span>'}</td>
                      <td>${escapeHtml(f.defaultValue || '—')}</td>
                      <td>
                        <div class="btn-group">
                          <button class="btn btn-sm js-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''} title="Lên">↑</button>
                          <button class="btn btn-sm js-down" data-idx="${idx}" ${idx === fields.length - 1 ? 'disabled' : ''} title="Xuống">↓</button>
                          <button class="btn btn-sm js-edit-f" data-idx="${idx}">✏️</button>
                          <button class="btn btn-sm btn-danger js-del-f" data-idx="${idx}">🗑️</button>
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

  const saveFields = async (nextFields, msg = 'Đã lưu cấu hình trường.') => {
    await db.put('templates', {
      ...tpl,
      fields: nextFields,
      updatedAt: new Date().toISOString(),
    });
    await db.logActivity('Cập nhật thiết lập mẫu', `${tpl.name} (${nextFields.length} trường)`);
    showToast(msg, 'success');
    renderTemplateSetup(container, { templateId: tpl.id });
  };

  container.querySelector('#setupTplSelect')?.addEventListener('change', (e) => {
    renderTemplateSetup(container, { templateId: e.target.value });
  });

  container.querySelector('#testGenerateBtn')?.addEventListener('click', () => {
    navigateTo('generator', { templateId: tpl.id });
  });

  container.querySelector('#addFieldBtn')?.addEventListener('click', () => {
    openFieldModal(null, (field) => saveFields([...fields, field], 'Đã thêm trường dữ liệu.'));
  });

  container.querySelectorAll('.js-quick-add').forEach((pill) => {
    pill.addEventListener('click', () => {
      const v = pill.dataset.var;
      if (fields.some((f) => f.varName === v)) {
        showToast(`Biến {{${v}}} đã được cấu hình rồi.`, 'info');
        return;
      }
      openFieldModal(
        {
          id: uid('f'),
          label: v.replace(/_/g, ' '),
          varName: v,
          type: pill.dataset.loop ? 'table' : 'text',
          required: false,
          defaultValue: '',
          hint: '',
          options: [],
          columns: pill.dataset.loop ? [{ key: 'col1', label: 'Cột 1', placeholder: '' }] : [],
        },
        (field) => saveFields([...fields, field], `Đã liên kết biến {{${field.varName}}}.`)
      );
    });
  });

  container.querySelectorAll('.js-up').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      if (i <= 0) return;
      [fields[i - 1], fields[i]] = [fields[i], fields[i - 1]];
      saveFields(fields, 'Đã thay đổi thứ tự trường.');
    })
  );

  container.querySelectorAll('.js-down').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      if (i >= fields.length - 1) return;
      [fields[i], fields[i + 1]] = [fields[i + 1], fields[i]];
      saveFields(fields, 'Đã thay đổi thứ tự trường.');
    })
  );

  container.querySelectorAll('.js-edit-f').forEach((btn) =>
    btn.addEventListener('click', () => {
      const i = Number(btn.dataset.idx);
      openFieldModal(fields[i], (updated) => {
        fields[i] = updated;
        saveFields(fields, 'Đã cập nhật trường dữ liệu.');
      });
    })
  );

  container.querySelectorAll('.js-del-f').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.idx);
      const ok = await confirmDialog(`Xóa trường "${fields[i].label}"?`);
      if (!ok) return;
      fields.splice(i, 1);
      saveFields(fields, 'Đã xóa trường dữ liệu.');
    })
  );
}

function openFieldModal(existing, onSave) {
  const f = existing || {
    id: uid('f'),
    label: '',
    varName: '',
    type: 'text',
    required: false,
    defaultValue: '',
    hint: '',
    options: [],
    columns: [],
  };

  openModal({
    title: existing ? 'Chỉnh sửa trường dữ liệu' : 'Thêm trường dữ liệu',
    bodyHtml: `
      <div class="form-group">
        <label>Tên hiển thị <span class="required-mark">*</span></label>
        <input type="text" id="fLabel" value="${escapeHtml(f.label)}" placeholder="VD: Họ và tên sinh viên" />
      </div>
      <div class="form-group">
        <label>Tên biến trong DOCX (không chứa {{ }}) <span class="required-mark">*</span></label>
        <input type="text" id="fVar" value="${escapeHtml(f.varName)}" placeholder="VD: ho_ten" />
      </div>
      <div class="form-group">
        <label>Loại trường</label>
        <select id="fType">
          ${FIELD_TYPES.map(
            (t) => `<option value="${t.value}" ${f.type === t.value ? 'selected' : ''}>${t.label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" id="fOptionsWrap" style="${f.type === 'select' ? '' : 'display:none;'}">
        <label>Các lựa chọn (mỗi dòng 1 giá trị)</label>
        <textarea id="fOptions" placeholder="1&#10;2&#10;Hè">${escapeHtml((f.options || []).join('\n'))}</textarea>
      </div>
      <div class="form-group" id="fColumnsWrap" style="${f.type === 'table' ? '' : 'display:none;'}">
        <label>Cấu hình cột bảng (mỗi dòng: <code>ten_bien:Tên cột</code>)</label>
        <textarea id="fColumns" placeholder="ma_hp:Mã HP&#10;ten_hp:Tên học phần">${escapeHtml(
          (f.columns || []).map((c) => `${c.key}:${c.label}`).join('\n')
        )}</textarea>
      </div>
      <div class="form-group">
        <label>Giá trị mặc định</label>
        <input type="text" id="fDefault" value="${escapeHtml(f.defaultValue || '')}" />
      </div>
      <div class="form-group">
        <label>Hướng dẫn nhập liệu</label>
        <input type="text" id="fHint" value="${escapeHtml(f.hint || '')}" placeholder="Gợi ý cho người nhập..." />
      </div>
      <label class="checkbox-row">
        <input type="checkbox" id="fReq" ${f.required ? 'checked' : ''} />
        <span>Bắt buộc nhập</span>
      </label>
    `,
    onMount: (bodyEl) => {
      const typeSel = bodyEl.querySelector('#fType');
      typeSel.addEventListener('change', () => {
        bodyEl.querySelector('#fOptionsWrap').style.display = typeSel.value === 'select' ? '' : 'none';
        bodyEl.querySelector('#fColumnsWrap').style.display = typeSel.value === 'table' ? '' : 'none';
      });
    },
    buttons: [
      { label: 'Hủy' },
      {
        label: 'Lưu trường',
        className: 'btn-primary',
        onClick: (_, bodyEl) => {
          const label = bodyEl.querySelector('#fLabel').value.trim();
          const varName = bodyEl.querySelector('#fVar').value.trim().replace(/[{}]/g, '');
          if (!label || !varName) {
            showToast('Vui lòng nhập đầy đủ Tên hiển thị và Tên biến.', 'error');
            return false;
          }
          const type = bodyEl.querySelector('#fType').value;
          const options = bodyEl
            .querySelector('#fOptions')
            .value.split('\n')
            .map((s) => s.trim())
            .filter(Boolean);
          const columns = bodyEl
            .querySelector('#fColumns')
            .value.split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [key, lbl] = line.split(':');
              return { key: (key || '').trim(), label: (lbl || key || '').trim(), placeholder: '' };
            })
            .filter((c) => c.key);

          onSave({
            id: f.id,
            label,
            varName,
            type,
            required: bodyEl.querySelector('#fReq').checked,
            defaultValue: bodyEl.querySelector('#fDefault').value,
            hint: bodyEl.querySelector('#fHint').value.trim(),
            options,
            columns,
          });
        },
      },
    ],
  });
}
