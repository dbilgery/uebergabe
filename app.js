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

    // Extra Safari/iPadOS protection. touch-action:none already handles most
    // gestures, these listeners stop scroll chaining at the canvas boundary.
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
    if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.');
    const { jsPDF } = window.jspdf;
    const d = formData();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    const W = 210;
    const margin = 16;
    const contentW = W - margin * 2;
    const ink = [15, 23, 42];
    const muted = [100, 116, 139];
    const line = [214, 222, 232];
    const pale = [244, 246, 248];
    let y = 17;

    const txt = (text, x, yy, size = 9.5, style = 'normal', color = ink, options = {}) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(String(text ?? ''), x, yy, options);
    };
    const rule = (yy) => { doc.setDrawColor(...line); doc.setLineWidth(.3); doc.line(margin, yy, W - margin, yy); };
    const section = (num, title) => {
      doc.setFillColor(...pale); doc.roundedRect(margin, y - 4.4, 8.5, 8.5, 2, 2, 'F');
      txt(num, margin + 4.25, y + 1.2, 7.5, 'bold', ink, { align: 'center' });
      txt(title, margin + 12, y + 1.4, 11.5, 'bold');
      y += 9.5;
    };
    const labelValue = (label, value, x, yy, width) => {
      txt(label, x, yy, 7.2, 'bold', muted);
      const lines = doc.splitTextToSize(value || '—', width);
      txt(lines, x, yy + 5, 9.4, 'normal', ink);
    };
    const checkbox = (checked, label, yy) => {
      doc.setDrawColor(...ink); doc.setLineWidth(.35); doc.rect(margin, yy - 3, 3.4, 3.4);
      if (checked) {
        doc.setLineWidth(.55); doc.line(margin + .7, yy - 1.2, margin + 1.5, yy - .3); doc.line(margin + 1.5, yy - .3, margin + 3, yy - 2.5);
      }
      txt(label, margin + 6, yy, 8.6);
    };

    txt('ÜBERGABEPROTOKOLL', margin, y, 8, 'bold', muted);
    y += 8;
    txt(d.objectRoom, margin, y, 19, 'bold');
    y += 6.5;
    txt(`${d.type === 'Einzug' ? 'Vor dem Einzug' : 'Vor dem Auszug'} · ${d.moveDate}`, margin, y, 9.2, 'normal', muted);
    y += 7;
    rule(y); y += 9;

    section('01', 'Übergabe');
    labelValue('Vollständiger Name', d.fullName, margin, y, 82);
    labelValue('Ein-/Auszugsdatum', d.moveDate, 111, y, 83);
    y += 15;
    if (d.type === 'Auszug') {
      labelValue('IBAN', d.iban || '—', margin, y, 82);
      labelValue('Neue Anschrift', d.newAddress || '—', 111, y, 83);
      y += 16;
    }
    rule(y); y += 9;

    section('02', 'Begehung & Zustand');
    labelValue('Datum der Begehung', d.inspectionDate, margin, y, 60);
    labelValue('Mängel festgestellt?', d.defects === 'Keine' ? 'Keine' : 'Folgende', 82, y, 60);
    y += 14;
    if (d.defects === 'Folgende') {
      txt('Festgestellte Mängel', margin, y, 7.2, 'bold', muted);
      const defectLines = doc.splitTextToSize(d.defectDetails, contentW);
      txt(defectLines.slice(0, 7), margin, y + 5, 8.4, 'normal', ink);
      y += Math.min(defectLines.length, 7) * 4.1 + 8;
    } else {
      txt('Bei der Begehung wurden keine Mängel festgestellt.', margin, y + 1, 8.6);
      y += 8;
    }
    txt('Zustand des Zimmers', margin, y, 7.2, 'bold', muted); y += 6;
    checkbox(d.checkWaste, 'Altglas, Müll und Pfand entsorgt', y); y += 6;
    checkbox(d.checkFloor, 'Zimmerboden gesaugt und feucht gewischt', y); y += 6;
    checkbox(d.checkFurniture, 'Oberflächen von allen Möbeln feucht gewischt', y); y += 8;
    rule(y); y += 9;

    section('03', 'Schlüssel');
    labelValue('Haus- und Wohnungsschlüssel', `${d.houseKeys} Stück`, margin, y, 82);
    labelValue('Zimmerschlüssel', `${d.roomKeys} Stück`, 111, y, 83);
    y += 15;
    rule(y); y += 9;

    section('04', 'Unterschriften');
    labelValue('Ort', d.signPlace, margin, y, 82);
    labelValue('Datum', d.signDate, 111, y, 83);
    y += 13;

    const sigY = y;
    const sigW = 82;
    const sigH = 25;
    doc.setDrawColor(...line);
    doc.roundedRect(margin, sigY, sigW, sigH, 2, 2);
    doc.roundedRect(111, sigY, sigW, sigH, 2, 2);
    doc.addImage(d.tenantSignature, 'PNG', margin + 2, sigY + 2, sigW - 4, sigH - 5, undefined, 'FAST');
    doc.addImage(d.landlordSignature, 'PNG', 113, sigY + 2, sigW - 4, sigH - 5, undefined, 'FAST');
    txt('Unterschrift Mieter', margin, sigY + sigH + 5, 7.2, 'bold', muted);
    txt('Unterschrift Vermieter', 111, sigY + sigH + 5, 7.2, 'bold', muted);

    doc.setDrawColor(...line); doc.line(margin, 285, W - margin, 285);
    txt('Übergabeprotokoll · digital erstellt', margin, 290, 6.8, 'normal', muted);
    txt(`Erstellt am ${formatDate(todayISO())}`, W - margin, 290, 6.8, 'normal', muted, { align: 'right' });

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
        a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
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

  form.addEventListener('submit', (e) => { e.preventDefault(); sharePdf(); });
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
    ['moveDate', 'inspectionDate', 'signDate'].forEach((id) => { document.getElementById(id).value = todayISO(); });
    clearSignature('tenantSignature');
    clearSignature('landlordSignature');
    defectDetails.value = '';
    defectCount.textContent = '0';
    updateConditionalFields();
    updateDefectFields();
    clearStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();