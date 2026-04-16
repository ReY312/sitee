# Электронная очередь (Node.js + Supabase)

Приложение повторяет flow с макетов:
1) пользователь выбирает день в календаре;
2) после выбора появляются поля ФИО и СНИЛС + кнопка **«Записаться»**;
3) после отправки показывается всплывающее окно с автоматически назначенными датой и временем.

## Алгоритм распределения времени

Для ограничения количества людей на один слот используется переменная:
- `SLOT_CAPACITY` — максимум заявок на одно время.

Сервер передает лимит в SQL-функцию `create_queue_request`, где:
- строятся слоты в рамках `SLOT_START_HOUR`..`SLOT_END_HOUR`;
- шаг слотов задается `SLOT_DURATION_MINUTES`;
- выбирается первый слот, где записей < `SLOT_CAPACITY`;
- если слотов нет, возвращается ошибка.

## Переменные окружения

Скопируйте `.env.example` в `.env`.

## Windows запуск

```powershell
cd C:\path\to\sitee
Copy-Item .env.example .env
npm install
npm run start
```

## Безопасность

- Защита от повторной активной записи по СНИЛС (`visited_at is null`).
- CSRF + проверка `Origin`.
- Rate limit по IP.
- Ограничение размера JSON body.
- Сервисный ключ Supabase хранится только на backend.

## Тесты

```bash
npm test
```

## Диагностика ошибки 500

Если приходит `500 Internal Server Error` при `POST /api/appointments`:
1. Убедитесь, что SQL из `supabase/schema.sql` применен в вашем проекте Supabase.
2. Проверьте, что backend использует актуальный `SUPABASE_SERVICE_ROLE_KEY`.
3. В новой версии сервер автоматически пробует старую и новую сигнатуру `create_queue_request`, чтобы не падать при несовпадении схем.


## Соответствие данных кнопки «Записаться» и schema.sql

При нажатии кнопки фронтенд отправляет: `fullName`, `snils`, `selectedDate`.
Backend преобразует это в RPC-параметры `p_full_name`, `p_snils`, `p_visit_date` + параметры слотов (`p_slot_capacity`, `p_slot_start_time`, `p_slot_end_time`, `p_slot_minutes`) и `p_ip_hash`.
В `supabase/schema.sql` есть функция `create_queue_request` с точно такой сигнатурой.
Также добавлена legacy-перегрузка `create_queue_request(p_full_name, p_snils, p_appointment_at, p_ip_hash)` для совместимости.


## Как менять лимит людей на одно время

- `SLOT_CAPACITY` — это переменная-предел количества людей на один и тот же слот времени.
- Если в слоте уже `SLOT_CAPACITY` записей, SQL-функция автоматически выбирает следующий слот.
- Смещение на следующее время задается `SLOT_DURATION_MINUTES` (по умолчанию `30`, то есть +30 минут).
