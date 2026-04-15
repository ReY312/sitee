const calendarContainer = document.querySelector('#calendar');
const form = document.querySelector('#queue-form');
const placeholder = document.querySelector('#placeholder');
const selectedDateText = document.querySelector('#selected-date');
const modal = document.querySelector('#modal');
const modalText = document.querySelector('#modal-text');
const closeModal = document.querySelector('#close-modal');
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
const snilsInput = document.querySelector('#snils');

const state = {
  selectedDate: null,
  selectedButton: null,
};

function formatSnilsInput(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  const parts = [];
  if (digits.length > 0) parts.push(digits.slice(0, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 9));
  const tail = digits.length > 9 ? digits.slice(9, 11) : '';
  return `${parts.join('-')}${tail ? ` ${tail}` : ''}`;
}

function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function createMonthView(startDate) {
  const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const firstWeekDay = (monthStart.getDay() + 6) % 7;
  const monthName = monthStart.toLocaleString('ru-RU', { month: 'long' });

  const wrapper = document.createElement('section');
  wrapper.className = 'calendar-month';

  const title = document.createElement('h2');
  title.className = 'calendar-title';
  title.textContent = `${monthName[0].toUpperCase()}${monthName.slice(1)} ${monthStart.getFullYear()}`;
  wrapper.appendChild(title);

  const weekdays = document.createElement('div');
  weekdays.className = 'weekdays';
  ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((wd) => {
    const el = document.createElement('span');
    el.textContent = wd;
    weekdays.appendChild(el);
  });
  wrapper.appendChild(weekdays);

  const daysGrid = document.createElement('div');
  daysGrid.className = 'days-grid';

  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const prevMonthDays = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();

  for (let i = 0; i < 42; i += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'day';

    const dayNumber = i - firstWeekDay + 1;
    let realDate;

    if (dayNumber <= 0) {
      btn.textContent = String(prevMonthDays + dayNumber);
      btn.classList.add('muted');
      realDate = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, prevMonthDays + dayNumber);
    } else if (dayNumber > daysInMonth) {
      btn.textContent = String(dayNumber - daysInMonth);
      btn.classList.add('muted');
      realDate = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, dayNumber - daysInMonth);
    } else {
      btn.textContent = String(dayNumber);
      realDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNumber);
    }

    const isoDate = toIsoDate(realDate);
    btn.dataset.date = isoDate;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (realDate < today) {
      btn.disabled = true;
      btn.classList.add('muted');
    }

    btn.addEventListener('click', () => {
      if (state.selectedButton) {
        state.selectedButton.classList.remove('active');
      }
      state.selectedButton = btn;
      state.selectedDate = isoDate;
      btn.classList.add('active');

      placeholder.classList.add('hidden');
      form.classList.remove('hidden');
      selectedDateText.textContent = `Выбранная дата: ${new Date(`${isoDate}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}`;
    });

    daysGrid.appendChild(btn);
  }

  wrapper.appendChild(daysGrid);
  return wrapper;
}

function buildCalendar() {
  calendarContainer.innerHTML = '';
  const now = new Date();
  const month1 = new Date(now.getFullYear(), now.getMonth(), 1);
  const month2 = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  calendarContainer.append(createMonthView(month1), createMonthView(month2));
}

snilsInput.addEventListener('input', () => {
  snilsInput.value = formatSnilsInput(snilsInput.value);
});

closeModal.addEventListener('click', () => {
  modal.classList.add('hidden');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.selectedDate) {
    placeholder.textContent = 'Сначала выберите день в календаре';
    placeholder.classList.remove('hidden');
    return;
  }

  const payload = {
    fullName: form.fullName.value,
    snils: form.snils.value,
    selectedDate: state.selectedDate,
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
      throw new Error(data.error || 'Ошибка записи.');
    }

    const date = new Date(data.appointmentAt);
    const dateLabel = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeLabel = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

    modalText.textContent = `ВЫ ЗАПИСАНЫ НА ${timeLabel} ${dateLabel}`;
    modal.classList.remove('hidden');
    form.reset();
  } catch (error) {
    modalText.textContent = error.message;
    modal.classList.remove('hidden');
  }
});

buildCalendar();
