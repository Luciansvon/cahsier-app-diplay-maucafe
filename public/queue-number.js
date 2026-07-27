const SMALL_NUMBERS = [
  'nol',
  'satu',
  'dua',
  'tiga',
  'empat',
  'lima',
  'enam',
  'tujuh',
  'delapan',
  'sembilan',
  'sepuluh',
  'sebelas',
];

const SCALES = [
  [1_000_000_000_000_000, 'kuadriliun'],
  [1_000_000_000_000, 'triliun'],
  [1_000_000_000, 'miliar'],
  [1_000_000, 'juta'],
];

export function normalizeQueueNumber(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return text;
  return text.replace(/^0+(?=\d)/, '');
}

function numberToWords(value) {
  if (value < 12) return SMALL_NUMBERS[value];
  if (value < 20) return `${numberToWords(value - 10)} belas`;
  if (value < 100) {
    const remainder = value % 10;
    return `${numberToWords(Math.floor(value / 10))} puluh${remainder ? ` ${numberToWords(remainder)}` : ''}`;
  }
  if (value < 200) return `seratus${value > 100 ? ` ${numberToWords(value - 100)}` : ''}`;
  if (value < 1_000) {
    const remainder = value % 100;
    return `${numberToWords(Math.floor(value / 100))} ratus${remainder ? ` ${numberToWords(remainder)}` : ''}`;
  }
  if (value < 2_000) return `seribu${value > 1_000 ? ` ${numberToWords(value - 1_000)}` : ''}`;
  if (value < 1_000_000) {
    const remainder = value % 1_000;
    return `${numberToWords(Math.floor(value / 1_000))} ribu${remainder ? ` ${numberToWords(remainder)}` : ''}`;
  }
  for (const [scale, label] of SCALES) {
    if (value >= scale) {
      const remainder = value % scale;
      return `${numberToWords(Math.floor(value / scale))} ${label}${remainder ? ` ${numberToWords(remainder)}` : ''}`;
    }
  }
  return String(value);
}

export function queueNumberText(value) {
  const normalized = normalizeQueueNumber(value);
  const number = Number(normalized);
  if (!Number.isSafeInteger(number) || number < 0) return normalized;
  return numberToWords(number);
}
