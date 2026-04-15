const form = document.querySelector('#queue-form');
const message = document.querySelector('#message');
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;

const snilsInput = document.querySelector('#snils');

function formatSnilsInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  const tail = digits.length > 9 ? digits.slice(9, 11) : '';

  return `${parts.join('-')}${tail ? ` ${tail}` : ''}`;
}

snilsInput.addEventListener('input', () => {
  snilsInput.value = formatSnilsInput(snilsInput.value);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.className = '';
  message.textContent = 'Отправка...';

  const payload = {
    fullName: form.fullName.value,
    snils: form.snils.value,
    appointmentAt: form.appointmentAt.value,
  };

  try {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка создания записи.');
    }

    message.className = 'success';
    message.textContent = `Успех! Талон №${data.ticketId}. Время: ${new Date(data.appointmentAt).toLocaleString('ru-RU')}`;
    form.reset();
  } catch (error) {
    message.className = 'error';
    message.textContent = error.message;
  }
});
