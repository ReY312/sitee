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

  const dateTimeRaw = String(payload?.appointmentAt ?? '');
  const appointmentDate = new Date(dateTimeRaw);
  if (Number.isNaN(appointmentDate.valueOf())) {
    errors.push('Некорректная дата/время.');
  } else {
    const now = Date.now();
    const appointmentTime = appointmentDate.valueOf();
    const maxForward = now + 1000 * 60 * 60 * 24 * 90;
    if (appointmentTime < now + 1000 * 60 * 10 || appointmentTime > maxForward) {
      errors.push('Дата должна быть не ранее чем через 10 минут и не позднее 90 дней.');
    }
  }

  return {
    success: errors.length === 0,
    errors,
    data: {
      fullName,
      snils,
      appointmentAt: dateTimeRaw,
    },
  };
}
