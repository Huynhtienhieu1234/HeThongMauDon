import { db } from './database.js';
import { escapeHtml } from '../utils/helpers.js';

const STUDENT_DB_SCHEMA_VERSION = 2;

let studentMap = null;
let studentList = [];
let dbMeta = { count: 0, source: 'DS SV.xls', updatedAt: null };
let loadPromise = null;

function hydratePayload(payload) {
  const map = new Map();
  const list = [];
  const L = payload.lookups || {};
  const records = payload.records || [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const mssv = String(r[1] || '').trim();
    if (!mssv) continue;
    const ho_dem = String(r[2] || '').trim();
    const ten = String(r[3] || '').trim();
    const ho_ten = `${ho_dem} ${ten}`.trim();
    const student = {
      stt: String(r[0] || ''),
      mssv,
      ho_dem,
      ten,
      ho_ten,
      gioi_tinh: L.gt ? (L.gt[r[4]] || '') : String(r[4] || ''),
      ngay_sinh: String(r[5] || ''),
      ma_lop: L.ml ? (L.ml[r[6]] || '') : String(r[6] || ''),
      lop_hoc: L.lh ? (L.lh[r[7]] || '') : String(r[7] || ''),
      dan_toc: L.dt ? (L.dt[r[8]] || '') : String(r[8] || ''),
      khoa_hoc: L.kh ? (L.kh[r[9]] || '') : String(r[9] || ''),
      bac_dao_tao: L.bdt ? (L.bdt[r[10]] || '') : String(r[10] || ''),
      loai_dao_tao: L.ldt ? (L.ldt[r[11]] || '') : String(r[11] || ''),
      nganh: L.ng ? (L.ng[r[12]] || '') : String(r[12] || ''),
      chuyen_nganh: L.cn ? (L.cn[r[13]] || '') : String(r[13] || ''),
      trang_thai: L.tt ? (L.tt[r[14]] || '') : String(r[14] || ''),
      ngay_nhap_hoc: L.nnh ? (L.nnh[r[15]] || '') : String(r[15] || ''),
      khoa: L.k ? (L.k[r[16]] || '') : String(r[16] || ''),
    };
    map.set(mssv.toLowerCase(), student);
    list.push(student);
  }

  studentMap = map;
  studentList = list;
  dbMeta = {
    count: list.length,
    source: payload.source || 'DS SV.xls',
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

export async function ensureStudentDbLoaded(forceFetch = false) {
  if (studentMap && !forceFetch) return dbMeta;
  if (loadPromise && !forceFetch) return loadPromise;

  loadPromise = (async () => {
    try {
      if (!forceFetch) {
        const cached = await db.get('studentDb', 'main');
        if (
          cached &&
          cached.payload &&
          (cached.payload.version || 1) >= STUDENT_DB_SCHEMA_VERSION &&
          Array.isArray(cached.payload.records) &&
          cached.payload.records.length > 0
        ) {
          hydratePayload({ ...cached.payload, updatedAt: cached.updatedAt });
          return dbMeta;
        }
      }

      const resp = await fetch('./DB/students.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const payload = await resp.json();
      const now = new Date().toISOString();
      hydratePayload({ ...payload, updatedAt: now });

      // Cache vào IndexedDB nền để lần sau mở tức thì
      db.put('studentDb', { id: 'main', updatedAt: now, payload }).catch(() => {});
      return dbMeta;
    } catch (err) {
      console.warn('Không thể tải dữ liệu sinh viên:', err);
      if (!studentMap) {
        studentMap = new Map();
        studentList = [];
      }
      return dbMeta;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function getStudentDbStats() {
  return { ...dbMeta };
}

export async function findStudentByMssv(mssv) {
  await ensureStudentDbLoaded();
  const key = String(mssv || '').trim().toLowerCase();
  if (!key || !studentMap) return null;
  return studentMap.get(key) || null;
}

export async function searchStudents(query = '', limit = 50) {
  await ensureStudentDbLoaded();
  const q = String(query || '').trim().toLowerCase();
  if (!q) return studentList.slice(0, limit);

  const results = [];
  for (let i = 0; i < studentList.length; i++) {
    const s = studentList[i];
    if (
      s.mssv.toLowerCase().includes(q) ||
      s.ho_ten.toLowerCase().includes(q) ||
      s.lop_hoc.toLowerCase().includes(q) ||
      s.nganh.toLowerCase().includes(q)
    ) {
      results.push(s);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export async function importStudentsFromExcelFile(file) {
  if (typeof window.XLSX === 'undefined') {
    throw new Error('Thư viện đọc Excel (SheetJS) chưa được tải. Vui lòng kiểm tra kết nối mạng.');
  }
  const buffer = await file.arrayBuffer();
  const wb = window.XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) {
    throw new Error('File Excel không có dữ liệu sinh viên.');
  }

  const records = [];
  const seen = new Set();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const mssv = String(r[1] ?? '').trim();
    if (!mssv || seen.has(mssv)) continue;
    seen.add(mssv);
    records.push([
      String(r[0] ?? '').trim(),
      mssv,
      String(r[2] ?? '').trim(),
      String(r[3] ?? '').trim(),
      String(r[4] ?? '').trim(),
      String(r[5] ?? '').trim(),
      String(r[6] ?? '').trim(),
      String(r[7] ?? '').trim(),
      String(r[8] ?? '').trim(),
      String(r[9] ?? '').trim(),
      String(r[10] ?? '').trim(),
      String(r[11] ?? '').trim(),
      String(r[12] ?? '').trim(),
      String(r[13] ?? '').trim(),
      String(r[14] ?? '').trim(),
      String(r[15] ?? '').trim(),
      String(r[16] ?? '').trim(),
    ]);
  }

  const now = new Date().toISOString();
  const payload = {
    version: STUDENT_DB_SCHEMA_VERSION,
    source: file.name,
    count: records.length,
    lookups: null,
    records,
    updatedAt: now,
  };
  hydratePayload(payload);
  await db.put('studentDb', { id: 'main', updatedAt: now, payload });
  await db.logActivity('Cập nhật DB sinh viên', `${file.name} (${records.length.toLocaleString('vi-VN')} SV)`);
  return dbMeta;
}

function toIsoDateIfNeeded(ddmmyyyy) {
  const m = String(ddmmyyyy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return ddmmyyyy;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/**
 * Tự động điền dữ liệu sinh viên vào các ô input khớp tên biến trên form
 */
export function applyStudentToForm(formEl, student) {
  if (!formEl || !student) return 0;

  const valueMap = {
    mssv: student.mssv,
    ma_sv: student.mssv,
    ma_sinh_vien: student.mssv,
    ho_ten: student.ho_ten,
    ho_va_ten: student.ho_ten,
    nguoi_lam_don: student.ho_ten,
    ho_dem: student.ho_dem,
    ten: student.ten,
    gioi_tinh: student.gioi_tinh,
    ngay_sinh: student.ngay_sinh,
    ma_lop: student.ma_lop,
    lop: student.lop_hoc || student.ma_lop,
    lop_hoc: student.lop_hoc || student.ma_lop,
    dan_toc: student.dan_toc,
    khoa_hoc: student.khoa_hoc,
    bac_dao_tao: student.bac_dao_tao,
    he_dao_tao: student.bac_dao_tao,
    loai_dao_tao: student.loai_dao_tao,
    loai_hinh_dao_tao: student.loai_dao_tao,
    nganh: student.nganh,
    nganh_hoc: student.nganh,
    nganh_dao_tao: student.nganh,
    khoa: student.khoa || student.nganh,
    chuyen_nganh: student.chuyen_nganh,
    trang_thai: student.trang_thai,
    ngay_nhap_hoc: student.ngay_nhap_hoc,
  };

  let filledCount = 0;
  Object.entries(valueMap).forEach(([name, rawVal]) => {
    if (!rawVal) return;
    const input = formEl.querySelector(`[name="${name}"]`);
    if (!input) return;
    const val = input.type === 'date' ? toIsoDateIfNeeded(rawVal) : rawVal;
    input.value = val;
    filledCount++;
  });

  return filledCount;
}

export function renderStudentInfoCardHtml(student) {
  if (!student) return '';
  return `
    <div class="student-lookup-card">
      <div class="student-lookup-card-header">
        <div>
          <strong>✅ Đã tìm thấy sinh viên: ${escapeHtml(student.ho_ten)}</strong>
          <span class="badge badge-success" style="margin-left:8px;">${escapeHtml(student.trang_thai || 'Đang học')}</span>
        </div>
        <span class="badge badge-primary">MSSV: ${escapeHtml(student.mssv)}</span>
      </div>
      <div class="student-lookup-grid">
        <div><span>Họ đệm:</span> <strong>${escapeHtml(student.ho_dem)}</strong></div>
        <div><span>Tên:</span> <strong>${escapeHtml(student.ten)}</strong></div>
        <div><span>Giới tính:</span> <strong>${escapeHtml(student.gioi_tinh)}</strong></div>
        <div><span>Ngày sinh:</span> <strong>${escapeHtml(student.ngay_sinh)}</strong></div>
        <div><span>Mã lớp:</span> <strong>${escapeHtml(student.ma_lop)}</strong></div>
        <div><span>Lớp học:</span> <strong>${escapeHtml(student.lop_hoc)}</strong></div>
        <div><span>Dân tộc:</span> <strong>${escapeHtml(student.dan_toc)}</strong></div>
        <div><span>Khóa học:</span> <strong>${escapeHtml(student.khoa_hoc)}</strong></div>
        <div><span>Bậc đào tạo:</span> <strong>${escapeHtml(student.bac_dao_tao)}</strong></div>
        <div><span>Loại đào tạo:</span> <strong>${escapeHtml(student.loai_dao_tao)}</strong></div>
        <div><span>Ngành:</span> <strong>${escapeHtml(student.nganh)}</strong></div>
        <div><span>Chuyên ngành:</span> <strong>${escapeHtml(student.chuyen_nganh)}</strong></div>
        <div><span>Ngày nhập học:</span> <strong>${escapeHtml(student.ngay_nhap_hoc)}</strong></div>
      </div>
    </div>
  `;
}
