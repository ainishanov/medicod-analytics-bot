# ⚡ Быстрый старт - 15 минут

## ✅ Чеклист

### Шаг 1: Получить токены (5 минут)

#### Telegram Bot
- [ ] Открыть [@BotFather](https://t.me/BotFather)
- [ ] Отправить `/newbot`
- [ ] Ввести имя: `Medicod Analytics Bot`
- [ ] Ввести username: `medicod_analytics_bot`
- [ ] Скопировать токен: `123456789:ABCdefGHI...`

#### Chat ID
- [ ] Написать боту `/start`
- [ ] Открыть: `https://api.telegram.org/bot<TOKEN>/getUpdates`
- [ ] Скопировать Chat ID из `"chat":{"id":123456789}`

#### ZhipuAI API (опционально)
- [ ] Зарегистрироваться на https://open.bigmodel.cn/
- [ ] Перейти в "API Keys"
- [ ] Создать новый ключ
- [ ] Скопировать ключ

---

### Шаг 2: Развертывание на VPS (10 минут)

#### Подключение
```bash
ssh root@89.223.126.35
```

#### Установка
```bash
# Перейти в /var/www
cd /var/www

# Клонировать репозиторий
git clone https://github.com/ainishanov/medicod-analytics-bot.git
cd medicod-analytics-bot

# Установить зависимости
npm install
```

#### Настройка .env
```bash
nano .env
```

Вставить:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
SERVICE_NAME=medicod-backend

# Опционально: AI-анализ
ZHIPUAI_API_KEY=your_api_key
AI_ANALYSIS_ENABLED=true
```

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`

- [ ] .env создан
- [ ] Токены вставлены
- [ ] Файл сохранен

#### Создать systemd service
```bash
sudo nano /etc/systemd/system/medicod-analytics-bot.service
```

Вставить:
```ini
[Unit]
Description=Medicod Analytics Bot with AI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/medicod-analytics-bot
ExecStart=/usr/bin/node /var/www/medicod-analytics-bot/src/index.js
Restart=always
RestartSec=10
EnvironmentFile=/var/www/medicod-analytics-bot/.env

[Install]
WantedBy=multi-user.target
```

Сохранить: `Ctrl+O`, `Enter`, `Ctrl+X`

- [ ] Service файл создан
- [ ] Конфигурация вставлена
- [ ] Файл сохранен

#### Запустить сервис
```bash
# Перезагрузить systemd
sudo systemctl daemon-reload

# Включить автозапуск
sudo systemctl enable medicod-analytics-bot

# Запустить
sudo systemctl start medicod-analytics-bot

# Проверить статус
sudo systemctl status medicod-analytics-bot
```

**Ожидаемый результат**:
```
● medicod-analytics-bot.service - Medicod Analytics Bot with AI
   Active: active (running)
```

- [ ] Сервис запущен
- [ ] Статус: active (running)
- [ ] Нет ошибок

---

### Шаг 3: Тестирование (2 минуты)

#### Тестовая отправка
```bash
cd /var/www/medicod-analytics-bot
npm run send-report
```

**Ожидаемые логи**:
```
📊 Генерация еженедельного отчета...
🤖 Запрос AI анализа...
✅ AI анализ получен
✅ Отчет успешно отправлен в Telegram
```

- [ ] Команда выполнена
- [ ] Нет ошибок в консоли
- [ ] AI анализ получен (если включен)

#### Проверить Telegram
- [ ] Открыть Telegram
- [ ] Найти сообщение от бота
- [ ] Проверить содержимое:
  - [ ] Финансовая статистика
  - [ ] Динамика по дням
  - [ ] Ошибки
  - [ ] Прогноз
  - [ ] AI ИНСАЙТЫ (если AI включен)

#### Проверить логи
```bash
journalctl -u medicod-analytics-bot -f
```

- [ ] Логи открываются
- [ ] Нет критических ошибок
- [ ] AI логи присутствуют (если включен)

---

## ✅ Готово!

**Поздравляю!** Бот успешно развернут!

### Что дальше?

**Автоматические отчеты**:
- Следующий отчет: **Понедельник, 10:00 МСК**
- Расписание: каждый понедельник

**Полезные команды**:
```bash
# Посмотреть логи
journalctl -u medicod-analytics-bot -f

# Перезапустить
sudo systemctl restart medicod-analytics-bot

# Остановить
sudo systemctl stop medicod-analytics-bot

# Ручная отправка
cd /var/www/medicod-analytics-bot
npm run send-report
```

---

## 🔍 Troubleshooting

### Проблема: Бот не запускается

**Решение**:
```bash
# Проверить логи
journalctl -u medicod-analytics-bot -n 50

# Проверить .env
cat .env

# Проверить права
ls -la .env
```

### Проблема: AI не работает

**Решение**:
```bash
# Проверить API ключ
cat .env | grep ZHIPUAI_API_KEY

# Тестовый запрос
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $ZHIPUAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"glm-4-flash","messages":[{"role":"user","content":"test"}]}'
```

### Проблема: Telegram не получает

**Решение**:
```bash
# Проверить токен
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Проверить Chat ID
echo $TELEGRAM_CHAT_ID
```

### Проблема: Нет данных

**Решение**:
```bash
# Проверить medicod-backend
sudo systemctl status medicod-backend

# Проверить логи
journalctl -u medicod-backend -n 100 | grep "Платеж"
```

**Подробнее**: см. [README.md](./README.md) → Troubleshooting

---

## 📚 Дополнительная документация

- 📖 [README.md](./README.md) - Полная документация
- 🧠 [AI_FEATURES.md](./AI_FEATURES.md) - Техническая документация по AI

---

## 💡 Полезные советы

### Настройка расписания

Редактировать `src/index.js`:
```javascript
// Каждый день в 9:00
cron.schedule('0 9 * * *', sendWeeklyReport, {
  timezone: 'Europe/Moscow'
});

// Каждую пятницу в 18:00
cron.schedule('0 18 * * 5', sendWeeklyReport, {
  timezone: 'Europe/Moscow'
});
```

### Отключить AI

В `.env`:
```env
AI_ANALYSIS_ENABLED=false
```

Или просто не указывайте `ZHIPUAI_API_KEY`.

### Безопасность

```bash
# Ограничить права .env
chmod 600 .env

# Проверить, что .env не в Git
git status
```

---

## 🎉 Готово к работе!

Бот работает и будет отправлять отчеты каждый понедельник в 10:00 МСК!

**Следующий отчет**: _______________

**Нужна помощь?**
- Читай [README.md](./README.md)
- Смотри логи: `journalctl -u medicod-analytics-bot -f`
- Открой issue на GitHub
