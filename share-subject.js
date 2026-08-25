(() => {
  'use strict';

  if (typeof navigator.share !== 'function') return;

  const nativeShare = navigator.share.bind(navigator);

  const clean = (value) => String(value || '').trim().replace(/\s+/g, ' ');
  const formatDate = (value) => {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}.${month}.${year}` : value;
  };

  const buildShareTitle = () => {
    const address = clean(document.getElementById('objectRoom')?.value);
    const name = clean(document.getElementById('fullName')?.value);
    const date = formatDate(document.getElementById('moveDate')?.value);
    return ['Übergabeprotokoll', address, name, date].filter(Boolean).join(' ');
  };

  const shareWithDynamicTitle = (data = {}) => {
    return nativeShare({ ...data, title: buildShareTitle() });
  };

  try {
    navigator.share = shareWithDynamicTitle;
  } catch (_) {
    try {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: shareWithDynamicTitle
      });
    } catch (_) {
      // Falls der Browser navigator.share nicht überschreiben lässt,
      // bleibt die normale Share-Funktion erhalten.
    }
  }
})();
