import { consumeRateLimit } from './rateLimiter.js';

const SALT = 'DTHU_DTTX_2026_AWG_V2';
const PBKDF2_ITERS = 20000;

// Cache theo phiên làm việc (chỉ giữ đúng mảnh shard đã tra cứu, xóa khi đóng tab)
const shardCache = new Map();
const verifiedStudentCache = new Map();

function ensureWebCrypto() {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Trình duyệt không hỗ trợ Web Crypto API (cần chạy trên localhost hoặc HTTPS).');
  }
}

async function sha256Raw(bytes) {
  ensureWebCrypto();
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(buf);
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function normalizeDob(raw) {
  const s = String(raw || '').trim();
  const m1 = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m1) return `${m1[1].padStart(2, '0')}/${m1[2].padStart(2, '0')}/${m1[3]}`;
  const m2 = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m2) return `${m2[3].padStart(2, '0')}/${m2[2].padStart(2, '0')}/${m2[1]}`;
  return s;
}

async function deriveMasterKey(mssvLower, dobNorm) {
  ensureWebCrypto();
  const enc = new TextEncoder();
  const secret = enc.encode(`${mssvLower}|${dobNorm}`);
  const saltBytes = enc.encode(`${SALT}|PBKDF2|${mssvLower}`);
  const baseKey = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: PBKDF2_ITERS },
    baseKey,
    256
  );
  return new Uint8Array(bits);
}

async function decryptWithKey(masterKey, b64Cipher) {
  const binStr = atob(b64Cipher);
  const cipher = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) cipher[i] = binStr.charCodeAt(i);

  const plain = new Uint8Array(cipher.length);
  let pos = 0;
  let counter = 0;
  const ctrBuf = new Uint8Array(4);

  while (pos < cipher.length) {
    ctrBuf[0] = (counter >>> 24) & 0xff;
    ctrBuf[1] = (counter >>> 16) & 0xff;
    ctrBuf[2] = (counter >>> 8) & 0xff;
    ctrBuf[3] = counter & 0xff;
    const block = await sha256Raw(concatBytes(masterKey, ctrBuf));
    const take = Math.min(32, cipher.length - pos);
    for (let i = 0; i < take; i++) {
      plain[pos + i] = cipher[pos + i] ^ block[i];
    }
    pos += take;
    counter += 1;
  }

  const jsonStr = new TextDecoder('utf-8').decode(plain);
  return JSON.parse(jsonStr);
}

export async function ensureStudentDbLoaded() {
  return { mode: '2fa-pbkdf2-sharded', shards: 256 };
}

/**
 * Xác thực 2 yếu tố (MSSV + Ngày sinh) & giải mã PBKDF2-SHA256 kèm Rate Limiter
 */
export async function findStudentByMssvAndDob(mssv, dobRaw) {
  const keyNorm = String(mssv || '').trim().toLowerCase();
  const dobNorm = normalizeDob(dobRaw);
  if (!keyNorm || !dobNorm) return null;

  const cacheKey = `${keyNorm}|${dobNorm}`;
  if (verifiedStudentCache.has(cacheKey)) {
    return verifiedStudentCache.get(cacheKey);
  }

  // Kiểm tra giới hạn tần suất (Request Rate Limit)
  const rl = consumeRateLimit('lookup');
  if (!rl.allowed) {
    const err = new Error(rl.message);
    err.rateLimited = true;
    err.locked = rl.locked;
    err.retryAfterMs = rl.retryAfterMs;
    throw err;
  }

  const masterKey = await deriveMasterKey(keyNorm, dobNorm);
  const lookupPrefix = new TextEncoder().encode('LOOKUP:');
  const lookupHex = bytesToHex(await sha256Raw(concatBytes(lookupPrefix, masterKey)));
  const shardId = lookupHex.slice(0, 2);
  const entryKey = lookupHex.slice(2, 18);

  let shardData = shardCache.get(shardId);
  if (!shardData) {
    const resp = await fetch(`./DB/shards/${shardId}.json`);
    if (!resp.ok) throw new Error(`Không thể tải dữ liệu tra cứu (HTTP ${resp.status}).`);
    shardData = await resp.json();
    shardCache.set(shardId, shardData);
  }

  const encrypted = shardData[entryKey];
  if (!encrypted) return null;

  try {
    const student = await decryptWithKey(masterKey, encrypted);
    verifiedStudentCache.set(cacheKey, student);
    return student;
  } catch {
    return null;
  }
}

function toIsoDateIfNeeded(ddmmyyyy) {
  const m = String(ddmmyyyy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return ddmmyyyy;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

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
