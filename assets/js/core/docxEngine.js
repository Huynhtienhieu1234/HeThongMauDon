export function ensureLibrariesLoaded() {
  if (typeof window.PizZip === 'undefined' || typeof window.docxtemplater === 'undefined') {
    throw new Error('Không thể tải thư viện PizZip / Docxtemplater. Vui lòng kiểm tra kết nối mạng.');
  }
}

/**
 * Tự động quét các biến {{ten_bien}} và vòng lặp {{#ten_bang}} trong file DOCX
 */
export async function extractVariablesFromDocx(blobOrBuffer) {
  ensureLibrariesLoaded();
  const buffer = blobOrBuffer instanceof Blob ? await blobOrBuffer.arrayBuffer() : blobOrBuffer;
  const zip = new window.PizZip(buffer);
  const xmlFiles = Object.keys(zip.files).filter(
    (name) => name === 'word/document.xml' || /^word\/(header|footer)\d*\.xml$/.test(name)
  );

  const simpleVars = new Set();
  const loopVars = new Set();

  for (const name of xmlFiles) {
    const xml = zip.files[name].asText();
    // Gỡ thẻ XML để ghép các run bị Word tách đôi
    const plain = xml.replace(/<[^>]+>/g, '');
    const regex = /\{\{([#/^]?)([a-zA-Z0-9_.-]+)\}\}/g;
    let m;
    while ((m = regex.exec(plain)) !== null) {
      const prefix = m[1];
      const key = m[2];
      if (prefix === '#') {
        loopVars.add(key);
      } else if (prefix === '') {
        simpleVars.add(key);
      }
    }
  }

  return {
    variables: Array.from(simpleVars),
    loops: Array.from(loopVars),
  };
}

/**
 * Thay thế biến trong file DOCX gốc bằng Docxtemplater, giữ nguyên 100% định dạng Word
 */
export async function generateDocxBlob(templateBlob, data) {
  ensureLibrariesLoaded();
  const buffer = templateBlob instanceof Blob ? await templateBlob.arrayBuffer() : templateBlob;
  const zip = new window.PizZip(buffer);

  const doc = new window.docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  doc.render(data);

  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Hiển thị bản xem trước HTML sát bố cục Word gốc bằng docx-preview
 */
export async function renderDocxPreview(docxBlob, containerEl) {
  containerEl.innerHTML = '';
  if (typeof window.docx !== 'undefined' && typeof window.docx.renderAsync === 'function') {
    await window.docx.renderAsync(docxBlob, containerEl, null, {
      className: 'docx',
      inWrapper: true,
      ignoreWidth: false,
      ignoreHeight: false,
      ignoreFonts: false,
      breakPages: true,
      experimental: true,
      trimXmlDeclaration: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      useBase64URL: true,
    });
    return true;
  }
  containerEl.innerHTML =
    '<div class="alert alert-warning">Thư viện xem trước chưa sẵn sàng. Bạn vẫn có thể tải xuống file DOCX hoàn chỉnh bên trên.</div>';
  return false;
}
