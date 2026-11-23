import { escapeHtml } from './helpers.js';

export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, duration);
}

export function openModal({ title, bodyHtml, buttons = [], onMount }) {
  const overlay = document.getElementById('modalOverlay');
  const titleEl = document.getElementById('modalTitle');
  const bodyEl = document.getElementById('modalBody');
  const footerEl = document.getElementById('modalFooter');
  const closeBtn = document.getElementById('modalCloseBtn');

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  footerEl.innerHTML = '';

  const close = () => {
    overlay.classList.add('hidden');
  };

  closeBtn.onclick = close;
  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };

  buttons.forEach((btn) => {
    const b = document.createElement('button');
    b.className = `btn ${btn.className || ''}`;
    b.textContent = btn.label;
    b.onclick = async () => {
      if (btn.onClick) {
        const res = await btn.onClick(close, bodyEl);
        if (res !== false && btn.closeOnClick !== false) close();
      } else {
        close();
      }
    };
    footerEl.appendChild(b);
  });

  overlay.classList.remove('hidden');
  if (onMount) onMount(bodyEl, close);
  return { close };
}

export function confirmDialog(message, title = 'Xác nhận thao tác') {
  return new Promise((resolve) => {
    openModal({
      title,
      bodyHtml: `<p>${escapeHtml(message)}</p>`,
      buttons: [
        {
          label: 'Hủy',
          className: '',
          onClick: () => resolve(false),
        },
        {
          label: 'Xác nhận',
          className: 'btn-danger',
          onClick: () => resolve(true),
        },
      ],
    });
  });
}
