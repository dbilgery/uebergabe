(() => {
  'use strict';

  const form = document.getElementById('handoverForm');
  const moveOutFields = document.getElementById('moveOutFields');
  const defectDetailsWrap = document.getElementById('defectDetailsWrap');
  const defectDetails = document.getElementById('defectDetails');
  const defectCount = document.getElementById('defectCount');
  const sharePdfButton = document.getElementById('sharePdfButton');
  const downloadPdfButton = document.getElementById('downloadPdfButton');
  const resetButton = document.getElementById('resetButton');
  const resetDialog = document.getElementById('resetDialog');
  const confirmReset = document.getElementById('confirmReset');
  const statusMessage = document.getElementById('statusMessage');

  const todayISO = () => {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  ['moveDate', 'inspectionDate', 'signDate'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el.value) el.value = todayISO();
  });

  const signatureState = new Map();
  let signingLockCount = 0;

  const blockDocumentScroll = (e) => {
    if (signingLockCount > 0) e.preventDefault();
  };

  function lockPageWhileSigning() {
    signingLockCount += 1;
    if (signingLockCount !== 1) return;
    document.addEventListener('touchmove', blockDocumentScroll, { passive: false, capture: true });
    document.addEventListener('gesturestart', blockDocumentScroll, { passive: false, capture: true });
    document.addEventListener('gesturechange', blockDocumentScroll, { passive: false, capture: true });
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overscrollBehaviorY = 'none';
  }

  function unlockPageAfterSigning() {
    signingLockCount = Math.max(0, signingLockCount - 1);
    if (signingLockCount !== 0) return;
    document.removeEventListener('touchmove', blockDocumentScroll, true);
    document.removeEventListener('gesturestart', blockDocumentScroll, true);
    document.removeEventListener('gesturechange', blockDocumentScroll, true);
    document.documentElement.style.overscrollBehaviorY = '';
    document.body.style.overscrollBehaviorY = '';
  }

  function setupSignatureCanvas(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    const state = { drawing: false, signed: false, lastX: 0, lastY: 0, pointerId: null };
    signatureState.set(canvas.id, state);

    function resizeCanvas() {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      const backup = state.signed ? canvas.toDataURL('image/png') : null;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (backup) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = backup;
      }
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (!e.isPrimary) return;
      e.preventDefault();
      e.stopPropagation();
      lockPageWhileSigning();
      canvas.setPointerCapture(e.pointerId);
      const p = pos(e);
      state.drawing = true;
      state.pointerId = e.pointerId;
      state.signed = true;
      state.lastX = p.x;
      state.lastY = p.y;
      canvas.classList.remove('invalid');
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!state.drawing || e.pointerId !== state.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const p = pos(e);
      ctx.beginPath();
      ctx.moveTo(state.lastX, state.lastY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      state.lastX = p.x;
      state.lastY = p.y;
    });

    const stop = (e) => {
      if (!state.drawing) return;
      if (e && state.pointerId !== null && e.pointerId !== state.pointerId) return;
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      state.drawing = false;
      if (e && canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      state.pointerId = null;
      unlockPageAfterSigning();
    };

    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('lostpointercapture', () => {
      if (!state.drawing) return;
      state.drawing = false;
      state.pointerId = null;
      unlockPageAfterSigning();
    });

    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach((type) => {
      canvas.addEventListener(type, (e) => e.preventDefault(), { passive: false });
    });

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
  }

  document.querySelectorAll('.signature-canvas').forEach(setupSignatureCanvas);

  function clearSignature(id) {
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext('2d');
    const state = signatureState.get(id);
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    state.signed = false;
    canvas.classList.remove('invalid');
  }

  document.querySelectorAll('[data-clear-signature]').forEach((button) => {
    button.addEventListener('click', () => clearSignature(button.dataset.clearSignature));
  });

  function updateConditionalFields() {
    const type = form.elements.handoverType.value;
    const isMoveOut = type === 'Auszug';
    moveOutFields.classList.toggle('hidden', !isMoveOut);
    moveOutFields.setAttribute('aria-hidden', String(!isMoveOut));
  }

  function updateDefectFields() {
    const defects = form.elements.defects.value;
    const hasDefects = defects === 'Folgende';
    defectDetailsWrap.classList.toggle('hidden', !hasDefects);
    defectDetailsWrap.setAttribute('aria-hidden', String(!hasDefects));
  }

  form.querySelectorAll('input[name="handoverType"]').forEach((el) => el.addEventListener('change', updateConditionalFields));
  form.querySelectorAll('input[name="defects"]').forEach((el) => el.addEventListener('change', updateDefectFields));
  defectDetails.addEventListener('input', () => { defectCount.textContent = String(defectDetails.value.length); });
  updateConditionalFields();
  updateDefectFields();

  function showStatus(message, type = 'success') {
    statusMessage.textContent = message;
    statusMessage.classList.remove('hidden', 'error');
    if (type === 'error') statusMessage.classList.add('error');
  }

  function clearStatus() {
    statusMessage.classList.add('hidden');
    statusMessage.classList.remove('error');
    statusMessage.textContent = '';
  }

  function formatDate(value) {
    if (!value) return '';
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }

  function sanitizeFilename(value) {
    return value
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || 'Uebergabe';
  }

  function validateForm() {
    clearStatus();
    let firstInvalid = null;
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));

    ['objectRoom', 'fullName', 'moveDate', 'inspectionDate', 'signPlace', 'signDate'].forEach((id) => {
      const el = document.getElementById(id);
      if (!String(el.value || '').trim()) {
        el.classList.add('invalid');
        if (!firstInvalid) firstInvalid = el;
      }
    });

    if (form.elements.defects.value === 'Folgende' && !defectDetails.value.trim()) {
      defectDetails.classList.add('invalid');
      if (!firstInvalid) firstInvalid = defectDetails;
    }

    ['tenantSignature', 'landlordSignature'].forEach((id) => {
      const canvas = document.getElementById(id);
      if (!signatureState.get(id).signed) {
        canvas.classList.add('invalid');
        if (!firstInvalid) firstInvalid = canvas;
      }
    });

    if (firstInvalid) {
      showStatus('Bitte fülle die rot markierten Pflichtfelder aus und ergänze beide Unterschriften.', 'error');
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  function formData() {
    return {
      type: form.elements.handoverType.value,
      objectRoom: document.getElementById('objectRoom').value.trim(),
      fullName: document.getElementById('fullName').value.trim(),
      moveDate: formatDate(document.getElementById('moveDate').value),
      iban: document.getElementById('iban').value.trim(),
      newAddress: document.getElementById('newAddress').value.trim(),
      inspectionDate: formatDate(document.getElementById('inspectionDate').value),
      defects: form.elements.defects.value,
      defectDetails: defectDetails.value.trim(),
      checkWaste: document.getElementById('checkWaste').checked,
      checkFloor: document.getElementById('checkFloor').checked,
      checkFurniture: document.getElementById('checkFurniture').checked,
      houseKeys: document.getElementById('houseKeys').value || '0',
      roomKeys: document.getElementById('roomKeys').value || '0',
      signPlace: document.getElementById('signPlace').value.trim(),
      signDate: formatDate(document.getElementById('signDate').value),
      tenantSignature: document.getElementById('tenantSignature').toDataURL('image/png'),
      landlordSignature: document.getElementById('landlordSignature').toDataURL('image/png')
    };
  }

  function buildPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.');
    }

    const { jsPDF } = window.jspdf;
    const d = formData();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    const W = 210;
    const margin = 18;
    const right = W - margin;
    const contentW = right - margin;
    const colGap = 12;
    const colW = (contentW - colGap) / 2;
    const col2 = margin + colW + colGap;

    const ink = [28, 28, 30];
    const muted = [92, 92, 98];
    const line = [188, 188, 194];
    const faint = [225, 225, 229];
    const paper = [255, 255, 255];

    let y = 20;

    const text = (value, x, yy, size = 9, style = 'normal', color = ink, options = {}) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      if (Array.isArray(value)) doc.text(value, x, yy, options);
      else doc.text(String(value ?? ''), x, yy, options);
    };

    const hRule = (yy, color = line, width = 0.25) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      doc.line(margin, yy, right, yy);
    };

    const section = (title) => {
      y += 2;
      text(title, margin, y, 10.5, 'bold');
      y += 3.3;
      hRule(y, line, 0.28);
      y += 6.5;
    };

    const field = (label, value, x, yy, width, options = {}) => {
      const { valueSize = 9.6, boldValue = false } = options;
      text(label, x, yy, 7.1, 'normal', muted);
      const lines = doc.splitTextToSize(value || '—', width);
      text(lines, x, yy + 4.8, valueSize, boldValue ? 'bold' : 'normal', ink);
      return lines.length;
    };

    const checkbox = (checked, label, yy) => {
      const box = 3.2;
      doc.setDrawColor(...ink);
      doc.setLineWidth(0.3);
      doc.rect(margin, yy - 2.6, box, box);
      if (checked) {
        doc.setLineWidth(0.45);
        doc.line(margin + 0.65, yy - 1.0, margin + 1.45, yy - 0.2);
        doc.line(margin + 1.45, yy - 0.2, margin + 2.7, yy - 2.1);
      }
      text(label, margin + 5.5, yy, 8.6, 'normal');
    };

    const ensureSpace = (needed) => {
      if (y + needed <= 273) return;
      doc.addPage();
      y = 20;
    };

    const drawFooter = () => {
      const total = doc.getNumberOfPages();
      for (let page = 1; page <= total; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(...faint);
        doc.setLineWidth(0.2);
        doc.line(margin, 282, right, 282);
        text(`Übergabeprotokoll · ${d.objectRoom}`, margin, 287.4, 6.8, 'normal', muted);
        text(`Seite ${page} von ${total}`, right, 287.4, 6.8, 'normal', muted, { align: 'right' });
      }
    };

    text('Übergabeprotokoll', margin, y, 17, 'bold');
    text('Wohnungs- / Zimmerübergabe', right, y - 0.4, 8, 'normal', muted, { align: 'right' });
    y += 7;
    hRule(y, ink, 0.5);
    y += 9;

    section('1. Übergabe');

    field('Objekt / Zimmer', d.objectRoom, margin, y, contentW, { valueSize: 10.2, boldValue: true });
    y += 12;
    field('Vollständiger Name', d.fullName, margin, y, contentW);
    y += 12;
    field('Art der Übergabe', d.type === 'Einzug' ? 'Vor dem Einzug' : 'Vor dem Auszug', margin, y, colW);
    field('Ein-/Auszugsdatum', d.moveDate, col2, y, colW);
    y += 12;

    if (d.type === 'Auszug') {
      field('IBAN', d.iban || '—', margin, y, colW);
      field('Neue Anschrift', d.newAddress || '—', col2, y, colW);
      y += 14;
    }

    section('2. Begehung und Zustand');

    if (d.defects === 'Keine') {
      text(`Bei der Begehung am ${d.inspectionDate} wurden keine Mängel festgestellt.`, margin, y, 9);
      y += 9;
    } else {
      text(`Bei der Begehung am ${d.inspectionDate} wurden folgende Mängel festgestellt:`, margin, y, 9);
      y += 6;
      const defectLines = doc.splitTextToSize(d.defectDetails, contentW);
      ensureSpace(defectLines.length * 4.2 + 35);
      text(defectLines, margin, y, 8.8, 'normal');
      y += defectLines.length * 4.2 + 6;
    }

    text('Zustand des Zimmers', margin, y, 7.1, 'normal', muted);
    y += 6;
    checkbox(d.checkWaste, 'Altglas, Müll und Pfand entsorgt', y); y += 6;
    checkbox(d.checkFloor, 'Zimmerboden gesaugt und feucht gewischt', y); y += 6;
    checkbox(d.checkFurniture, 'Oberflächen von allen Möbeln feucht gewischt', y); y += 8;

    ensureSpace(42);
    section('3. Schlüssel');

    text('Abschließend wurden folgende Schlüssel übergeben:', margin, y, 9);
    y += 9;
    field('Haus- und Wohnungsschlüssel', `${d.houseKeys} Stück`, margin, y, colW);
    field('Zimmerschlüssel', `${d.roomKeys} Stück`, col2, y, colW);
    y += 14;

    ensureSpace(65);
    section('4. Unterschriften');

    field('Ort', d.signPlace, margin, y, colW);
    field('Datum', d.signDate, col2, y, colW);
    y += 14;

    const sigTop = y;
    const sigW = colW;
    const sigH = 20;
    const sigLineY = sigTop + sigH + 2;

    doc.setFillColor(...paper);
    doc.rect(margin, sigTop, sigW, sigH, 'F');
    doc.rect(col2, sigTop, sigW, sigH, 'F');
    doc.addImage(d.tenantSignature, 'PNG', margin + 1.5, sigTop + 0.8, sigW - 3, sigH - 2.2, undefined, 'FAST');
    doc.addImage(d.landlordSignature, 'PNG', col2 + 1.5, sigTop + 0.8, sigW - 3, sigH - 2.2, undefined, 'FAST');

    doc.setDrawColor(...ink);
    doc.setLineWidth(0.3);
    doc.line(margin, sigLineY, margin + sigW, sigLineY);
    doc.line(col2, sigLineY, col2 + sigW, sigLineY);

    text(`Unterschrift Mieter · ${d.fullName}`, margin, sigLineY + 4.8, 7, 'normal', muted);
    text('Unterschrift Vermieter', col2, sigLineY + 4.8, 7, 'normal', muted);

    drawFooter();

    const filename = `Uebergabeprotokoll_${sanitizeFilename(d.fullName)}_${document.getElementById('moveDate').value}.pdf`;
    return { doc, filename };
  }

  async function sharePdf() {
    if (!validateForm()) return;
    sharePdfButton.disabled = true;
    sharePdfButton.querySelector('span').textContent = 'PDF wird erstellt …';
    try {
      const { doc, filename } = buildPdf();
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: 'Übergabeprotokoll', text: 'Übergabeprotokoll als PDF', files: [file] });
        showStatus('PDF wurde an das Teilen-Menü übergeben. Wähle dort „Mail“. Das Formular bleibt erhalten, bis du „Neue Übergabe“ auswählst.');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        showStatus('Direktes Teilen wird von diesem Browser nicht unterstützt. Die PDF wurde stattdessen heruntergeladen.');
      }
    } catch (err) {
      if (err && err.name === 'AbortError') {
        showStatus('Teilen wurde abgebrochen. Deine Eingaben bleiben erhalten.', 'error');
      } else {
        console.error(err);
        showStatus(err?.message || 'Die PDF konnte nicht erstellt werden.', 'error');
      }
    } finally {
      sharePdfButton.disabled = false;
      sharePdfButton.querySelector('span').textContent = 'PDF erstellen & teilen';
    }
  }

  function downloadPdf() {
    if (!validateForm()) return;
    try {
      const { doc, filename } = buildPdf();
      doc.save(filename);
      showStatus('PDF wurde heruntergeladen.');
    } catch (err) {
      console.error(err);
      showStatus(err?.message || 'Die PDF konnte nicht erstellt werden.', 'error');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sharePdf();
  });

  downloadPdfButton.addEventListener('click', downloadPdf);

  resetButton.addEventListener('click', () => {
    if (typeof resetDialog.showModal === 'function') resetDialog.showModal();
    else if (window.confirm('Alle Eingaben, Häkchen und Unterschriften löschen?')) resetAll();
  });

  confirmReset.addEventListener('click', () => {
    setTimeout(resetAll, 0);
  });

  function resetAll() {
    form.reset();
    ['moveDate', 'inspectionDate', 'signDate'].forEach((id) => {
      document.getElementById(id).value = todayISO();
    });
    clearSignature('tenantSignature');
    clearSignature('landlordSignature');
    defectDetails.value = '';
    defectCount.textContent = '0';
    updateConditionalFields();
    updateDefectFields();
    clearStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
