/**
 * Bot Commands Handler
 * Обрабатывает команды от пользователя в Telegram
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import AnalyticsService from './analyticsService.js';
import TelegramService from './telegramService.js';
import AIAnalysisService from './aiAnalysisService.js';

dotenv.config();

class BotCommandsHandler {
  constructor() {
    this.telegram = new TelegramService(
      process.env.TELEGRAM_BOT_TOKEN,
      process.env.TELEGRAM_CHAT_ID
    );
    this.analytics = new AnalyticsService(process.env.SERVICE_NAME);
    this.aiService = new AIAnalysisService();
  }

  /**
   * Запускает бота в режиме polling
   */
  async start() {
    console.log('🤖 Запуск интерактивного бота...');

    let offset = 0;

    // Отправляем приветственное сообщение с кнопками
    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '📊 Отчет за неделю', callback_data: '/week' },
        { text: '📅 Вчера', callback_data: '/yesterday' }
      ],
      [
        { text: '📈 Сегодня', callback_data: '/today' },
        { text: '💡 Статус', callback_data: '/status' }
      ],
      [
        { text: '❓ Помощь', callback_data: '/help' }
      ]
    ]);

    await this.telegram.sendMessage(
      '🤖 *Бот запущен!*\n\n' +
      'Выбери команду ниже или используй /help',
      'Markdown',
      keyboard
    );

    // Polling loop
    while (true) {
      try {
        const updates = await this.getUpdates(offset);

        if (updates && updates.length > 0) {
          for (const update of updates) {
            offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }

        // Пауза между запросами
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('❌ Ошибка polling:', error.message);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Получает обновления от Telegram
   */
  async getUpdates(offset) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`,
        { method: 'GET' }
      );

      const data = await response.json();
      return data.ok ? data.result : [];
    } catch (error) {
      console.error('❌ Ошибка getUpdates:', error.message);
      return [];
    }
  }

  /**
   * Обрабатывает одно обновление
   */
  async handleUpdate(update) {
    // Обработка callback queries (нажатия на кнопки)
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    if (!update.message || !update.message.text) return;

    const message = update.message;
    const text = message.text.trim();
    const chatId = message.chat.id;

    console.log(`📨 Получено сообщение: ${text}`);

    // Проверяем что это сообщение от нужного пользователя
    if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID) {
      console.log('⚠️ Сообщение от неавторизованного пользователя');
      return;
    }

    // Обработка команд
    if (text.startsWith('/')) {
      await this.handleCommand(text, chatId);
    } else {
      // Если не команда, то это вопрос для AI
      await this.handleAskCommand(text, chatId);
    }
  }

  /**
   * Обрабатывает нажатия на inline кнопки
   */
  async handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;

    console.log(`🔘 Нажата кнопка: ${data}`);

    // Проверяем авторизацию
    if (chatId.toString() !== process.env.TELEGRAM_CHAT_ID) {
      await this.answerCallbackQuery(callbackId, 'Unauthorized');
      return;
    }

    // Подтверждаем получение callback
    await this.answerCallbackQuery(callbackId);

    // Обрабатываем как обычную команду
    await this.handleCommand(data, chatId);
  }

  /**
   * Отправляет ответ на callback query
   */
  async answerCallbackQuery(callbackId, text = null) {
    try {
      const body = { callback_query_id: callbackId };
      if (text) body.text = text;

      await fetch(`${this.telegram.apiUrl}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (error) {
      console.error('❌ Ошибка answerCallbackQuery:', error.message);
    }
  }

  /**
   * Обрабатывает команды
   */
  async handleCommand(text, chatId) {
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (command) {
      case '/start':
      case '/help':
        await this.handleHelpCommand(chatId);
        break;

      case '/yesterday':
      case '/вчера':
        await this.handleYesterdayCommand(chatId);
        break;

      case '/today':
      case '/сегодня':
        await this.handleTodayCommand(chatId);
        break;

      case '/week':
      case '/неделя':
        await this.handleWeekCommand(chatId);
        break;

      case '/ask':
        await this.handleAskCommand(args, chatId);
        break;

      case '/status':
        await this.handleStatusCommand(chatId);
        break;

      default:
        await this.telegram.sendMessage(
          `❓ Неизвестная команда: ${command}\n\nИспользуй /help для списка команд`
        );
    }
  }

  /**
   * /help - Список команд
   */
  async handleHelpCommand(chatId) {
    const helpText = `
📊 *Доступные команды Medicod Analytics Bot*

📈 *Аналитика:*
/yesterday или /вчера - Отчет за вчера
/today или /сегодня - Отчет за сегодня
/week или /неделя - Отчет за неделю

🤖 *AI Ассистент:*
/ask [вопрос] - Задать вопрос AI
Или просто напиши вопрос без команды

ℹ️ *Информация:*
/status - Статус системы
/help - Это сообщение

💡 *Примеры вопросов:*
• Сколько выручки за последние 3 дня?
• Какие ошибки были сегодня?
• Как растет средний чек?
• Что происходит с OCR функцией?

Используй кнопки ниже для быстрого доступа 👇
    `.trim();

    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '📊 Неделя', callback_data: '/week' },
        { text: '📅 Вчера', callback_data: '/yesterday' },
        { text: '📈 Сегодня', callback_data: '/today' }
      ],
      [
        { text: '💡 Статус', callback_data: '/status' },
        { text: '❓ Задать вопрос AI', callback_data: '/ask' }
      ]
    ]);

    await this.telegram.sendMessage(helpText, 'Markdown', keyboard);
  }

  /**
   * /yesterday - Отчет за вчера
   */
  async handleYesterdayCommand(chatId) {
    try {
      await this.telegram.sendMessage('📊 Генерация отчета за вчера...');

      const report = await this.analytics.generateDailyReport('1 day ago');
      const message = this.formatDailyReport(report, 'вчера');

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '📊 Неделя', callback_data: '/week' },
          { text: '📈 Сегодня', callback_data: '/today' }
        ],
        [
          { text: '💡 Статус', callback_data: '/status' }
        ]
      ]);

      await this.telegram.sendMessage(message, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка генерации отчета: ' + error.message);
    }
  }

  /**
   * /today - Отчет за сегодня
   */
  async handleTodayCommand(chatId) {
    try {
      await this.telegram.sendMessage('📊 Генерация отчета за сегодня...');

      const report = await this.analytics.generateDailyReport('today');
      const message = this.formatDailyReport(report, 'сегодня');

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '📊 Неделя', callback_data: '/week' },
          { text: '📅 Вчера', callback_data: '/yesterday' }
        ],
        [
          { text: '💡 Статус', callback_data: '/status' }
        ]
      ]);

      await this.telegram.sendMessage(message, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка генерации отчета: ' + error.message);
    }
  }

  /**
   * /week - Отчет за неделю
   */
  async handleWeekCommand(chatId) {
    try {
      await this.telegram.sendMessage('📊 Генерация недельного отчета...');

      const report = await this.analytics.generateWeeklyReport();
      const message = this.analytics.formatForTelegram(report);

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '📅 Вчера', callback_data: '/yesterday' },
          { text: '📈 Сегодня', callback_data: '/today' }
        ],
        [
          { text: '💡 Статус', callback_data: '/status' },
          { text: '❓ Задать вопрос', callback_data: '/ask Почему выручка изменилась?' }
        ]
      ]);

      await this.telegram.sendMessage(message, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка генерации отчета: ' + error.message);
    }
  }

  /**
   * /ask или просто вопрос - AI ассистент
   */
  async handleAskCommand(question, chatId) {
    if (!question || question.trim() === '') {
      await this.telegram.sendMessage(
        '❓ Задай вопрос после команды /ask или просто напиши вопрос без команды\n\n' +
        'Пример: /ask Сколько выручки за вчера?'
      );
      return;
    }

    try {
      await this.telegram.sendMessage('🤔 Думаю...');

      // Получаем свежие данные за последние 7 дней
      const report = await this.analytics.generateWeeklyReport();

      // Формируем контекст для AI
      const context = this.prepareContextForAI(report);

      // Задаем вопрос AI
      const answer = await this.aiService.askQuestion(question, context);

      if (answer) {
        await this.telegram.sendMessage(`🤖 *AI Ответ:*\n\n${answer}`);
      } else {
        await this.telegram.sendMessage('❌ AI не смог ответить на вопрос. Попробуй переформулировать.');
      }
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка обработки вопроса: ' + error.message);
    }
  }

  /**
   * /status - Статус системы
   */
  async handleStatusCommand(chatId) {
    try {
      await this.telegram.sendMessage('🔍 Проверка статуса системы...');

      const report = await this.analytics.generateWeeklyReport();

      let statusMsg = `📊 *Статус системы Medicod*\n\n`;
      statusMsg += `⏰ Проверка: ${new Date().toLocaleString('ru-RU')}\n\n`;

      // Платежи за сегодня
      const todayStats = await this.getTodayStats();
      statusMsg += `💰 *Сегодня:*\n`;
      statusMsg += `• Платежей: ${todayStats.payments}\n`;
      statusMsg += `• Выручка: ${todayStats.revenue}₽\n\n`;

      // Общая статистика за неделю
      statusMsg += `📈 *Неделя:*\n`;
      statusMsg += `• Платежей: ${report.payments.total}\n`;
      statusMsg += `• Выручка: ${report.payments.revenue}₽\n`;
      statusMsg += `• Ошибок: ${report.errors.total}\n\n`;

      // Статус AI
      const aiStatus = this.aiService.enabled ? '✅ Включен' : '❌ Отключен';
      statusMsg += `🤖 *AI:* ${aiStatus}\n\n`;

      // Аномалии
      if (report.anomalies && report.anomalies.length > 0) {
        const highSeverity = report.anomalies.filter(a => a.severity === 'high');
        if (highSeverity.length > 0) {
          statusMsg += `⚠️ *Критические проблемы:*\n`;
          highSeverity.forEach(a => {
            statusMsg += `• ${a.message}\n`;
          });
        } else {
          statusMsg += `✅ Критических проблем нет`;
        }
      } else {
        statusMsg += `✅ Система работает стабильно`;
      }

      await this.telegram.sendMessage(statusMsg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка проверки статуса: ' + error.message);
    }
  }

  /**
   * Форматирует дневной отчет
   */
  formatDailyReport(report, period) {
    const { payments, errors, features } = report;

    let msg = `📊 *Отчет за ${period}*\n`;
    msg += `_${new Date().toLocaleDateString('ru-RU')}_\n\n`;

    if (payments.total === 0) {
      msg += `ℹ️ Нет данных за этот период`;
      return msg;
    }

    msg += `💰 *Финансы:*\n`;
    msg += `• Платежей: *${payments.total}*\n`;
    msg += `• Выручка: *${payments.revenue}₽*\n`;
    msg += `• Средний чек: *${payments.avgCheck}₽*\n\n`;

    msg += `🤖 *Функции:*\n`;
    msg += `• OCR: ${features.ocr}\n`;
    msg += `• AI анализ: ${features.ai}\n\n`;

    if (errors.total > 0) {
      msg += `⚠️ *Ошибки:* ${errors.total}\n`;
      if (errors.webhook > 0) {
        msg += `• Webhook: ${errors.webhook}\n`;
      }
    } else {
      msg += `✅ Ошибок нет`;
    }

    return msg;
  }

  /**
   * Подготавливает контекст для AI
   */
  prepareContextForAI(report) {
    const { payments, errors, features } = report;

    return `
Данные за последнюю неделю Medicod Backend:

Финансы:
- Платежей: ${payments.total}
- Выручка: ${payments.revenue}₽
- Средний чек: ${payments.avgCheck}₽
- Динамика по дням: ${JSON.stringify(payments.byDay)}

Использование функций:
- OCR запросов: ${features.ocr}
- AI анализов: ${features.ai}

Ошибки:
- Всего ошибок: ${errors.total}
- Webhook ошибок: ${errors.webhook}

Дата: ${new Date().toLocaleDateString('ru-RU')}
    `.trim();
  }

  /**
   * Получает статистику за сегодня
   */
  async getTodayStats() {
    try {
      const report = await this.analytics.generateDailyReport('today');
      return {
        payments: report.payments.total,
        revenue: report.payments.revenue
      };
    } catch (error) {
      return { payments: 0, revenue: 0 };
    }
  }
}

export default BotCommandsHandler;
