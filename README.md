# 📊 Medicod Analytics Bot

Telegram бот для автоматической отправки еженедельных аналитических отчетов о работе Medicod Backend.

## 🚀 Возможности

- 📅 Автоматическая отправка отчетов каждый понедельник в 10:00 МСК
- 💰 Анализ платежей за неделю
- 📊 Динамика по дням
- ⚠️ Мониторинг ошибок
- 🤖 Статистика использования OCR и AI
- 🔮 Прогноз выручки на месяц

## 📦 Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd Medicod_Analytics_Bot

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
nano .env
```

## ⚙️ Настройка

### 1. Создать Telegram бота

1. Найти в Telegram бота [@BotFather](https://t.me/BotFather)
2. Отправить `/newbot` и следовать инструкциям
3. Получить токен бота (например: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Получить Chat ID

1. Написать своему боту `/start`
2. Открыть в браузере:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
3. Найти `"chat":{"id":123456789}`

### 3. Настроить .env

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=123456789
SERVICE_NAME=medicod-backend
```

## 🖥️ Использование

### Запуск с автоматическими отчетами

```bash
npm start
```

Бот будет работать в фоне и отправлять отчеты каждый понедельник в 10:00 МСК.

### Ручная отправка отчета (для тестирования)

```bash
npm run send-report
```

## 🐧 Развертывание на VPS

### 1. Установить на сервер

```bash
ssh root@89.223.126.35

# Клонировать репозиторий
cd /var/www
git clone <repository-url> medicod-analytics-bot
cd medicod-analytics-bot

# Установить зависимости
npm install

# Настроить .env
nano .env
```

### 2. Создать systemd service

```bash
sudo nano /etc/systemd/system/medicod-analytics-bot.service
```

Содержимое:

```ini
[Unit]
Description=Medicod Analytics Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/medicod-analytics-bot
ExecStart=/usr/bin/node /var/www/medicod-analytics-bot/src/index.js
Restart=always
RestartSec=10
Environment="NODE_ENV=production"
Environment="TELEGRAM_BOT_TOKEN=your_bot_token"
Environment="TELEGRAM_CHAT_ID=your_chat_id"
Environment="SERVICE_NAME=medicod-backend"

[Install]
WantedBy=multi-user.target
```

### 3. Запустить сервис

```bash
# Перезагрузить systemd
sudo systemctl daemon-reload

# Включить автозапуск
sudo systemctl enable medicod-analytics-bot

# Запустить
sudo systemctl start medicod-analytics-bot

# Проверить статус
sudo systemctl status medicod-analytics-bot

# Посмотреть логи
journalctl -u medicod-analytics-bot -f
```

## 📝 Пример отчета

```
📊 Еженедельный отчет Medicod Backend
3 ноября 2025 г.

💰 Финансовая статистика
• Платежей: 107
• Выручка: 4165₽
• Средний чек: 39₽
• Успешность: 100%

📅 Динамика по дням
• Nov 01: 24 платежей, 936₽
• Nov 02: 5 платежей, 243₽
• Nov 03: 5 платежей, 246₽

🤖 Использование функций
• OCR запросов: 0
• AI анализ: 1

⚠️ Ошибки
• Всего: 110
• Webhook ошибки: 110

🔮 Прогноз
• Средняя выручка в день: 595₽
• Прогноз на месяц: 17850₽

✅ Система работает стабильно
```

## 🔧 Настройка расписания

Изменить расписание можно в `src/index.js`:

```javascript
// Текущее: каждый понедельник в 10:00
cron.schedule('0 10 * * 1', sendWeeklyReport, {
  timezone: 'Europe/Moscow'
});

// Примеры других расписаний:
// '0 9 * * *'     - каждый день в 9:00
// '0 18 * * 5'    - каждую пятницу в 18:00
// '0 0 1 * *'     - 1-го числа каждого месяца
// '0 */6 * * *'   - каждые 6 часов
```

## 🛠️ Команды управления

```bash
# Запустить
sudo systemctl start medicod-analytics-bot

# Остановить
sudo systemctl stop medicod-analytics-bot

# Перезапустить
sudo systemctl restart medicod-analytics-bot

# Статус
sudo systemctl status medicod-analytics-bot

# Логи (в реальном времени)
journalctl -u medicod-analytics-bot -f

# Логи (последние 50 строк)
journalctl -u medicod-analytics-bot -n 50
```

## 🔍 Troubleshooting

### Бот не отправляет сообщения

1. Проверить логи:
   ```bash
   journalctl -u medicod-analytics-bot -n 100
   ```

2. Проверить токен бота:
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
   ```

3. Проверить переменные окружения:
   ```bash
   systemctl show medicod-analytics-bot --property=Environment
   ```

### Ошибка "Cannot find package"

```bash
cd /var/www/medicod-analytics-bot
npm install
sudo systemctl restart medicod-analytics-bot
```

## 📄 Лицензия

MIT

## 👥 Автор

Medicod Team
