# ⚡ Быстрый старт

## 🤖 Создание Telegram бота (5 минут)

### 1. Получить токен бота

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. Отправить `/newbot`
3. Ввести имя: `Medicod Analytics Bot`
4. Ввести username: `medicod_analytics_bot` (или свой)
5. Скопировать токен: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

### 2. Получить Chat ID

1. Написать своему боту `/start`
2. Открыть: https://api.telegram.org/bot<TOKEN>/getUpdates
3. Скопировать Chat ID из `"chat":{"id":123456789}`

---

## 🚀 Развертывание на VPS (10 минут)

```bash
# 1. Подключиться к VPS
ssh root@89.223.126.35

# 2. Клонировать репозиторий
cd /var/www
git clone https://github.com/ainishanov/medicod-analytics-bot.git
cd medicod-analytics-bot

# 3. Установить зависимости
npm install

# 4. Создать .env файл
nano .env
```

Вставить:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
SERVICE_NAME=medicod-backend
```

```bash
# 5. Создать systemd service
sudo nano /etc/systemd/system/medicod-analytics-bot.service
```

Вставить:
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
EnvironmentFile=/var/www/medicod-analytics-bot/.env

[Install]
WantedBy=multi-user.target
```

```bash
# 6. Запустить сервис
sudo systemctl daemon-reload
sudo systemctl enable medicod-analytics-bot
sudo systemctl start medicod-analytics-bot

# 7. Проверить статус
sudo systemctl status medicod-analytics-bot

# 8. Тестовая отправка
cd /var/www/medicod-analytics-bot
npm run send-report
```

Готово! ✅

---

## 📅 Что дальше?

- Отчеты будут приходить **каждый понедельник в 10:00 МСК**
- Проверить логи: `journalctl -u medicod-analytics-bot -f`
- Отправить вручную: `npm run send-report`

---

## 🔧 Полезные команды

```bash
# Посмотреть логи
journalctl -u medicod-analytics-bot -n 50

# Перезапустить
sudo systemctl restart medicod-analytics-bot

# Остановить
sudo systemctl stop medicod-analytics-bot

# Отправить отчет вручную
cd /var/www/medicod-analytics-bot
npm run send-report
```
