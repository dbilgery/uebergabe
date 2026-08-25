(() => {
  'use strict';

  const form = document.getElementById('handoverForm');
  const shareButton = document.getElementById('sharePdfButton');
  const downloadButton = document.getElementById('downloadPdfButton');
  const statusMessage = document.getElementById('statusMessage');

  if (!form || !shareButton || !downloadButton) return;

  const $ = (id) => document.getElementById(id);
  const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');

  const formatDate = (value) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}.${month}.${year}` : value;
  };

  const sanitizeFilename = (value) => clean(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 70) || 'Uebergabe';

  const setStatus = (message, type = 'success') => {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.classList.remove('hidden', 'error');
    if (type === 'error') statusMessage.classList.add('error');
  };

  const clearValidation = () => {
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    if (statusMessage) {
      statusMessage.classList.add('hidden');
      statusMessage.classList.remove('error');
    }
  };

  function canvasHasInk(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return false;
    try {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] < 225 || data[i + 1] < 225 || data[i + 2] < 225) return true;
      }
    } catch (_) {
      return true;
    }
    return false;
  }

  function validate() {
    clearValidation();
    let firstInvalid = null;

    ['objectRoom', 'fullName', 'moveDate', 'inspectionDate', 'signPlace', 'signDate'].forEach((id) => {
      const el = $(id);
      if (!el || !clean(el.value)) {
        el?.classList.add('invalid');
        if (!firstInvalid && el) firstInvalid = el;
      }
    });

    const defectDetails = $('defectDetails');
    if (form.elements.defects?.value === 'Folgende' && !clean(defectDetails?.value)) {
      defectDetails?.classList.add('invalid');
      if (!firstInvalid) firstInvalid = defectDetails;
    }

    ['tenantSignature', 'landlordSignature'].forEach((id) => {
      const canvas = $(id);
      if (!canvasHasInk(canvas)) {
        canvas?.classList.add('invalid');
        if (!firstInvalid && canvas) firstInvalid = canvas;
      }
    });

    if (firstInvalid) {
      setStatus('Bitte fülle die markierten Pflichtfelder aus und ergänze beide Unterschriften.', 'error');
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }

  function collectData() {
    return {
      type: form.elements.handoverType?.value || 'Einzug',
      objectRoom: clean($('objectRoom')?.value),
      fullName: clean($('fullName')?.value),
      moveDate: formatDate($('moveDate')?.value),
      moveDateRaw: $('moveDate')?.value || '',
      iban: clean($('iban')?.value),
      newAddress: clean($('newAddress')?.value),
      inspectionDate: formatDate($('inspectionDate')?.value),
      defects: form.elements.defects?.value || 'Keine',
      defectDetails: clean($('defectDetails')?.value),
      checkWaste: Boolean($('checkWaste')?.checked),
      checkFloor: Boolean($('checkFloor')?.checked),
      checkFurniture: Boolean($('checkFurniture')?.checked),
      houseKeys: clean($('houseKeys')?.value) || '0',
      roomKeys: clean($('roomKeys')?.value) || '0',
      signPlace: clean($('signPlace')?.value),
      signDate: formatDate($('signDate')?.value),
      tenantSignature: $('tenantSignature')?.toDataURL('image/png'),
      landlordSignature: $('landlordSignature')?.toDataURL('image/png')
    };
  }

  function buildPdf() {
    if (!window.jspdf?.jsPDF) {
      throw new Error('PDF-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.');
    }

    const { jsPDF } = window.jspdf;
    const d = collectData();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });

    const PAGE_W = 210;
    const M = 18;
    const R = PAGE_W - M;
    const CW = R - M;
    const GAP = 10;
    const HALF = (CW - GAP) / 2;
    const COL2 = M + HALF + GAP;
    const CONTENT_BOTTOM = 274;

    const ink = [29, 34, 43];
    const muted = [102, 108, 118];
    const lightText = [126, 132, 142];
    const rule = [207, 211, 217];
    const soft = [246, 247, 249];
    const softStrong = [237, 239, 242];
    const white = [255, 255, 255];

    const defectLength = d.defectDetails.length;
    const dense = d.type === 'Auszug' || defectLength > 260;
    const veryDense = defectLength > 430;
    const sectionGap = veryDense ? 3.4 : dense ? 4.4 : 6.2;
    const sectionBodyGap = veryDense ? 8.4 : 9.6;
    const rowBase = veryDense ? 10.1 : 11.0;
    const rowAfter = veryDense ? 2.8 : 3.8;
    const keyH = veryDense ? 18 : 20;
    const sigPreferredH = veryDense ? 14 : dense ? 16 : 18;

    let y = 20;
    let sectionCount = 0;

    const text = (value, x, yy, size = 9, style = 'normal', color = ink, options = {}) => {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(value == null ? '' : value, x, yy, options);
    };

    const hLine = (yy, color = rule, width = 0.25, x1 = M, x2 = R) => {
      doc.setDrawColor(...color);
      doc.setLineWidth(width);
      doc.line(x1, yy, x2, yy);
    };

    const fitSingleLine = (value, x, yy, maxWidth, startSize, minSize, style = 'normal', color = ink, options = {}) => {
      let size = startSize;
      doc.setFont('helvetica', style);
      while (size > minSize) {
        doc.setFontSize(size);
        if (doc.getTextWidth(String(value || '')) <= maxWidth) break;
        size -= 0.25;
      }
      text(value, x, yy, size, style, color, options);
    };

    fitSingleLine('Übergabeprotokoll', M, y, 100, 18, 15, 'bold', ink);
    text(d.type === 'Auszug' ? 'AUSZUG' : 'EINZUG', R, y - 0.3, 7.5, 'bold', muted, { align: 'right' });
    y += 6.3;
    fitSingleLine(d.objectRoom, M, y, 125, 10.2, 7.6, 'normal', muted);
    text(d.moveDate, R, y, 8.2, 'normal', muted, { align: 'right' });
    y += 6;
    hLine(y, ink, 0.55);
    y += 8.5;

    const section = (number, title) => {
      if (sectionCount > 0) y += sectionGap;
      text(String(number).padStart(2, '0'), M, y, 7.1, 'bold', lightText);
      text(title, M + 10, y, 10.6, 'bold', ink);
      hLine(y + 3.4, rule, 0.25);
      y += sectionBodyGap;
      sectionCount += 1;
    };

    const fieldCell = (label, value, x, yy, width, options = {}) => {
      const valueSize = options.valueSize || 9.4;
      const bold = Boolean(options.bold);
      text(label, x, yy, 6.7, 'normal', lightText);
      const lines = doc.splitTextToSize(value || '—', width);
      text(lines, x, yy + 4.5, valueSize, bold ? 'bold' : 'normal', ink);
      return lines.length;
    };

    const fieldRow = (left, right, options = {}) => {
      const top = y;
      const leftLines = fieldCell(left.label, left.value, M, top, right ? HALF : CW, left.options || {});
      let rightLines = 1;
      if (right) rightLines = fieldCell(right.label, right.value, COL2, top, HALF, right.options || {});
      const lines = Math.max(leftLines, rightLines);
      const rowH = Math.max(rowBase, 6.6 + lines * 3.8);
      if (options.divider) hLine(top + rowH, rule, 0.2);
      y = top + rowH + rowAfter;
    };

    const checkbox = (checked, label, yy) => {
      const s = 3.1;
      doc.setDrawColor(...ink);
      doc.setLineWidth(0.3);
      doc.rect(M, yy - 2.45, s, s);
      if (checked) {
        doc.setLineWidth(0.48);
        doc.line(M + 0.65, yy - 0.9, M + 1.4, yy - 0.15);
        doc.line(M + 1.4, yy - 0.15, M + 2.6, yy - 1.95);
      }
      text(label, M + 5.4, yy, veryDense ? 8.1 : 8.5, 'normal', ink);
    };

    section(1, 'Übergabe');
    fieldRow(
      { label: 'Vollständiger Name', value: d.fullName, options: { bold: true } },
      { label: 'Ein-/Auszugsdatum', value: d.moveDate }
    );

    if (d.type === 'Auszug') {
      fieldRow(
        { label: 'IBAN', value: d.iban || '—', options: { valueSize: 8.8 } },
        { label: 'Neue Anschrift', value: d.newAddress || '—', options: { valueSize: 8.8 } }
      );
    }

    section(2, 'Zustand');

    if (d.defects === 'Keine') {
      text(`Bei der Begehung am ${d.inspectionDate} wurden keine Mängel festgestellt.`, M, y, veryDense ? 8.3 : 8.8, 'normal', ink);
      y += veryDense ? 7.2 : 8.2;
    } else {
      text(`Bei der Begehung am ${d.inspectionDate} wurden folgende Mängel festgestellt:`, M, y, veryDense ? 8.1 : 8.6, 'normal', ink);
      y += 5.5;

      const maxDefectH = veryDense ? 39 : dense ? 43 : 47;
      let defectFont = veryDense ? 6.7 : 7.6;
      let defectLineH = veryDense ? 3.0 : 3.35;
      let defectLines = doc.splitTextToSize(d.defectDetails, CW - 8);

      while ((defectLines.length * defectLineH + 10) > maxDefectH && defectFont > 5.8) {
        defectFont -= 0.2;
        defectLineH = Math.max(2.65, defectLineH - 0.08);
        doc.setFontSize(defectFont);
        defectLines = doc.splitTextToSize(d.defectDetails, CW - 8);
      }

      const blockH = Math.min(maxDefectH, Math.max(15, defectLines.length * defectLineH + 9));
      doc.setFillColor(...soft);
      doc.setDrawColor(...rule);
      doc.setLineWidth(0.2);
      doc.rect(M, y, CW, blockH, 'FD');
      text('Festgestellte Mängel', M + 4, y + 4.5, 6.5, 'bold', lightText);
      text(defectLines, M + 4, y + 9.2, defectFont, 'normal', ink, { lineHeightFactor: 1.08 });
      y += blockH + (veryDense ? 4 : 5.5);
    }

    text('Zustand des Zimmers', M, y, 6.8, 'bold', lightText);
    y += 5.3;
    const checklistStep = veryDense ? 5.2 : 5.7;
    checkbox(d.checkWaste, 'Altglas, Müll und Pfand entsorgt', y); y += checklistStep;
    checkbox(d.checkFloor, 'Zimmerboden gesaugt und feucht gewischt', y); y += checklistStep;
    checkbox(d.checkFurniture, 'Oberflächen von allen Möbeln feucht gewischt', y); y += checklistStep;

    section(3, 'Schlüssel');
    text('Abschließend wurden folgende Schlüssel übergeben:', M, y, veryDense ? 8.1 : 8.6, 'normal', ink);
    y += veryDense ? 5.8 : 6.6;

    const keyTop = y;
    doc.setFillColor(...soft);
    doc.rect(M, keyTop, CW, keyH, 'F');
    doc.setDrawColor(...softStrong);
    doc.setLineWidth(0.25);
    doc.line(M + CW / 2, keyTop + 3.5, M + CW / 2, keyTop + keyH - 3.5);

    const keyLabelY = keyTop + (veryDense ? 5.2 : 5.8);
    const keyValueY = keyTop + (veryDense ? 13.2 : 14.3);
    text('Haus- und Wohnungsschlüssel', M + 5, keyLabelY, 6.5, 'normal', lightText);
    text(d.houseKeys, M + 5, keyValueY, veryDense ? 11.5 : 12.5, 'bold', ink);
    text('Stück', M + 13.5, keyValueY, 7.6, 'normal', muted);

    const keyRight = M + CW / 2 + 5;
    text('Zimmerschlüssel', keyRight, keyLabelY, 6.5, 'normal', lightText);
    text(d.roomKeys, keyRight, keyValueY, veryDense ? 11.5 : 12.5, 'bold', ink);
    text('Stück', keyRight + 8.5, keyValueY, 7.6, 'normal', muted);
    y += keyH;

    section(4, 'Unterschriften');
    fieldRow(
      { label: 'Ort', value: d.signPlace },
      { label: 'Datum', value: d.signDate }
    );

    const labelSpace = 7;
    const availableForSignature = Math.max(11, CONTENT_BOTTOM - y - labelSpace);
    const sigH = Math.max(11, Math.min(sigPreferredH, availableForSignature));
    const sigTop = y;
    const sigLine = sigTop + sigH + 0.8;

    doc.setFillColor(...white);
    doc.rect(M, sigTop, HALF, sigH, 'F');
    doc.rect(COL2, sigTop, HALF, sigH, 'F');
    doc.addImage(d.tenantSignature, 'PNG', M + 1, sigTop, HALF - 2, sigH - 1, undefined, 'FAST');
    doc.addImage(d.landlordSignature, 'PNG', COL2 + 1, sigTop, HALF - 2, sigH - 1, undefined, 'FAST');

    doc.setDrawColor(...ink);
    doc.setLineWidth(0.3);
    doc.line(M, sigLine, M + HALF, sigLine);
    doc.line(COL2, sigLine, COL2 + HALF, sigLine);
    text(`Unterschrift Mieter · ${d.fullName}`, M, sigLine + 4.5, 6.5, 'normal', muted);
    text('Unterschrift Vermieter', COL2, sigLine + 4.5, 6.5, 'normal', muted);

    hLine(282, rule, 0.2);
    fitSingleLine(d.objectRoom, M, 287.2, 120, 6.6, 5.8, 'normal', muted);
    text('Seite 1 von 1', R, 287.2, 6.6, 'normal', muted, { align: 'right' });

    const filename = `Uebergabeprotokoll_${sanitizeFilename(d.fullName)}_${d.moveDateRaw}.pdf`;
    return { doc, filename, data: d };
  }

  const buildSubject = (d) => ['Übergabeprotokoll', d.objectRoom, d.fullName, d.moveDate]
    .filter(Boolean)
    .join(' ');

  async function sharePdf() {
    if (!validate()) return;

    const oldLabel = shareButton.querySelector('span')?.textContent || 'PDF erstellen & teilen';
    shareButton.disabled = true;
    if (shareButton.querySelector('span')) shareButton.querySelector('span').textContent = 'PDF wird erstellt …';

    try {
      const { doc, filename, data } = buildPdf();
      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      const subject = buildSubject(data);

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: subject, text: subject, files: [file] });
        setStatus('PDF wurde an das Teilen-Menü übergeben. Deine Eingaben bleiben erhalten.');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        setStatus('Direktes Teilen wird von diesem Browser nicht unterstützt. Die PDF wurde heruntergeladen.');
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        setStatus('Teilen wurde abgebrochen. Deine Eingaben bleiben erhalten.', 'error');
      } else {
        console.error(err);
        setStatus(err?.message || 'Die PDF konnte nicht erstellt werden.', 'error');
      }
    } finally {
      shareButton.disabled = false;
      if (shareButton.querySelector('span')) shareButton.querySelector('span').textContent = oldLabel;
    }
  }

  function downloadPdf() {
    if (!validate()) return;
    try {
      const { doc, filename } = buildPdf();
      doc.save(filename);
      setStatus('PDF wurde heruntergeladen.');
    } catch (err) {
      console.error(err);
      setStatus(err?.message || 'Die PDF konnte nicht erstellt werden.', 'error');
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    sharePdf();
  }, true);

  downloadButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    downloadPdf();
  }, true);
})();