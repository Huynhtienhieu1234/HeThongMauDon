import { openDB, db } from './core/database.js';
import { getSettings } from './core/storage.js';
import { generateDocxBlob, renderDocxPreview } from './core/docxEngine.js';
import { seedSampleBM11IfNeeded, BM11_TEMPLATE_ID } from './core/seed.js';
import {
  applyStudentToForm,
  ensureStudentDbLoaded,
  findStudentByMssv,
  renderStudentInfoCardHtml,
} from './core/studentService.js';
import {
  downloadBlob,
  escapeHtml,
  formatBytes,
  formatDateValue,
  parseDateParts,
  slugifyFilename,
  todayISO,
  uid,
} from './utils/helpers.js';
import { showToast } from './utils/ui.js';

const state = {
  step: 1,
  templates: [],
  folders: [],
  search: '',
  selectedFolder: 'ALL',
  activeTemplate: null,
  formData: {},
  generatedBlob: null,
  outputFileName: '',
};

function updateStepper(step) {
  state.step = step;
  document.querySelectorAll('#studentStepper .step').forEach((el) => {
    const num = Number(el.dataset.step);
    el.classList.remove('active', 'done');
    if (num < step) el.classList.add('done');
    else if (num === step) el.classList.add('active');
  });
}

async function loadTemplates() {
  const [folders, templates] = await Promise.all([db.getAll('folders'), db.getAll('templates')]);
  state.folders = folders;
  // Chỉ hiển thị các mẫu đã có file DOCX và đã thiết lập ít nhất 1 trường, sắp xếp đúng thứ tự 1 -> 8
  state.templates = templates
    .filter((t) => t.fileBlob && Array.isArray(t.fields) && t.fields.length > 0)
    .sort((a, b) => {
      const oa = a.sortOrder ?? 999;
      const ob = b.sortOrder ?? 999;
      if (oa !== ob) return oa - ob;
      return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
    });
}

/* ==================== BƯỚC 1: CHỌN BIỂU MẪU ==================== */
function renderStep1() {
  updateStepper(1);
  const container = document.getElementById('studentContent');
  const folderMap = new Map(state.folders.map((f) => [f.id, f.name]));

  const kw = state.search.toLowerCase();
  const filtered = state.templates.filter((t) => {
    const matchFld = state.selectedFolder === 'ALL' || t.folderId === state.selectedFolder;
    const matchKw =
      !kw ||
      t.name.toLowerCase().includes(kw) ||
      (t.description || '').toLowerCase().includes(kw);
    return matchFld && matchKw;
  });

  container.innerHTML = `
    <div class="student-search-bar">
      <input type="search" id="stuSearchInput" value="${escapeHtml(state.search)}" placeholder="🔍 Tìm tên biểu mẫu (VD: Đơn xin nhận điểm I, bảo lưu, học lại...)" />
      ${
        state.folders.length > 1
          ? `<select id="stuFolderSelect" style="width:220px;">
              <option value="ALL">Tất cả nhóm biểu mẫu</option>
              ${state.folders
                .map(
                  (f) =>
                    `<option value="${escapeHtml(f.id)}" ${state.selectedFolder === f.id ? 'selected' : ''}>${escapeHtml(f.name)}</option>`
                )
                .join('')}
            </select>`
          : ''
      }
    </div>

    ${
      filtered.length === 0
        ? `<div class="card empty-state">
            <div class="empty-icon">📄</div>
            <p>Hiện chưa tìm thấy biểu mẫu phù hợp.</p>
          </div>`
        : `<div class="template-card-grid">
            ${filtered
              .map(
                (t) => `
              <div class="tpl-card">
                <div>
                  <div class="tpl-card-top">
                    <div class="tpl-card-icon">📄</div>
                    <div>
                      <h3>${escapeHtml(t.name)}</h3>
                      <p>${escapeHtml(t.description || 'Biểu mẫu sinh viên chuẩn định dạng Word (.docx).')}</p>
                    </div>
                  </div>
                </div>
                <div class="tpl-card-footer">
                  <span class="badge badge-primary">${escapeHtml(folderMap.get(t.folderId) || 'Biểu mẫu')}</span>
                  <button class="btn btn-primary btn-sm js-pick-tpl" data-id="${escapeHtml(t.id)}">Điền đơn →</button>
                </div>
              </div>`
              )
              .join('')}
          </div>`
    }
  `;

  container.querySelector('#stuSearchInput')?.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderStep1();
  });

  container.querySelector('#stuFolderSelect')?.addEventListener('change', (e) => {
    state.selectedFolder = e.target.value;
    renderStep1();
  });

  container.querySelectorAll('.js-pick-tpl').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tpl = state.templates.find((t) => t.id === btn.dataset.id);
      if (!tpl) return;
      state.activeTemplate = tpl;
      state.formData = {};
      renderStep2();
    });
  });
}

/* ==================== BƯỚC 2: ĐIỀN THÔNG TIN ==================== */
function renderStep2() {
  const tpl = state.activeTemplate;
  if (!tpl) return renderStep1();
  updateStepper(2);

  const container = document.getElementById('studentContent');
  const fields = tpl.fields || [];
  const settings = getSettings();

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <h2 class="card-title">📝 ${escapeHtml(tpl.name)}</h2>
          <p class="form-hint">Vui lòng điền đầy đủ các mục có dấu <span class="required-mark">*</span> rồi bấm <strong>Xem trước đơn</strong>.</p>
        </div>
        <div class="btn-group">
          ${
            tpl.id === BM11_TEMPLATE_ID
              ? '<button type="button" class="btn btn-sm" id="stuFillDemoBtn">⚡ Điền thử mẫu</button>'
              : ''
          }
          <button type="button" class="btn btn-sm" id="stuBackStep1Btn">← Đổi biểu mẫu</button>
        </div>
      </div>

      <div class="student-lookup-bar">
        <strong>🔎 Nhập Mã số sinh viên để tự động điền thông tin của bạn</strong>
        <div class="student-lookup-row">
          <input type="text" id="stuMssvLookupInput" value="${escapeHtml(state.formData.mssv || '')}" placeholder="Nhập MSSV của bạn (VD: 1108320016)..." autocomplete="off" />
          <button type="button" class="btn btn-primary btn-sm" id="stuMssvLookupBtn">🔍 Tra cứu &amp; Tự động điền</button>
        </div>
        <div id="stuStudentCardSlot"></div>
      </div>

      <form id="studentDocForm" novalidate>
        <div class="form-grid">
          ${fields.map((f) => renderFieldInput(f, state.formData, settings)).join('')}
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <button type="button" class="btn" id="stuResetFormBtn">↺ Nhập lại</button>
          <button type="submit" class="btn btn-primary" id="stuSubmitBtn">👁️ Tạo &amp; Xem trước đơn →</button>
        </div>
      </form>
    </div>
  `;

  container.querySelector('#stuBackStep1Btn')?.addEventListener('click', renderStep1);
  container.querySelector('#stuResetFormBtn')?.addEventListener('click', () => {
    state.formData = {};
    renderStep2();
  });

  // Dynamic table row add/remove
  container.querySelectorAll('.js-add-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = fields.find((f) => f.varName === btn.dataset.var);
      const tbody = container.querySelector(`tbody[data-table-var="${btn.dataset.var}"]`);
      if (field && tbody) {
        tbody.insertAdjacentHTML('beforeend', renderTableRowHtml(field, {}));
        bindRowRemoveButtons(tbody);
        renumberTableRows(tbody);
      }
    });
  });
  container.querySelectorAll('tbody[data-table-var]').forEach((tbody) => {
    bindRowRemoveButtons(tbody);
    renumberTableRows(tbody);
  });

  // Demo autofill for BM11
  container.querySelector('#stuFillDemoBtn')?.addEventListener('click', () => {
    state.formData = {
      ho_ten: 'Nguyễn Văn Minh',
      mssv: '0023410568',
      dien_thoai: '0918 456 789',
      email: 'nvminh.dttx@student.dthu.edu.vn',
      lop: 'ĐHGDTH23A - Từ xa',
      khoa: 'Giáo dục Tiểu học - Mầm non',
      dia_diem_hoc: 'Trung tâm GDTX tỉnh Đồng Tháp',
      hoc_ky: '1',
      nam_hoc: '2025 - 2026',
      ds_hoc_phan: [
        { ma_hp: 'GE4011', ten_hp: 'Tâm lý học đại cương', so_tc: '2', ghi_chu: 'Nộp giấy xác nhận bệnh viện' },
        { ma_hp: 'ED4105', ten_hp: 'Phương pháp dạy học Tiếng Việt 1', so_tc: '3', ghi_chu: 'Xin thi bổ sung đợt sau' },
      ],
      ly_do:
        'Em bị ốm phải nhập viện điều trị nội trú trong thời gian tổ chức thi kết thúc học phần (có giấy ra viện đính kèm). Kính mong Nhà trường xem xét cho em được nhận điểm I các học phần trên.',
      dia_danh: 'Đồng Tháp',
      ngay_lam_don: todayISO(),
      nguoi_lam_don: 'Nguyễn Văn Minh',
    };
    renderStep2();
    showToast('Đã điền dữ liệu mẫu thử!', 'info');
  });

  // Submit form -> Generate DOCX -> Step 3
  const form = container.querySelector('#studentDocForm');

  const runStuMssvLookup = async (rawCode, notifyIfMissing = false) => {
    const code = String(rawCode || '').trim();
    const slot = container.querySelector('#stuStudentCardSlot');
    if (!code) {
      if (slot) slot.innerHTML = '';
      state.matchedStudent = null;
      return;
    }
    const stu = await findStudentByMssv(code);
    if (stu) {
      state.matchedStudent = stu;
      applyStudentToForm(form, stu);
      const topInput = container.querySelector('#stuMssvLookupInput');
      if (topInput && topInput.value.trim() !== stu.mssv) topInput.value = stu.mssv;
      if (slot) slot.innerHTML = '';
      showToast(`Xin chào ${stu.ho_ten}! Đã tự động điền thông tin.`, 'success', 2500);
    } else if (notifyIfMissing) {
      state.matchedStudent = null;
      if (slot) {
        slot.innerHTML = `<div class="alert alert-warning" style="margin-top:10px;margin-bottom:0;">Không tìm thấy MSSV <strong>${escapeHtml(code)}</strong>. Bạn vui lòng kiểm tra lại hoặc tự nhập thông tin bên dưới.</div>`;
      }
    }
  };

  const stuLookupInput = container.querySelector('#stuMssvLookupInput');
  const stuLookupBtn = container.querySelector('#stuMssvLookupBtn');
  stuLookupBtn?.addEventListener('click', () => runStuMssvLookup(stuLookupInput?.value, true));
  stuLookupInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runStuMssvLookup(stuLookupInput.value, true);
    }
  });
  stuLookupInput?.addEventListener('input', () => {
    if (stuLookupInput.value.trim().length >= 8) runStuMssvLookup(stuLookupInput.value, false);
  });

  const stuFormMssv = form?.querySelector('[name="mssv"], [name="ma_sv"], [name="ma_sinh_vien"]');
  stuFormMssv?.addEventListener('input', () => {
    if (stuFormMssv.value.trim().length >= 8) runStuMssvLookup(stuFormMssv.value, false);
  });
  stuFormMssv?.addEventListener('blur', () => {
    if (stuFormMssv.value.trim().length >= 5) runStuMssvLookup(stuFormMssv.value, false);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = container.querySelector('#stuSubmitBtn');
    const rawData = {};
    const renderData = state.matchedStudent ? { ...state.matchedStudent } : {};

    for (const f of fields) {
      if (f.type === 'table') {
        const tbody = container.querySelector(`tbody[data-table-var="${f.varName}"]`);
        const rows = [];
        tbody?.querySelectorAll('tr').forEach((tr) => {
          const rowObj = {};
          let hasAny = false;
          (f.columns || []).forEach((col) => {
            const val = tr.querySelector(`[data-col="${col.key}"]`)?.value.trim() || '';
            if (val) hasAny = true;
            rowObj[col.key] = val;
          });
          if (hasAny) rows.push({ stt: rows.length + 1, ...rowObj });
        });
        if (f.required && rows.length === 0) {
          showToast(`Vui lòng nhập ít nhất 1 dòng cho "${f.label}".`, 'error');
          return;
        }
        rawData[f.varName] = rows;
        renderData[f.varName] = rows;
      } else if (f.type === 'checkbox') {
        const checked = Boolean(form.querySelector(`[name="${f.varName}"]`)?.checked);
        rawData[f.varName] = checked;
        renderData[f.varName] = checked ? '☑' : '☐';
      } else {
        const el = form.querySelector(`[name="${f.varName}"]`);
        const val = (el?.value || '').trim();
        if (f.required && !val) {
          showToast(`Vui lòng nhập "${f.label}".`, 'error');
          el?.focus();
          return;
        }
        if (val && f.varName === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
          showToast('Địa chỉ Email chưa đúng định dạng (VD: ten@dthu.edu.vn).', 'error');
          el?.focus();
          return;
        }
        rawData[f.varName] = val;
        if (f.type === 'date') {
          renderData[f.varName] = formatDateValue(val, settings.dateFormat);
          if (f.varName === 'ngay_lam_don' || !renderData.ngay) {
            const parts = parseDateParts(val);
            renderData.ngay = parts.ngay;
            renderData.thang = parts.thang;
            renderData.nam = parts.nam;
          }
        } else {
          renderData[f.varName] = val;
        }
      }
    }

    if ('nguoi_lam_don' in renderData && !renderData.nguoi_lam_don && renderData.ho_ten) {
      renderData.nguoi_lam_don = renderData.ho_ten;
      rawData.nguoi_lam_don = renderData.ho_ten;
    }

    const studentPart = rawData.mssv || rawData.ho_ten || todayISO();
    const outName = `${slugifyFilename(tpl.name)}_${slugifyFilename(studentPart)}.docx`;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Đang tạo file Word...';

      const blob = await generateDocxBlob(tpl.fileBlob, renderData);
      state.formData = rawData;
      state.generatedBlob = blob;
      state.outputFileName = outName;

      // Lưu lịch sử nhẹ trên trình duyệt
      try {
        const now = new Date().toISOString();
        await db.put('history', {
          id: uid('his'),
          docName: outName,
          templateId: tpl.id,
          templateName: tpl.name,
          inputData: rawData,
          status: 'Thành công (Cổng SV)',
          fileBlob: blob,
          size: blob.size,
          createdAt: now,
        });
      } catch {
        // Bỏ qua nếu trình duyệt chặn ghi
      }

      showToast('Đã tạo xong văn bản! Hãy kiểm tra lại trước khi tải xuống.', 'success');
      renderStep3();
    } catch (err) {
      console.error(err);
      showToast(`Không thể tạo file Word: ${err.message}`, 'error', 5000);
      submitBtn.disabled = false;
      submitBtn.textContent = '👁️ Tạo & Xem trước đơn →';
    }
  });
}

/* ==================== BƯỚC 3: XEM TRƯỚC & TẢI WORD ==================== */
async function renderStep3() {
  if (!state.generatedBlob) return renderStep2();
  updateStepper(3);

  const container = document.getElementById('studentContent');
  container.innerHTML = `
    <div class="card">
      <div class="preview-toolbar">
        <div>
          <h2 class="card-title">✅ ${escapeHtml(state.outputFileName)}</h2>
          <span class="form-hint">Dung lượng: ${formatBytes(state.generatedBlob.size)} • Kiểm tra kỹ thông tin rồi bấm tải về máy để in và ký tên.</span>
        </div>
        <div class="btn-group">
          <button class="btn" id="stuEditBackBtn">✏️ Quay lại sửa thông tin</button>
          <button class="btn btn-success" id="stuDownloadBtn">⬇️ Tải xuống file Word (.docx)</button>
        </div>
      </div>

      <div class="alert alert-info">
        <strong>Mẹo:</strong> Đây là <strong>bản xem trước</strong> trên trình duyệt. File <strong>.docx tải về</strong> giữ nguyên 100% phông chữ, căn lề và bảng biểu chuẩn của Nhà trường.
      </div>

      <div class="preview-stage" id="stuPreviewStage">
        <div class="loading-state">Đang hiển thị bản xem trước...</div>
      </div>
    </div>
  `;

  container.querySelector('#stuEditBackBtn')?.addEventListener('click', renderStep2);
  container.querySelector('#stuDownloadBtn')?.addEventListener('click', () => {
    downloadBlob(state.generatedBlob, state.outputFileName);
    showToast(`Đang tải xuống "${state.outputFileName}"...`, 'success');
  });

  const stage = container.querySelector('#stuPreviewStage');
  try {
    await renderDocxPreview(state.generatedBlob, stage);
  } catch (err) {
    stage.innerHTML = `<div class="alert alert-warning">Không thể hiển thị bản xem trước (${escapeHtml(err.message)}). Bạn vẫn có thể bấm nút <strong>Tải xuống file Word (.docx)</strong> ở trên.</div>`;
  }
}

/* ==================== HELPERS RENDER FORM ==================== */
function renderFieldInput(f, prefill, settings) {
  const val =
    prefill[f.varName] !== undefined
      ? prefill[f.varName]
      : f.varName === 'dia_danh' && !f.defaultValue
      ? settings.defaultPlace
      : f.type === 'date' && !f.defaultValue
      ? todayISO()
      : f.defaultValue || '';

  const reqMark = f.required ? '<span class="required-mark">*</span>' : '';
  const hintHtml = f.hint ? `<span class="form-hint">${escapeHtml(f.hint)}</span>` : '';

  if (f.type === 'table') {
    const rows = Array.isArray(val) && val.length ? val : [{}];
    return `
      <div class="form-group full-width">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <label>${escapeHtml(f.label)}${reqMark}</label>
          <button type="button" class="btn btn-sm btn-primary js-add-row" data-var="${escapeHtml(f.varName)}">+ Thêm dòng</button>
        </div>
        ${hintHtml}
        <div class="subtable-wrap">
          <table>
            <thead>
              <tr>
                <th style="width:46px;">TT</th>
                ${(f.columns || []).map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}
                <th style="width:46px;"></th>
              </tr>
            </thead>
            <tbody data-table-var="${escapeHtml(f.varName)}">
              ${rows.map((r) => renderTableRowHtml(f, r)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (f.type === 'textarea' || f.type === 'multiline') {
    return `
      <div class="form-group full-width">
        <label>${escapeHtml(f.label)}${reqMark}</label>
        <textarea name="${escapeHtml(f.varName)}" placeholder="${escapeHtml(f.hint || '')}">${escapeHtml(val)}</textarea>
        ${hintHtml}
      </div>
    `;
  }

  if (f.type === 'select') {
    return `
      <div class="form-group">
        <label>${escapeHtml(f.label)}${reqMark}</label>
        <select name="${escapeHtml(f.varName)}">
          <option value="">-- Chọn --</option>
          ${(f.options || [])
            .map(
              (opt) =>
                `<option value="${escapeHtml(opt)}" ${String(val) === String(opt) ? 'selected' : ''}>${escapeHtml(opt)}</option>`
            )
            .join('')}
        </select>
        ${hintHtml}
      </div>
    `;
  }

  if (f.type === 'checkbox') {
    return `
      <div class="form-group">
        <label class="checkbox-row" style="margin-top:24px;">
          <input type="checkbox" name="${escapeHtml(f.varName)}" ${val ? 'checked' : ''} />
          <span>${escapeHtml(f.label)}${reqMark}</span>
        </label>
        ${hintHtml}
      </div>
    `;
  }

  const inputType = f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text';
  return `
    <div class="form-group">
      <label>${escapeHtml(f.label)}${reqMark}</label>
      <input type="${inputType}" name="${escapeHtml(f.varName)}" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.hint || '')}" />
      ${hintHtml}
    </div>
  `;
}

function renderTableRowHtml(field, rowData) {
  return `
    <tr>
      <td class="js-stt" style="text-align:center;font-weight:700;">1</td>
      ${(field.columns || [])
        .map(
          (c) => `
        <td>
          <input type="text" data-col="${escapeHtml(c.key)}" value="${escapeHtml(rowData[c.key] || '')}" placeholder="${escapeHtml(c.placeholder || '')}" />
        </td>`
        )
        .join('')}
      <td>
        <button type="button" class="btn btn-sm btn-danger js-del-row" title="Xóa dòng">✕</button>
      </td>
    </tr>
  `;
}

function bindRowRemoveButtons(tbody) {
  tbody.querySelectorAll('.js-del-row').forEach((btn) => {
    btn.onclick = () => {
      if (tbody.querySelectorAll('tr').length <= 1) {
        tbody.querySelectorAll('input').forEach((i) => (i.value = ''));
        return;
      }
      btn.closest('tr').remove();
      renumberTableRows(tbody);
    };
  });
}

function renumberTableRows(tbody) {
  tbody.querySelectorAll('tr').forEach((tr, idx) => {
    const stt = tr.querySelector('.js-stt');
    if (stt) stt.textContent = String(idx + 1);
  });
}

async function bootstrapStudent() {
  document.getElementById('studentHomeBtn')?.addEventListener('click', () => {
    renderStep1();
  });

  try {
    await openDB();
    ensureStudentDbLoaded(); // Tải nền DB sinh viên (26.039 hồ sơ)
    await seedSampleBM11IfNeeded(false);
    await loadTemplates();

    // Hỗ trợ mở thẳng 1 mẫu qua ?template=tpl_bm11_diem_i
    const urlParams = new URLSearchParams(window.location.search);
    const tplId = urlParams.get('template');
    if (tplId) {
      const found = state.templates.find((t) => t.id === tplId);
      if (found) {
        state.activeTemplate = found;
        renderStep2();
        return;
      }
    }

    renderStep1();
  } catch (err) {
    console.error(err);
    document.getElementById('studentContent').innerHTML = `
      <div class="alert alert-warning">
        Không thể tải danh sách biểu mẫu: ${escapeHtml(err.message)}
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootstrapStudent);
