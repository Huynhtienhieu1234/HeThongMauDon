import { db } from '../core/database.js';
import { getSettings } from '../core/storage.js';
import { generateDocxBlob } from '../core/docxEngine.js';
import { BM11_TEMPLATE_ID } from '../core/seed.js';
import {
  applyStudentToForm,
  ensureStudentDbLoaded,
  findStudentByMssv,
  renderStudentInfoCardHtml,
} from '../core/studentService.js';
import {
  escapeHtml,
  formatDateValue,
  parseDateParts,
  slugifyFilename,
  todayISO,
  uid,
} from '../utils/helpers.js';
import { showToast } from '../utils/ui.js';
import { appState, navigateTo } from './navigation.js';

export async function renderGenerator(container, params = {}) {
  const templates = (await db.getAll('templates')).sort((a, b) => {
    const oa = a.sortOrder ?? 999;
    const ob = b.sortOrder ?? 999;
    if (oa !== ob) return oa - ob;
    return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
  });
  if (!templates.length) {
    container.innerHTML = `
      <div class="card empty-state">
        <div class="empty-icon">📝</div>
        <p>Chưa có mẫu Word nào. Hãy tải mẫu lên trong Thư viện mẫu.</p>
        <button class="btn btn-primary" style="margin-top:12px;" id="genGoLibBtn">Mở Thư viện mẫu</button>
      </div>`;
    container.querySelector('#genGoLibBtn')?.addEventListener('click', () => navigateTo('library'));
    return;
  }

  const activeId = params.templateId || appState.selectedTemplateId || templates[0].id;
  const tpl = templates.find((t) => t.id === activeId) || templates[0];
  appState.selectedTemplateId = tpl.id;

  const fields = Array.isArray(tpl.fields) ? tpl.fields : [];
  const prefill = params.prefillData || (appState.lastFormData && params.keepData ? appState.lastFormData : {});
  const settings = getSettings();

  container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex:1;">
          <label style="font-weight:700;">Chọn mẫu văn bản:</label>
          <select id="genTplSelect" style="max-width:380px;">
            ${templates
              .map(
                (t) =>
                  `<option value="${escapeHtml(t.id)}" ${t.id === tpl.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="btn-group">
          ${
            tpl.id === BM11_TEMPLATE_ID
              ? '<button class="btn btn-sm" id="fillDemoBM11Btn">⚡ Điền dữ liệu mẫu thử</button>'
              : ''
          }
          <button class="btn btn-sm" id="goSetupFromGenBtn">⚙️ Sửa trường</button>
        </div>
      </div>

      ${
        fields.length === 0
          ? `<div class="alert alert-warning">
              Mẫu <strong>${escapeHtml(tpl.name)}</strong> chưa được thiết lập trường dữ liệu.
              Hãy bấm <strong>⚙️ Sửa trường</strong> để thêm các trường nhập liệu.
            </div>`
          : `<div class="student-lookup-bar">
              <strong>🔎 Tự động điền thông tin theo Mã số sinh viên (DB 26.039 SV)</strong>
              <div class="student-lookup-row">
                <input type="text" id="genMssvLookupInput" placeholder="Nhập MSSV (VD: 1108320016)..." autocomplete="off" />
                <button type="button" class="btn btn-primary btn-sm" id="genMssvLookupBtn">🔍 Tra cứu &amp; Điền tự động</button>
              </div>
              <div id="genStudentCardSlot"></div>
            </div>

            <form id="docGenForm" novalidate>
              <div class="form-grid">
                ${fields.map((f) => renderFieldInput(f, prefill, settings)).join('')}
              </div>

              <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
                <div class="form-group" style="margin-bottom:0;min-width:260px;flex:1;max-width:420px;">
                  <label>Tên file Word xuất ra</label>
                  <input type="text" id="outputFileNameInput" value="${escapeHtml(
                    slugifyFilename(tpl.name) + '_' + todayISO()
                  )}" placeholder="Ten_file_van_ban" />
                </div>
                <div class="btn-group">
                  <button type="reset" class="btn">↺ Làm mới</button>
                  <button type="submit" class="btn btn-primary" id="submitGenBtn">👁️ Tạo văn bản &amp; Xem trước</button>
                </div>
              </div>
            </form>`
      }
    </div>
  `;

  container.querySelector('#genTplSelect')?.addEventListener('change', (e) => {
    renderGenerator(container, { templateId: e.target.value });
  });

  container.querySelector('#goSetupFromGenBtn')?.addEventListener('click', () => {
    navigateTo('setup', { templateId: tpl.id });
  });

  // Bind dynamic table row add/remove
  container.querySelectorAll('.js-add-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      const varName = btn.dataset.var;
      const field = fields.find((f) => f.varName === varName);
      if (!field) return;
      const tbody = container.querySelector(`tbody[data-table-var="${varName}"]`);
      if (tbody) {
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

  // Quick demo fill for BM11
  container.querySelector('#fillDemoBM11Btn')?.addEventListener('click', () => {
    const demo = {
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
        'Em bị ốm phải nhập viện điều trị nội trú trong thời gian tổ chức thi kết thúc học phần (có giấy ra viện của Bệnh viện Đa khoa Đồng Tháp đính kèm). Kính mong Nhà trường và Quý Thầy/Cô xem xét cho em được nhận điểm I các học phần trên.',
      dia_danh: 'Đồng Tháp',
      ngay_lam_don: todayISO(),
      nguoi_lam_don: 'Nguyễn Văn Minh',
    };
    renderGenerator(container, { templateId: tpl.id, prefillData: demo });
    showToast('Đã điền dữ liệu mẫu thử cho Đơn xin nhận điểm I!', 'info');
  });

  // Form submit
  const form = container.querySelector('#docGenForm');
  let matchedStudent = null;

  const runMssvLookup = async (rawCode, notifyIfMissing = false) => {
    const code = String(rawCode || '').trim();
    const slot = container.querySelector('#genStudentCardSlot');
    if (!code) {
      if (slot) slot.innerHTML = '';
      matchedStudent = null;
      return;
    }
    const stu = await findStudentByMssv(code);
    if (stu) {
      matchedStudent = stu;
      applyStudentToForm(form, stu);
      const topInput = container.querySelector('#genMssvLookupInput');
      if (topInput && topInput.value.trim() !== stu.mssv) topInput.value = stu.mssv;
      if (slot) slot.innerHTML = '';
      showToast(`Đã tự động điền thông tin SV: ${stu.ho_ten}`, 'success', 2500);
    } else if (notifyIfMissing) {
      matchedStudent = null;
      if (slot) {
        slot.innerHTML = `<div class="alert alert-warning" style="margin-top:10px;margin-bottom:0;">Không tìm thấy sinh viên có MSSV <strong>${escapeHtml(code)}</strong> trong dữ liệu. Bạn có thể tự nhập tay bên dưới.</div>`;
      }
    }
  };

  ensureStudentDbLoaded();
  const lookupInput = container.querySelector('#genMssvLookupInput');
  const lookupBtn = container.querySelector('#genMssvLookupBtn');
  lookupBtn?.addEventListener('click', () => runMssvLookup(lookupInput?.value, true));
  lookupInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runMssvLookup(lookupInput.value, true);
    }
  });
  lookupInput?.addEventListener('input', () => {
    if (lookupInput.value.trim().length >= 8) runMssvLookup(lookupInput.value, false);
  });

  // Cũng tự động tra cứu ngay khi gõ trực tiếp vào ô MSSV trong form
  const formMssvInput = form?.querySelector('[name="mssv"], [name="ma_sv"], [name="ma_sinh_vien"]');
  formMssvInput?.addEventListener('input', () => {
    if (formMssvInput.value.trim().length >= 8) runMssvLookup(formMssvInput.value, false);
  });
  formMssvInput?.addEventListener('blur', () => {
    if (formMssvInput.value.trim().length >= 5) runMssvLookup(formMssvInput.value, false);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = container.querySelector('#submitGenBtn');
    const rawData = {};
    const renderData = matchedStudent ? { ...matchedStudent } : {};

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
          if (hasAny) {
            rows.push({ stt: rows.length + 1, ...rowObj });
          }
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
          showToast(`Trường "${f.label}" là bắt buộc.`, 'error');
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

    // Tự động lấy tên người làm đơn theo Họ tên SV nếu để trống
    if ('nguoi_lam_don' in renderData && !renderData.nguoi_lam_don && renderData.ho_ten) {
      renderData.nguoi_lam_don = renderData.ho_ten;
      rawData.nguoi_lam_don = renderData.ho_ten;
    }

    const baseName =
      slugifyFilename(container.querySelector('#outputFileNameInput')?.value.trim()) ||
      slugifyFilename(tpl.name);
    const outputFileName = baseName.endsWith('.docx') ? baseName : `${baseName}.docx`;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Đang tạo file Word...';

      const generatedBlob = await generateDocxBlob(tpl.fileBlob, renderData);
      const now = new Date().toISOString();

      await db.put('templates', { ...tpl, lastUsedAt: now });
      await db.put('history', {
        id: uid('his'),
        docName: outputFileName,
        templateId: tpl.id,
        templateName: tpl.name,
        inputData: rawData,
        status: 'Thành công',
        fileBlob: generatedBlob,
        size: generatedBlob.size,
        createdAt: now,
      });
      await db.logActivity('Tạo văn bản', `${outputFileName} (từ mẫu ${tpl.name})`);

      showToast('Tạo văn bản Word thành công!', 'success');
      navigateTo('preview', {
        templateId: tpl.id,
        templateName: tpl.name,
        formData: rawData,
        generatedBlob,
        outputFileName,
      });
    } catch (err) {
      console.error(err);
      showToast(`Lỗi tạo file DOCX: ${err.message}`, 'error', 5000);
      submitBtn.disabled = false;
      submitBtn.textContent = '👁️ Tạo văn bản & Xem trước';
    }
  });
}

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
