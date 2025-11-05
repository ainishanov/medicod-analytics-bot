# Режим работы Telegram Бота

## 🔗 Текущий режим: WEBHOOK

Бот работает в **webhook режиме** для снижения нагрузки на сервер.

---

## 🚀 Как это работает

### Webhook Mode (ИСПОЛЬЗУЕТСЯ)

**Файл:** `src/webhookRunner.js` → `src/webhookServer.js`

**Принцип:**
- Telegram **сам** отправляет обновления на наш сервер
- Сервер слушает на порту **8443**
- URL: `https://api.medicod.ru/telegram-webhook`
- Защищён секретным токеном

**Преимущества:**
- ✅ Нет постоянных HTTP запросов
- ✅ Мгновенная доставка сообщений
- ✅ Меньше нагрузки на сервер
- ✅ Рекомендовано Telegram для production

**PM2 команда:**
```bash
pm2 start src/webhookRunner.js --name medicod-analytics-bot
```

---

### Polling Mode (ОТКЛЮЧЁН)

**Файл:** `src/botRunner.js.backup` (заархивирован)

**Принцип:**
- Бот **сам** постоянно опрашивает Telegram API
- Цикл: каждую секунду `getUpdates()`

**Недостатки:**
- ❌ Постоянные HTTP запросы
- ❌ Задержка до 1 секунды
- ❌ Больше нагрузки на сервер
- ❌ Конфликтует с webhook

**Когда использовать:**
- Только для разработки/тестирования
- Когда нет доступа к публичному URL
- Когда нет HTTPS

---

## ⚙️ Конфигурация

### .env переменные:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=8533441971:AAE3sS163LkzUkbKF8h31mI_O1AhgDgg6k8
TELEGRAM_CHAT_ID=117958330

# Webhook настройки
WEBHOOK_URL=https://api.medicod.ru/telegram-webhook
WEBHOOK_SECRET=76dda0389592ce43327cf8804f81bbae54ab5a1c0ebb5f77cdfeb10168aee62d
WEBHOOK_PORT=8443
WEBHOOK_PATH=/telegram-webhook

# База данных
DATABASE_PATH=/var/www/medicod-backend/data/medicod.db
```

---

## 🔧 Управление

### Проверить статус webhook:
```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq
```

### Удалить webhook (если нужно переключиться на polling):
```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook"
```

### Проверить, что порт слушается:
```bash
lsof -i :8443
```

### Логи бота:
```bash
pm2 logs medicod-analytics-bot
```

---

## 🐛 Troubleshooting

### Ошибка: "Conflict: can't use getUpdates method while webhook is active"

**Причина:** Webhook активен, а пытаешься использовать polling

**Решение:**
```bash
# Удали webhook
curl -s "https://api.telegram.org/bot${TOKEN}/deleteWebhook"

# ИЛИ переключись на webhook режим
pm2 restart medicod-analytics-bot --update-env
```

### Ошибка: "EADDRINUSE: address already in use :::8443"

**Причина:** Порт 8443 уже занят

**Решение:**
```bash
# Найди процесс
lsof -i :8443

# Убей старый процесс
kill -9 <PID>

# Перезапусти бота
pm2 restart medicod-analytics-bot
```

### Бот не отвечает

**Проверь:**
1. Webhook зарегистрирован: `/getWebhookInfo`
2. Nginx проксирует на 8443: `nginx -t`
3. Бот запущен: `pm2 list`
4. Логи: `pm2 logs medicod-analytics-bot --lines 50`

---

## 📝 История изменений

- **05.11.2025** - Переключен на webhook режим
- **05.11.2025** - Добавлены AI analytics команды (/ai, /aimodels, /aicost)
- **04.11.2025** - Первый запуск в polling режиме

---

## 🔄 Архитектура

```
Telegram API
    ↓ (webhook)
https://api.medicod.ru/telegram-webhook
    ↓ (nginx proxy)
localhost:8443/telegram-webhook
    ↓
webhookServer.js → botCommands.js
    ↓
SQLite DB (/var/www/medicod-backend/data/medicod.db)
```

---

**Для восстановления polling режима:**
```bash
cd /var/www/medicod-analytics-bot
mv src/botRunner.js.backup src/botRunner.js
pm2 delete medicod-analytics-bot
pm2 start src/botRunner.js --name medicod-analytics-bot
```

Но это **не рекомендуется** для production.
