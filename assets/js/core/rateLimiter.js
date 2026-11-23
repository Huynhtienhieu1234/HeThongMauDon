const STORAGE_KEY = 'awg_rl_state_v1';

const RULES = {
  lookup: {
    label: 'tra cứu MSSV',
    minIntervalMs: 2000,        // Tối thiểu 2 giây giữa 2 lần tra cứu
    botThresholdMs: 350,        // Gọi nhanh dưới 350ms bị coi là hành vi tự động (bot)
    maxPerMinute: 5,            // Tối đa 5 lần / phút
    maxPerHour: 15,             // Tối đa 15 lần / giờ
    lockoutMs: 5 * 60 * 1000,   // Vượt giới hạn -> tạm khóa 5 phút
  },
  generate: {
    label: 'tạo văn bản',
    minIntervalMs: 3000,        // Tối thiểu 3 giây giữa 2 lần xuất Word
    botThresholdMs: 300,
    maxPerMinute: 4,            // Tối đa 4 lần / phút
    maxPerHour: 12,             // Tối đa 12 lần / giờ
    lockoutMs: 5 * 60 * 1000,
  },
};

const memoryBuckets = {};

function loadState() {
  const merged = { ...memoryBuckets };
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      for (const [action, b] of Object.entries(parsed)) {
        const cur = merged[action] || { timestamps: [], lockedUntil: 0, violations: 0 };
        merged[action] = {
          timestamps: Array.from(new Set([...(cur.timestamps || []), ...(b.timestamps || [])])).sort((a, z) => a - z),
          lockedUntil: Math.max(cur.lockedUntil || 0, b.lockedUntil || 0),
          violations: Math.max(cur.violations || 0, b.violations || 0),
        };
      }
    } catch {
      // ignore storage errors
    }
  }
  return merged;
}

function saveState(state) {
  Object.assign(memoryBuckets, state);
  const serialized = JSON.stringify(state);
  try { localStorage.setItem(STORAGE_KEY, serialized); } catch {}
  try { sessionStorage.setItem(STORAGE_KEY, serialized); } catch {}
}

function pruneBucket(bucket, now) {
  const oneHourAgo = now - 60 * 60 * 1000;
  return {
    timestamps: (bucket?.timestamps || []).filter((t) => t > oneHourAgo),
    lockedUntil: bucket?.lockedUntil || 0,
    violations: bucket?.violations || 0,
  };
}

export function formatWaitTime(ms) {
  const totalSec = Math.max(1, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m} phút ${String(s).padStart(2, '0')} giây`;
  return `${s} giây`;
}

export function getRateLimitStatus(action = 'lookup') {
  const rule = RULES[action] || RULES.lookup;
  const now = Date.now();
  const state = loadState();
  const bucket = pruneBucket(state[action], now);

  const oneMinAgo = now - 60 * 1000;
  const usedMinute = bucket.timestamps.filter((t) => t > oneMinAgo).length;
  const usedHour = bucket.timestamps.length;
  const lockedMs = Math.max(0, bucket.lockedUntil - now);

  return {
    action,
    locked: lockedMs > 0,
    retryAfterMs: lockedMs,
    usedMinute,
    maxPerMinute: rule.maxPerMinute,
    remainingMinute: Math.max(0, rule.maxPerMinute - usedMinute),
    usedHour,
    maxPerHour: rule.maxPerHour,
    remainingHour: Math.max(0, rule.maxPerHour - usedHour),
  };
}

/**
 * Kiểm tra & ghi nhận 1 request.
 * Trả về { allowed: true, status } hoặc { allowed: false, retryAfterMs, message, locked }
 */
export function consumeRateLimit(action = 'lookup') {
  const rule = RULES[action] || RULES.lookup;
  const now = Date.now();
  const state = loadState();
  const bucket = pruneBucket(state[action], now);

  // 1. Đang bị tạm khóa
  if (bucket.lockedUntil > now) {
    const wait = bucket.lockedUntil - now;
    return {
      allowed: false,
      locked: true,
      retryAfterMs: wait,
      message: `Hệ thống tạm giới hạn ${rule.label} để chống truy vấn tự động. Vui lòng thử lại sau ${formatWaitTime(wait)}.`,
    };
  }

  const lastTs = bucket.timestamps[bucket.timestamps.length - 1] || 0;
  const delta = now - lastTs;

  // 2. Phát hiện gọi liên tục quá nhanh (hành vi bot/script)
  if (lastTs && delta < rule.botThresholdMs) {
    bucket.violations += 1;
    if (bucket.violations >= 2) {
      bucket.lockedUntil = now + rule.lockoutMs;
      state[action] = bucket;
      saveState(state);
      return {
        allowed: false,
        locked: true,
        retryAfterMs: rule.lockoutMs,
        message: `Phát hiện thao tác quá nhanh bất thường. Tạm khóa ${rule.label} trong ${formatWaitTime(rule.lockoutMs)}.`,
      };
    }
  }

  // 3. Kiểm tra cooldown tối thiểu giữa 2 lần bấm
  if (lastTs && delta < rule.minIntervalMs) {
    const wait = rule.minIntervalMs - delta;
    return {
      allowed: false,
      locked: false,
      retryAfterMs: wait,
      message: `Vui lòng đợi ${formatWaitTime(wait)} trước khi ${rule.label} tiếp.`,
    };
  }

  const oneMinAgo = now - 60 * 1000;
  const usedMinute = bucket.timestamps.filter((t) => t > oneMinAgo).length;
  const usedHour = bucket.timestamps.length;

  // 4. Vượt giới hạn mỗi phút hoặc mỗi giờ -> khóa tạm thời
  if (usedMinute >= rule.maxPerMinute || usedHour >= rule.maxPerHour) {
    bucket.lockedUntil = now + rule.lockoutMs;
    state[action] = bucket;
    saveState(state);
    return {
      allowed: false,
      locked: true,
      retryAfterMs: rule.lockoutMs,
      message: `Bạn đã vượt giới hạn ${rule.label} (${rule.maxPerMinute} lần/phút, ${rule.maxPerHour} lần/giờ). Tạm khóa ${formatWaitTime(rule.lockoutMs)}.`,
    };
  }

  // Cho phép & ghi nhận timestamp
  bucket.timestamps.push(now);
  bucket.violations = 0;
  state[action] = bucket;
  saveState(state);

  return {
    allowed: true,
    status: getRateLimitStatus(action),
  };
}
