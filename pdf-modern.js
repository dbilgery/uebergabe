(() => {
  'use strict';

  const form = document.getElementById('handoverForm');
  const shareButton = document.getElementById('sharePdfButton');
  const downloadButton = document.getElementById('downloadPdfButton');
  const statusMessage = document.getElementById('statusMessage');

  if (!form || !shareButton || !downloadButton) return;

  const $ = (id) => document.getElementById(id);

  const formatDate = (value) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}.${month}.${year}` : value;
  };

  const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');

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
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
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
        if (el) el.classList.add('invalid');
        if (!firstInvalid && el) firstInvalid = el;
      }
    });

    const defects = form.elements.defects?.value;
    const defectDetails = $('defectDetails');
    if (defects === 'Folgende' && !clean(defectDetails?.value)) {
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

    const ink = [29, 34, 43];
    const muted = [102, 108, 118];
    const lightText = [126, 132, 142];
    const rule = [207, 211, 217];
    const soft = [246, 247, 249];
    const softStrong = [237, 239, 242];
    const white = [255, 255, 255];

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

    const pageHeader = (continuation = false) => {
      if (continuation) {
        text('Übergabeprotokoll', M, 18, 9.5, 'bold', ink);
        text(d.objectRoom, R, 18, 7.5, 'normal', muted, { align: 'right' });
        hLine(22, rule, 0.25);
        y = 31;
        sectionCount = 0;
        return;
      }

      text('Übergabeprotokoll', M, y, 18, 'bold', ink);
      text(d.type === 'Auszug' ? 'AUSZUG' : 'EINZUG', R, y - 0.3, 7.5, 'bold', muted, { align: 'right' });
      y += 6.5;
      text(d.objectRoom, M, y, 10.2, 'normal', muted);
      text(d.moveDate, R, y, 8.2, 'normal', muted, { align: 'right' });
      y += 6;
      hLine(y, ink, 0.55);
      y += 9;
    };

    const ensureSpace = (needed) => {
      if (y + needed <= 274) return;
      doc.addPage();
      pageHeader(true);
    };

    const section = (number, title) => {
      const gapBefore = sectionCount === 0 ? 0 : 7;
      ensureSpace(18 + gapBefore);
      y += gapBefore;
      text(String(number).padStart(2, '0'), M, y, 7.2, 'bold', lightText);
      text(title, M + 10, y, 10.8, 'bold', ink);
      hLine(y + 3.5, rule, 0.25);
      y += 10.5;
      sectionCount += 1;
    };

    const fieldCell = (label, value, x, yy, width, options = {}) => {
      const valueSize = options.valueSize || 9.6;
      const bold = Boolean(options.bold);
      text(label, x, yy, 6.9, 'normal', lightText);
      const lines = doc.splitTextToSize(value || '—', width);
      text(lines, x, yy + 4.7, valueSize, bold ? 'bold' : 'normal', ink);
      return lines.length;
    };

    const fieldRow = (left, right, options = {}) => {
      const top = y;
      const leftLines = fieldCell(left.label, left.value, M, top, right ? HALF : CW, left.options || {});
      let rightLines = 1;
      if (right) rightLines = fieldCell(right.label, right.value, COL2, top, HALF, right.options || {});
      const lines = Math.max(leftLines, rightLines);
      const rowH = Math.max(11.5, 7 + lines * 4.2);
      if (options.divider !== false) hLine(top + rowH, rule, 0.2);
      y = top + rowH + 4.5;
    };

    const checkbox = (checked, label, yy) => {
      const s = 3.15;
      doc.setDrawColor(...ink);
      doc.setLineWidth(0.3);
      doc.rect(M, yy - 2.5, s, s);
      if (checked) {
        doc.setLineWidth(0.48);
        doc.line(M + 0.65, yy - 0.9, M + 1.4, yy - 0.15);
        doc.line(M + 1.4, yy - 0.15, M + 2.65, yy - 2.0);
      }
      text(label, M + 5.5, yy, 8.7, 'normal', ink);
    };

    const drawFooter = () => {
      const total = doc.getNumberOfPages();
      for (let page = 1; page <= total; page += 1) {
        doc.setPage(page);
        hLine(282, rule, 0.2);
        text(d.objectRoom, M, 287.2, 6.6, 'normal', muted);
        text(`Seite ${page} von ${total}`, R, 287.2, 6.6, 'normal', muted, { align: 'right' });
      }
    };

    pageHeader(false);

    section(1, 'Übergabe');

    fieldRow(
      { label: 'Vollständiger Name', value: d.fullName, options: { bold: true } },
      { label: 'Ein-/Auszugsdatum', value: d.moveDate },
      { divider: false }
    );

    if (d.type === 'Auszug') {
      y += 1.5;
      fieldRow(
        { label: 'IBAN', value: d.iban || '—' },
        { label: 'Neue Anschrift', value: d.newAddress || '—' },
        { divider: false }
      );
    }

    section(2, 'Zustand');

    if (d.defects === 'Keine') {
      text(`Bei der Begehung am ${d.inspectionDate} wurden keine Mängel festgestellt.`, M, y, 9, 'normal', ink);
      y += 9;
    } else {
      text(`Bei der Begehung am ${d.inspectionDate} wurden folgende Mängel festgestellt:`, M, y, 9, 'normal', ink);
      y += 6;
      const defectLines = doc.splitTextToSize(d.defectDetails, CW - 8);
      const blockH = Math.max(16, defectLines.length * 4.2 + 8);
      ensureSpace(blockH + 28);
      doc.setFillColor(...soft);
      doc.setDrawColor(...rule);
      doc.setLineWidth(0.2);
      doc.rect(M, y, CW, blockH, 'FD');
      text('Festgestellte Mängel', M + 4, y + 4.8, 6.8, 'bold', lightText);
      text(defectLines, M + 4, y + 10.2, 8.6, 'normal', ink);
      y += blockH + 7;
    }

    text('Zustand des Zimmers', M, y, 7, 'bold', lightText);
    y += 6;
    checkbox(d.checkWaste, 'Altglas, Müll und Pfand entsorgt', y); y += 6;
    checkbox(d.checkFloor, 'Zimmerboden gesaugt und feucht gewischt', y); y += 6;
    checkbox(d.checkFurniture, 'Oberflächen von allen Möbeln feucht gewischt', y); y += 8;

    section(3, 'Schlüssel');
    text('Abschließend wurden folgende Schlüssel übergeben:', M, y, 8.8, 'normal', ink);
    y += 7;

    const keyTop = y;
    const keyH = 22;
    doc.setFillColor(...soft);
    doc.rect(M, keyTop, CW, keyH, 'F');
    doc.setDrawColor(...softStrong);
    doc.setLineWidth(0.25);
    doc.line(M + CW / 2, keyTop + 4, M + CW / 2, keyTop + keyH - 4);

    text('Haus- und Wohnungsschlüssel', M + 5, keyTop + 6, 6.8, 'normal', lightText);
    text(d.houseKeys, M + 5, keyTop + 15.2, 13, 'bold', ink);
    text('Stück', M + 13.5, keyTop + 15.2, 8, 'normal', muted);

    const keyRight = M + CW / 2 + 5;
    text('Zimmerschlüssel', keyRight, keyTop + 6, 6.8, 'normal', lightText);
    text(d.roomKeys, keyRight, keyTop + 15.2, 13, 'bold', ink);
    text('Stück', keyRight + 8.5, keyTop + 15.2, 8, 'normal', muted);
    y += keyH + 2;

    section(4, 'Unterschriften');
    fieldRow(
      { label: 'Ort', value: d.signPlace },
      { label: 'Datum', value: d.signDate },
      { divider: false }
    );

    ensureSpace(40);
    const sigTop = y + 1;
    const sigH = 20;
    const sigLine = sigTop + sigH + 1;

    doc.setFillColor(...white);
    doc.rect(M, sigTop, HALF, sigH, 'F');
    doc.rect(COL2, sigTop, HALF, sigH, 'F');
    doc.addImage(d.tenantSignature, 'PNG', M + 1, sigTop, HALF - 2, sigH - 1, undefined, 'FAST');
    doc.addImage(d.landlordSignature, 'PNG', COL2 + 1, sigTop, HALF - 2, sigH - 1, undefined, 'FAST');

    doc.setDrawColor(...ink);
    doc.setLineWidth(0.3);
    doc.line(M, sigLine, M + HALF, sigLine);
    doc.line(COL2, sigLine, COL2 + HALF, sigLine);
    text(`Unterschrift Mieter · ${d.fullName}`, M, sigLine + 5, 6.8, 'normal', muted);
    text('Unterschrift Vermieter', COL2, sigLine + 5, 6.8, 'normal', muted);

    drawFooter();

    const filename = `Uebergabeprotokoll_${sanitizeFilename(d.fullName)}_${d.moveDateRaw}.pdf`;
    return { doc, filename, data: d };
  }

  const buildSubject = (d) => ['Übergabeprotokoll', d.objectRoom, d.fullName, d.moveDate]
    .filter(Boolean)
    .join(' ');

  async function shareModernPdf() {
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

  function downloadModernPdf() {
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
    shareModernPdf();
  }, true);

  downloadButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    downloadModernPdf();
  }, true);
})();
