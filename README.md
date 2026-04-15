# Электронная очередь (Node.js + Supabase)

Fullstack-приложение записи в электронную очередь в стиле daluniver.ru:
- выбор даты/времени;
- ввод ФИО и СНИЛС;
- без регистрации;
- запись напрямую в Supabase (PostgreSQL).

## 1) Возможности

- **Один активный талон на один СНИЛС**: пока посещение не отмечено (`visited_at IS NULL`), новую запись создать нельзя.
- **Безопасный backend-only доступ к Supabase** через `SUPABASE_SERVICE_ROLE_KEY` (ключ никогда не уходит в браузер).
- **CSRF защита** (double-submit token + проверка `Origin`).
- **Rate limiting** по IP.
- **Строгая валидация** ФИО, СНИЛС (включая контрольную сумму) и даты.
- **Защитные HTTP-заголовки** (CSP, HSTS, X-Frame-Options и т.д.).
- **Хеширование IP** в БД (SHA-256 в функции SQL).

## 2) Требования (Windows)

- Windows 10/11
- Node.js 20+
- npm 10+
- Supabase проект

## 3) Настройка Supabase

1. Создайте проект в Supabase.
2. Откройте SQL Editor и выполните файл `supabase/schema.sql`.
3. Возьмите:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (только на сервере)

## 4) Локальный запуск (Windows)

### PowerShell

```powershell
cd C:\path\to\sitee
Copy-Item .env.example .env
# Заполните .env своими значениями Supabase
npm install
npm run start
```

Откройте: `http://localhost:3000`

## 5) API

### `POST /api/appointments`

Тело:

```json
{
  "fullName": "Иванов Иван Иванович",
  "snils": "112-233-445 95",
  "appointmentAt": "2026-04-20T10:30"
}
```

Ответ 201:

```json
{
  "message": "Запись успешно создана.",
  "ticketId": 123,
  "appointmentAt": "2026-04-20T10:30:00+00:00"
}
```

## 6) Модель защиты от дублей

- В БД стоит частичный уникальный индекс:
  - `unique(snils) where visited_at is null`
- Создание записи выполняется SQL-функцией `create_queue_request(...)`.
- При попытке повторной активной записи возвращается конфликт (`409`).

## 7) Рекомендации по прод-безопасности

- Разместить сервис за reverse proxy с TLS (Nginx/Caddy).
- Вынести IP-based rate limit в Redis для multi-instance.
- Включить журналирование событий и алерты.
- Ограничить доступ к `service_role` только backend-серверу.
- Проводить регулярную ротацию ключей.

