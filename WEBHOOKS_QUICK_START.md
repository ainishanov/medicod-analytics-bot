# 🚀 Webhooks Quick Start

## ⚡ Быстрый переход на Webhooks (5 минут)

### 1️⃣ Установи зависимости
```bash
cd Medicod_Analytics_Bot
npm install
```

### 2️⃣ Настрой `.env`
```bash
# Скопируй пример
cp .env.webhook.example .env

# Отредактируй значения:
WEBHOOK_URL=https://api.medicod.ru/telegram-webhook
WEBHOOK_SECRET=$(openssl rand -hex 32)  # Сгенерируй случайный токен
WEBHOOK_PORT=8443
```

### 3️⃣ Проверь текущий статус
```bash
npm run webhook:info
```

### 4️⃣ Останови polling бота (если запущен)
```bash
# Нажми Ctrl+C в терминале где запущен: npm run bot
```

### 5️⃣ Настрой Nginx (если используется)

Добавь в `/etc/nginx/sites-available/api.medicod.ru`:

```nginx
# Telegram Webhook
location /telegram-webhook {
    proxy_pass http://localhost:8443/telegram-webhook;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Telegram-Bot-Api-Secret-Token $http_x_telegram_bot_api_secret_token;
}
```

Перезагрузи Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 6️⃣ Зарегистрируй webhook
```bash
npm run webhook:set
```

### 7️⃣ Запусти webhook сервер
```bash
npm run webhook
```

### 8️⃣ Проверь работу
Отправь `/help` в Telegram → должен ответить мгновенно!

---

## 📊 Результат

| До (Polling) | После (Webhooks) | Улучшение |
|--------------|------------------|-----------|
| 86,400 запросов/день | ~100 запросов/день | **99.88% ↓** |
| 1-2 сек задержка | <500мс | **60-80% ↑** |

---

## 🔙 Откат на Polling

Если что-то пошло не так:

```bash
# 1. Удалить webhook
npm run webhook:delete

# 2. Запустить polling
npm run bot
```

---

## 📚 Подробная документация

См. [WEBHOOK_MIGRATION_GUIDE.md](./WEBHOOK_MIGRATION_GUIDE.md)

---

## 🆘 Troubleshooting

**Бот не отвечает?**
```bash
# Проверь статус
npm run webhook:info

# Проверь логи
# В терминале где запущен npm run webhook
```

**403 Forbidden?**
- Проверь что `WEBHOOK_SECRET` в `.env` правильный

**Bad Request: wrong webhook URL?**
- URL должен быть HTTPS
- Порт должен быть: 443, 80, 88, или 8443

---

Готово! 🎉
