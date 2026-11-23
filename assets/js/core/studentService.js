import { consumeRateLimit } from './rateLimiter.js';

const SALT = 'DTHU_DTTX_2026_AWG_V1';

// Cache theo phiên làm việc (chỉ giữ đúng mảnh shard đã tra cứu, KHÔNG tải toàn bộ DB)
const shardCache = new Map();
const verifiedStudentCache = new Map();

    async function sha256Bytes(text) {
      const data = new TextEncoder().encode(text);
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(buf);
      }
      throw new Error('Trình duyệt không hỗ trợ Web Crypto API (cần chạy trên localhost hoặc HTTPS).');
    }

    function bytesToHex(bytes) {
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }

      async function decryptRecord(mssvLower, b64Cipher) {
        const binStr = atob(b64Cipher);
        const cipher = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) cipher[i] = binStr.charCodeAt(i);

            const plain = new Uint8Array(cipher.length);
            let pos = 0;
            let counter = 0;
            while (pos < cipher.length) {
              const keyInput = counter === 0 ? `${mssvLower}|${SALT}|KEY` : `${mssvLower}|${SALT}|KEY|${counter}`;
              const block = await sha256Bytes(keyInput);
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
            // Chế độ phân mảnh mã hóa: không tải toàn bộ DB lên trình duyệt để chống cào dữ liệu
            return { mode: 'encrypted-sharded', shards: 256 };
          }

          /**
           * Tra cứu 1 sinh viên duy nhất theo MSSV (có áp dụng Rate Limiter & giải mã theo MSSV).
           * Không tải danh sách toàn bộ sinh viên.
           */
          export async function findStudentByMssv(mssv) {
          const keyNorm = String(mssv || '').trim().toLowerCase();
          if (!keyNorm) return null;

            // Nếu vừa tra cứu chính MSSV này trong phiên hiện tại, trả từ cache không trừ lượt
            if (verifiedStudentCache.has(keyNorm)) {
              return verifiedStudentCache.get(keyNorm);
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

                const digestHex = bytesToHex(await sha256Bytes(`${SALT}:${keyNorm}`));
                const shardId = digestHex.slice(0, 2);
                const entryKey = digestHex.slice(2, 18);

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
                    const student = await decryptRecord(keyNorm, encrypted);
                    verifiedStudentCache.set(keyNorm, student);
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
