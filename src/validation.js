const FULL_NAME_REGEX = /^[A-Za-zА-Яа-яЁё\-\s']{5,120}$/u;

export function normalizeSnils(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 11) {
    return null;
  }

  return digits;
}

export function formatSnils(snilsDigits) {
  return `${snilsDigits.slice(0, 3)}-${snilsDigits.slice(3, 6)}-${snilsDigits.slice(6, 9)} ${snilsDigits.slice(9)}`;
}

function hasValidSnilsChecksum(snilsDigits) {
  const body = snilsDigits.slice(0, 9);
  const checksum = Number.parseInt(snilsDigits.slice(9), 10);
  const serial = Number.parseInt(body, 10);

  if (serial <= 1001998) {
    return true;
  }

  const sum = body
    .split('')
    .reduce((acc, digit, index) => acc + Number.parseInt(digit, 10) * (9 - index), 0);

  let control;
  if (sum < 100) {
    control = sum;
  } else if (sum === 100 || sum === 101) {
    control = 0;
  } else {
    control = sum % 101;
    if (control === 100) {
      control = 0;
    }
  }

  return checksum === control;
}

function validateSelectedDate(selectedDateRaw) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDateRaw)) {
    return { valid: false, date: null };
  }

  const date = new Date(`${selectedDateRaw}T00:00:00`);
  if (Number.isNaN(date.valueOf())) {
    return { valid: false, date: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 365);

  if (date < today || date > maxDate) {
    return { valid: false, date: null };
  }

  return { valid: true, date };
}

export function validatePayload(payload) {
  const errors = [];
  const fullName = String(payload?.fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!FULL_NAME_REGEX.test(fullName)) {
    errors.push('Некорректное ФИО. Используйте только буквы, пробелы и дефисы.');
  }

  const snils = normalizeSnils(payload?.snils);
  if (!snils || !hasValidSnilsChecksum(snils)) {
    errors.push('Некорректный СНИЛС.');
  }

  const selectedDateRaw = String(payload?.selectedDate ?? '').trim();
  const checkedDate = validateSelectedDate(selectedDateRaw);
  if (!checkedDate.valid) {
    errors.push('Некорректная дата записи.');
  }

  return {
    success: errors.length === 0,
    errors,
    data: {
      fullName,
      snils,
      selectedDate: selectedDateRaw,
    },
  };
}
