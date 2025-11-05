/**
 * Webhook Server для Telegram Bot
 * Принимает обновления от Telegram через HTTPS webhooks
 *
 * Преимущества перед polling:
 * - 99.88% меньше API запросов (86,400/день → ~100/день)
 * - Мгновенные ответы (<500ms вместо 1-2 сек)
 * - Меньше нагрузка на сервер
 */

import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import BotCommandsHandler from './botCommands.js';

dotenv.config();

class WebhookServer {
  constructor() {
    this.app = express();
    this.botHandler = new BotCommandsHandler();
    this.port = process.env.WEBHOOK_PORT || 8443;
    this.webhookPath = process.env.WEBHOOK_PATH || '/telegram-webhook';
    this.webhookSecret = process.env.WEBHOOK_SECRET; // Для безопасности

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Настройка middleware
   */
  setupMiddleware() {
    // JSON parser с лимитом размера
    this.app.use(express.json({ limit: '10mb' }));

    // Логирование входящих запросов (только в dev)
    if (process.env.NODE_ENV !== 'production') {
      this.app.use((req, res, next) => {
        console.log(`📨 ${req.method} ${req.path}`);
        next();
      });
    }

    // CORS headers (если нужно)
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }

  /**
   * Проверка секретного токена из заголовка X-Telegram-Bot-Api-Secret-Token
   * https://core.telegram.org/bots/api#setwebhook
   */
  verifyTelegramRequest(req) {
    if (!this.webhookSecret) {
      // Если секрет не установлен, пропускаем проверку (небезопасно!)
      console.warn('⚠️  WEBHOOK_SECRET не задан - проверка безопасности отключена');
      return true;
    }

    const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];

    if (!receivedSecret) {
      console.warn('⚠️  Запрос без секретного токена');
      return false;
    }

    const isValid = crypto.timingSafeEqual(
      Buffer.from(receivedSecret),
      Buffer.from(this.webhookSecret)
    );

    if (!isValid) {
      console.warn('⚠️  Неверный секретный токен');
    }

    return isValid;
  }

  /**
   * Настройка routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mode: 'webhook'
      });
    });

    // Webhook endpoint для Telegram
    this.app.post(this.webhookPath, async (req, res) => {
      try {
        // Проверка безопасности
        if (!this.verifyTelegramRequest(req)) {
          console.error('❌ Unauthorized webhook request');
          return res.status(403).json({ error: 'Forbidden' });
        }

        const update = req.body;

        if (!update || !update.update_id) {
          console.warn('⚠️  Получен невалидный update');
          return res.status(400).json({ error: 'Invalid update' });
        }

        console.log(`📨 Получен update #${update.update_id}`);

        // Отправляем ответ Telegram сразу (200 OK)
        // Это важно! Telegram ждёт ответ в течение 60 секунд
        res.sendStatus(200);

        // Обрабатываем update асинхронно (не блокируем ответ)
        setImmediate(async () => {
          try {
            await this.botHandler.handleUpdate(update);
          } catch (error) {
            console.error('❌ Ошибка обработки update:', error.message);
            // Не пробрасываем ошибку - webhook уже ответил
          }
        });

      } catch (error) {
        console.error('❌ Ошибка webhook endpoint:', error.message);
        // Только если ещё не отправили ответ
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // 404 для всех остальных путей
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('❌ Express error:', err.message);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Регистрация webhook в Telegram API
   */
  async registerWebhook() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookUrl = process.env.WEBHOOK_URL; // Например: https://api.medicod.ru/telegram-webhook

    if (!webhookUrl) {
      throw new Error('WEBHOOK_URL не задан в .env');
    }

    console.log(`\n🔗 Регистрация webhook: ${webhookUrl}\n`);

    try {
      const params = {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'], // Только нужные типы
        drop_pending_updates: true, // Очистить очередь старых сообщений
        max_connections: 40, // По умолчанию 40
      };

      // Добавляем секретный токен если задан
      if (this.webhookSecret) {
        params.secret_token = this.webhookSecret;
        console.log('🔐 Webhook будет защищён секретным токеном');
      }

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/setWebhook`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        }
      );

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
      }

      console.log('✅ Webhook успешно зарегистрирован!\n');

      // Получаем информацию о webhook
      await this.getWebhookInfo();

      return true;
    } catch (error) {
      console.error('❌ Ошибка регистрации webhook:', error.message);
      throw error;
    }
  }

  /**
   * Получить информацию о текущем webhook
   */
  async getWebhookInfo() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getWebhookInfo`
      );
      const data = await response.json();

      if (data.ok && data.result) {
        const info = data.result;
        console.log('📊 Информация о webhook:');
        console.log(`   URL: ${info.url || 'не установлен'}`);
        console.log(`   Ожидающих обновлений: ${info.pending_update_count || 0}`);
        console.log(`   Максимум подключений: ${info.max_connections || 40}`);
        if (info.last_error_message) {
          console.log(`   ⚠️  Последняя ошибка: ${info.last_error_message}`);
        }
        console.log('');
      }
    } catch (error) {
      console.error('❌ Ошибка получения информации о webhook:', error.message);
    }
  }

  /**
   * Удалить webhook (переход обратно на polling)
   */
  async deleteWebhook() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/deleteWebhook`,
        { method: 'POST' }
      );
      const data = await response.json();

      if (data.ok) {
        console.log('✅ Webhook удалён');
        return true;
      } else {
        console.error('❌ Ошибка удаления webhook:', data.description);
        return false;
      }
    } catch (error) {
      console.error('❌ Ошибка удаления webhook:', error.message);
      return false;
    }
  }

  /**
   * Запуск сервера
   */
  async start() {
    try {
      // Проверка переменных окружения
      if (!process.env.TELEGRAM_BOT_TOKEN) {
        throw new Error('TELEGRAM_BOT_TOKEN не задан в .env');
      }

      if (!process.env.WEBHOOK_URL) {
        throw new Error('WEBHOOK_URL не задан в .env (например: https://api.medicod.ru/telegram-webhook)');
      }

      // Регистрируем webhook в Telegram
      await this.registerWebhook();

      // Запускаем Express сервер
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 Webhook сервер запущен на порту ${this.port}`);
        console.log(`📍 Webhook путь: ${this.webhookPath}`);
        console.log(`\n✅ Бот готов к приёму сообщений!\n`);
      });

      // Graceful shutdown
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());

    } catch (error) {
      console.error('❌ Ошибка запуска webhook сервера:', error.message);
      process.exit(1);
    }
  }

  /**
   * Остановка сервера
   */
  async stop() {
    console.log('\n\n👋 Остановка webhook сервера...');

    if (this.server) {
      this.server.close(() => {
        console.log('✅ HTTP сервер остановлен');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

export default WebhookServer;
