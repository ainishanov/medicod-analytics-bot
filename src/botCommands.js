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
        { text: '📊 Неделя', callback_data: '/week' },
        { text: '👥 Поведение', callback_data: '/behavior' }
      ],
      [
        { text: '🔥 Воронка', callback_data: '/funnel' },
        { text: '👥 Пользователи', callback_data: '/users' }
      ],
      [
        { text: '💡 Статус', callback_data: '/status' },
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

      // 👥 Команды поведения пользователей
      case '/users':
      case '/пользователи':
        await this.handleUsersCommand(chatId);
        break;

      case '/funnel':
      case '/воронка':
        await this.handleFunnelCommand(chatId);
        break;

      case '/devices':
      case '/устройства':
        await this.handleDevicesCommand(chatId);
        break;

      // case '/sources':
      // case '/источники':
      //   await this.handleSourcesCommand(chatId);
      //   break;

      case '/features':
      case '/функции':
        await this.handleFeaturesCommand(chatId);
        break;

      case '/retention':
        await this.handleRetentionCommand(chatId);
        break;

      case '/behavior':
      case '/поведение':
        await this.handleBehaviorCommand(chatId);
        break;

      // 💰 LTV и Churn команды
      case '/ltv':
        await this.handleLTVCommand(chatId);
        break;

      case '/churn':
        await this.handleChurnCommand(chatId);
        break;

      case '/detailfunnel':
      case '/воронка_детально':
        await this.handleDetailedFunnelCommand(chatId);
        break;

      case '/topcustomers':
      case '/топклиенты':
        await this.handleTopCustomersCommand(chatId);
        break;

      // 🧪 A/B Test команды
      case '/abtest':
      case '/ab':
        await this.handleABTestCommand(chatId);
        break;

      // 🤖 AI Analytics команды
      case '/ai':
      case '/aianalytics':
        await this.handleAIAnalyticsCommand(chatId);
        break;

      case '/aimodels':
      case '/models':
        await this.handleAIModelsCommand(chatId);
        break;

      case '/aicost':
      case '/cost':
        await this.handleAICostCommand(chatId);
        break;

      // 🏥 Health Score команда
      case '/health':
      case '/здоровье':
        await this.handleHealthScoreCommand(chatId);
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
📊 <b>Доступные команды Medicod Analytics Bot</b>

📈 <b>Аналитика:</b>
/yesterday или /вчера - Отчет за вчера
/today или /сегодня - Отчет за сегодня
/week или /неделя - Отчет за неделю

🏥 <b>Здоровье продукта:</b>
/health - Product Health Score (composite метрика)

👥 <b>Поведение пользователей:</b>
/users - Активные пользователи
/funnel - Воронка конверсии
/devices - Статистика по устройствам
/features - Популярные функции
/retention - Удержание пользователей
/behavior - Полный отчет поведения

🧪 <b>A/B Тестирование:</b>
/abtest - Статистика A/B тестов

🤖 <b>AI Аналитика:</b>
/ai - Общая AI аналитика (модели, токены, стоимость)
/aimodels - Статистика по моделям
/aicost - Анализ стоимости и прогноз

💬 <b>AI Ассистент:</b>
/ask &lt;вопрос&gt; - Задать вопрос AI
Или просто напиши вопрос без команды

ℹ️ <b>Информация:</b>
/status - Статус системы
/help - Это сообщение

💡 <b>Примеры вопросов:</b>
• Сколько выручки за последние 3 дня?
• Какие ошибки были сегодня?
• Как растет средний чек?
• Что происходит с OCR функцией?

Используй кнопки ниже для быстрого доступа 👇
    `.trim();

    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '📊 Неделя', callback_data: '/week' },
        { text: '🏥 Health Score', callback_data: '/health' }
      ],
      [
        { text: '📅 Вчера', callback_data: '/yesterday' },
        { text: '📈 Сегодня', callback_data: '/today' }
      ],
      [
        { text: '👥 Пользователи', callback_data: '/users' },
        { text: '🔥 Воронка', callback_data: '/funnel' }
      ],
      [
        { text: '📱 Устройства', callback_data: '/devices' }
      ],
      [
        { text: '⭐ Функции', callback_data: '/features' },
        { text: '📊 Retention', callback_data: '/retention' }
      ],
      [
        { text: '👥 Полный отчёт поведения', callback_data: '/behavior' }
      ],
      [
        { text: '🧪 A/B Тесты', callback_data: '/abtest' }
      ],
      [
        { text: '🤖 AI Аналитика', callback_data: '/ai' },
        { text: '📊 AI Модели', callback_data: '/aimodels' }
      ],
      [
        { text: '💡 Статус', callback_data: '/status' },
        { text: '❓ Задать вопрос AI', callback_data: '/ask' }
      ]
    ]);

    await this.telegram.sendMessage(helpText, 'HTML', keyboard);
  }

  /**
   * /yesterday - Отчет за вчера
   */
  async handleYesterdayCommand(chatId) {
    try {
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
      const report = await this.analytics.generateWeeklyReport();
      const message = this.analytics.formatForTelegram(report);

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '👥 Пользователи', callback_data: '/users' },
          { text: '🔥 Воронка', callback_data: '/funnel' }
        ],
        [
          { text: '📱 Устройства', callback_data: '/devices' }
        ],
        [
          { text: '📅 Вчера', callback_data: '/yesterday' },
          { text: '📈 Сегодня', callback_data: '/today' }
        ],
        [
          { text: '💡 Статус', callback_data: '/status' },
          { text: '❓ Задать вопрос', callback_data: '/ask Почему выручка изменилась?' }
        ]
      ]);

      await this.telegram.sendMessage(message, 'HTML', keyboard);
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

  /**
   * 👥 КОМАНДЫ ПОВЕДЕНИЯ ПОЛЬЗОВАТЕЛЕЙ
   */

  /**
   * /users - Активные пользователи
   */
  async handleUsersCommand(chatId) {
    try {
      await this.telegram.sendMessage('👥 Получение данных о пользователях...');

      const users = this.analytics.analyzeBehaviorUsers();

      if (!users) {
        await this.telegram.sendMessage('⚠️ Данные о поведении пользователей недоступны');
        return;
      }

      let msg = `👥 *Активные пользователи (последние 7 дней)*\n\n`;
      msg += `• Всего пользователей: *${users.total_users}*\n`;
      msg += `• Новых: ${users.new_users}\n`;
      msg += `• Вернулось: ${users.returning_users}\n`;
      msg += `• Returning rate: ${users.total_users > 0 ? ((users.returning_users / users.total_users) * 100).toFixed(1) : 0}%\n\n`;

      if (users.avg_session_duration) {
        const avgMinutes = Math.round(users.avg_session_duration / 60);
        msg += `⏱️ *Средняя сессия:*\n`;
        msg += `• Длительность: ${avgMinutes} мин\n`;
        msg += `• Просмотров страниц: ${(users.avg_page_views || 0).toFixed(1)}\n`;
        msg += `• Загрузок анализов: ${(users.avg_analyses_uploaded || 0).toFixed(1)}\n`;
      }

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '🔥 Воронка', callback_data: '/funnel' },
          { text: '👥 Полный отчёт', callback_data: '/behavior' }
        ],
        [
          { text: '📊 Неделя', callback_data: '/week' },
          { text: '❓ Помощь', callback_data: '/help' }
        ]
      ]);

      await this.telegram.sendMessage(msg, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения данных: ' + error.message);
    }
  }

  /**
   * /funnel - Воронка конверсии
   */
  async handleFunnelCommand(chatId) {
    try {
      await this.telegram.sendMessage('🔥 Получение воронки конверсии...');

      const funnel = this.analytics.analyzeBehaviorFunnel();

      if (!funnel) {
        await this.telegram.sendMessage('⚠️ Данные воронки недоступны');
        return;
      }

      let msg = `🔥 *Воронка конверсии (последние 7 дней)*\n\n`;
      msg += `📊 *Этапы:*\n`;
      msg += `1. Всего сессий: *${funnel.total_sessions}*\n`;
      msg += `2. Загрузили анализ: ${funnel.uploaded_analysis} (${funnel.upload_rate}%)\n`;
      msg += `3. Показан платёж: ${funnel.payment_triggered} (${funnel.payment_trigger_rate}%)\n`;
      msg += `4. Оплатили: ${funnel.payment_completed} (${funnel.conversion_rate}%)\n\n`;

      msg += `💡 *Инсайты:*\n`;
      if (funnel.upload_rate < 50) {
        msg += `⚠️ Низкий процент загрузки анализов\n`;
      }
      if (funnel.conversion_rate > 10) {
        msg += `✅ Отличная конверсия в оплату!\n`;
      } else if (funnel.conversion_rate > 5) {
        msg += `📈 Хорошая конверсия в оплату\n`;
      } else {
        msg += `⚠️ Низкая конверсия в оплату\n`;
      }

      await this.telegram.sendMessage(msg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения воронки: ' + error.message);
    }
  }

  /**
   * /devices - Статистика по устройствам
   */
  async handleDevicesCommand(chatId) {
    try {
      await this.telegram.sendMessage('📱 Получение статистики по устройствам...');

      const devices = this.analytics.analyzeBehaviorDevices();

      if (!devices || devices.length === 0) {
        await this.telegram.sendMessage('⚠️ Данные по устройствам недоступны');
        return;
      }

      let msg = `📱 *Статистика по устройствам*\n\n`;

      devices.forEach(device => {
        const convRate = device.session_count > 0
          ? ((device.conversions / device.session_count) * 100).toFixed(1)
          : 0;
        const avgDuration = Math.round((device.avg_duration || 0) / 60);

        msg += `*${device.device_type}*\n`;
        msg += `• Сессий: ${device.session_count}\n`;
        msg += `• Длительность: ${avgDuration} мин\n`;
        msg += `• Просмотров: ${(device.avg_page_views || 0).toFixed(1)}\n`;
        msg += `• Конверсия: ${convRate}%\n\n`;
      });

      await this.telegram.sendMessage(msg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения данных: ' + error.message);
    }
  }

  /**
   * /sources - Источники трафика
   */
  async handleSourcesCommand(chatId) {
    try {
      await this.telegram.sendMessage('🌐 Получение источников трафика...');

      const sources = this.analytics.analyzeBehaviorSources();

      if (!sources || sources.length === 0) {
        await this.telegram.sendMessage('⚠️ Данные по источникам недоступны');
        return;
      }

      let msg = `🌐 *Источники трафика*\n\n`;

      sources.slice(0, 10).forEach((source, i) => {
        msg += `${i + 1}. *${source.source}*`;
        if (source.utm_medium) msg += ` (${source.utm_medium})`;
        msg += `\n`;
        msg += `   • Сессий: ${source.sessions}\n`;
        msg += `   • Пользователей: ${source.unique_users}\n`;
        msg += `   • Конверсий: ${source.conversions} (${source.conversion_rate}%)\n\n`;
      });

      await this.telegram.sendMessage(msg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения источников: ' + error.message);
    }
  }

  /**
   * /features - Популярные функции
   */
  async handleFeaturesCommand(chatId) {
    try {
      await this.telegram.sendMessage('⭐ Получение популярных функций...');

      const features = this.analytics.analyzeBehaviorFeatures(10);

      if (!features || features.length === 0) {
        await this.telegram.sendMessage('⚠️ Данные по функциям недоступны');
        return;
      }

      let msg = `⭐ *Топ популярных функций*\n\n`;

      features.forEach((feature, i) => {
        msg += `${i + 1}. *${feature.feature_name}*\n`;
        msg += `   • Использований: ${feature.total_usage}\n`;
        msg += `   • Пользователей: ${feature.unique_users}\n`;
        msg += `   • Успешность: ${feature.success_rate}%\n\n`;
      });

      await this.telegram.sendMessage(msg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения функций: ' + error.message);
    }
  }

  /**
   * /retention - Удержание пользователей
   */
  async handleRetentionCommand(chatId) {
    try {
      await this.telegram.sendMessage('📊 Получение retention данных...');

      const retention = this.analytics.analyzeBehaviorRetention(5);

      if (!retention || retention.length === 0) {
        await this.telegram.sendMessage('⚠️ Данные retention недоступны');
        return;
      }

      let msg = `📊 *Удержание пользователей (Cohort Retention)*\n\n`;

      retention.forEach(cohort => {
        const date = new Date(cohort.cohort_date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
        msg += `*${date}* (${cohort.cohort_size} юзеров)\n`;
        msg += `• Week 1: ${cohort.week1_retention_rate}%\n`;
        msg += `• Month 1: ${cohort.month1_retention_rate}%\n\n`;
      });

      await this.telegram.sendMessage(msg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения retention: ' + error.message);
    }
  }

  /**
   * /behavior - Полный отчет поведения
   */
  async handleBehaviorCommand(chatId) {
    try {
      await this.telegram.sendMessage('👥 Генерация полного отчета поведения...');

      const users = this.analytics.analyzeBehaviorUsers();
      const funnel = this.analytics.analyzeBehaviorFunnel();
      const devices = this.analytics.analyzeBehaviorDevices();
      const sources = this.analytics.analyzeBehaviorSources();
      const features = this.analytics.analyzeBehaviorFeatures(5);
      const engagement = this.analytics.analyzeBehaviorEngagement();

      if (!users) {
        await this.telegram.sendMessage('⚠️ Данные о поведении недоступны');
        return;
      }

      let msg = `👥 *Полный отчет поведения пользователей*\n`;
      msg += `_Последние 7 дней_\n\n`;

      // Пользователи
      msg += `*Активные пользователи:*\n`;
      msg += `• Всего: ${users.total_users} (новых: ${users.new_users})\n`;
      msg += `• Среднее время сессии: ${Math.round(users.avg_session_duration / 60)} мин\n\n`;

      // Воронка
      if (funnel) {
        msg += `*Воронка:*\n`;
        msg += `• Сессий → Анализ: ${funnel.upload_rate}%\n`;
        msg += `• Анализ → Платёж: ${funnel.payment_trigger_rate}%\n`;
        msg += `• Итоговая конверсия: ${funnel.conversion_rate}%\n\n`;
      }

      // Устройства
      if (devices && devices.length > 0) {
        msg += `*Устройства (топ 3):*\n`;
        devices.slice(0, 3).forEach(d => {
          msg += `• ${d.device_type}: ${d.session_count} сессий\n`;
        });
        msg += `\n`;
      }

      // Источники
      if (sources && sources.length > 0) {
        msg += `*Источники (топ 3):*\n`;
        sources.slice(0, 3).forEach(s => {
          msg += `• ${s.source}: ${s.sessions} сессий (${s.conversion_rate}% конв)\n`;
        });
        msg += `\n`;
      }

      // Функции
      if (features && features.length > 0) {
        msg += `*Функции (топ 5):*\n`;
        features.forEach((f, i) => {
          msg += `${i + 1}. ${f.feature_name}: ${f.total_usage} раз\n`;
        });
        msg += `\n`;
      }

      // Лучший день недели
      if (engagement && engagement.length > 0) {
        const bestDay = engagement.reduce((max, day) =>
          day.sessions > (max.sessions || 0) ? day : max, {});
        msg += `*Engagement:*\n`;
        msg += `• Лучший день: ${bestDay.day_name} (${bestDay.sessions} сессий)\n`;
      }

      await this.telegram.sendMessage(msg);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка генерации отчета: ' + error.message);
    }
  }

  /**
   * 🧪 A/B TEST КОМАНДЫ
   */

  /**
   * /abtest - Статистика A/B тестов
   */
  async handleABTestCommand(chatId) {
    // Просто перенаправляем на статистику
    await this.handleABTestStatsCommand(chatId);
  }


  /**
   * Статистика A/B теста
   */
  async handleABTestStatsCommand(chatId) {
    try {
      await this.telegram.sendMessage('📊 Получение статистики A/B теста...');

      // Пытаемся получить статистику из базы данных
      const testId = 'landing_redesign_2025';
      let stats = null;

      try {
        // Если есть доступ к базе данных через analytics service
        if (this.analytics.db && this.analytics.db.db) {
          const query = `
            SELECT
              variant,
              COUNT(DISTINCT user_id) as users,
              COUNT(DISTINCT CASE WHEN converted = 1 AND conversion_event = 'start_analysis_click' THEN user_id END) as analysis_starts,
              COUNT(DISTINCT CASE WHEN converted = 1 AND conversion_event = 'payment_completed' THEN user_id END) as payments
            FROM ab_test_assignments
            WHERE test_id = ?
            GROUP BY variant
          `;

          stats = this.analytics.db.db.prepare(query).all(testId);
        }
      } catch (error) {
        console.log('⚠️ Не удалось получить статистику из БД:', error.message);
      }

      let msg = `📊 *Статистика A/B теста "Редизайн лендинга"*\n\n`;

      if (stats && stats.length > 0) {
        stats.forEach(variant => {
          const emoji = variant.variant === 'A' ? '🔵' : '🟢';
          const variantName = variant.variant === 'A' ? '(старый дизайн)' : '(новый дизайн)';

          // Рассчитываем проценты
          const analysisRate = variant.users > 0 ? ((variant.analysis_starts / variant.users) * 100).toFixed(1) : '0.0';
          const paymentRate = variant.analysis_starts > 0 ? ((variant.payments / variant.analysis_starts) * 100).toFixed(1) : '0.0';

          msg += `${emoji} *Вариант ${variant.variant}* ${variantName}\n`;
          msg += `• Посетителей: ${variant.users}\n`;
          msg += `• Начали анализ: ${variant.analysis_starts} (${analysisRate}%) ← основная метрика\n`;
          msg += `• Из них оплатили: ${variant.payments} (${paymentRate}%) ← доп. метрика\n\n`;
        });

        // Определяем победителя по основной метрике (начали анализ)
        if (stats.length === 2) {
          const variantA = stats.find(s => s.variant === 'A');
          const variantB = stats.find(s => s.variant === 'B');

          if (variantA && variantB) {
            const rateA = variantA.users > 0 ? (variantA.analysis_starts / variantA.users) * 100 : 0;
            const rateB = variantB.users > 0 ? (variantB.analysis_starts / variantB.users) * 100 : 0;
            const diff = rateB - rateA;

            if (Math.abs(diff) > 1) {
              msg += `🏆 *Лидирует:* Вариант ${diff > 0 ? 'B' : 'A'} (+${Math.abs(diff).toFixed(1)}% по клику)\n\n`;
            } else {
              msg += `⚖️ Варианты показывают примерно одинаковые результаты\n\n`;
            }
          }
        }

        msg += `💡 *Минимальные требования для завершения теста:*\n`;
        msg += `• Минимум 1000 посетителей на вариант\n`;
        msg += `• Минимум 100 кликов на вариант\n`;
        msg += `• Статистическая значимость p < 0.05\n\n`;
        msg += `📈 Для детального анализа используй SQL запросы к БД`;
      } else {
        msg += `⚠️ *Данные пока недоступны*\n\n`;
        msg += `Возможные причины:\n`;
        msg += `• Backend с A/B endpoints еще не задеплоен\n`;
        msg += `• Тест только что запущен, данных нет\n`;
        msg += `• База данных недоступна\n\n`;
        msg += `🔗 *Проверь:*\n`;
        msg += `1. Backend задеплоен: https://api.medicod.ru/health\n`;
        msg += `2. Endpoints доступны: POST /api/analytics/ab-test/assign\n`;
        msg += `3. База данных: SELECT * FROM ab_test_assignments;\n\n`;
        msg += `📖 Подробнее: AB_TEST_IMPLEMENTATION_COMPLETE.md`;
      }

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '🔄 Обновить статистику', callback_data: '/abtest' }
        ],
        [
          { text: '⬅️ Назад в меню', callback_data: '/help' }
        ]
      ]);

      await this.telegram.sendMessage(msg, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения статистики: ' + error.message);
    }
  }

  /**
   * 🤖 AI ANALYTICS КОМАНДЫ
   */

  /**
   * /ai - Общая AI аналитика
   */
  async handleAIAnalyticsCommand(chatId) {
    try {
      await this.telegram.sendMessage('🤖 Получение AI аналитики...');

      if (!this.analytics.db || !this.analytics.db.isAvailable()) {
        await this.telegram.sendMessage('⚠️ База данных недоступна');
        return;
      }

      // Импортируем AIAnalyticsQueries
      const AIAnalyticsQueries = await import('./aiAnalyticsQueries.js');

      // Получаем общую статистику
      const totalStats = AIAnalyticsQueries.getAITotalStats();

      if (!totalStats || totalStats.total_requests === 0) {
        await this.telegram.sendMessage('📊 AI аналитика пока недоступна.\n\nВозможно, еще не было запросов к AI.');
        return;
      }

      const formatCost = (cost) => {
        if (!cost || cost === 0) return 'FREE';
        return `$${cost.toFixed(6)}`;
      };

      let msg = `🤖 *AI АНАЛИТИКА*\n`;
      msg += `_Период: ${new Date(totalStats.first_request).toLocaleDateString('ru-RU')} - ${new Date(totalStats.last_request).toLocaleDateString('ru-RU')}_\n\n`;

      msg += `📊 *Общая статистика:*\n`;
      msg += `• Всего запросов: ${totalStats.total_requests}\n`;
      msg += `• Использовано моделей: ${totalStats.models_used}\n`;
      msg += `• Всего токенов: ${(totalStats.total_tokens || 0).toLocaleString()}\n`;
      msg += `• Общая стоимость: ${formatCost(totalStats.total_cost_usd)}\n`;
      msg += `• Среднее время: ${Math.round(totalStats.avg_response_time_ms || 0)}ms\n\n`;

      // Бесплатные vs платные
      const freeVsPaid = AIAnalyticsQueries.getFreeVsPaidRatio();
      if (freeVsPaid) {
        msg += `💰 *Стоимость:*\n`;
        msg += `• Бесплатных: ${freeVsPaid.free_requests} (${freeVsPaid.free_percentage}%)\n`;
        msg += `• Платных: ${freeVsPaid.paid_requests}\n`;
        if (freeVsPaid.total_cost > 0) {
          msg += `• Расходы: ${formatCost(freeVsPaid.total_cost)}\n`;
        }
        msg += `\n`;
      }

      // Прогноз
      const projection = AIAnalyticsQueries.getMonthlyProjection();
      if (projection && projection.requests_last_7_days > 0) {
        msg += `🔮 *Прогноз на месяц:*\n`;
        msg += `• Запросов: ~${projection.projected_monthly_requests}\n`;
        msg += `• Стоимость: ~${formatCost(projection.projected_monthly_cost)}\n`;
      }

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '📊 Модели', callback_data: '/aimodels' },
          { text: '💰 Стоимость', callback_data: '/aicost' }
        ],
        [
          { text: '🔄 Обновить', callback_data: '/ai' },
          { text: '⬅️ Назад', callback_data: '/help' }
        ]
      ]);

      await this.telegram.sendMessage(msg, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения AI аналитики: ' + error.message);
    }
  }

  /**
   * /aimodels - Статистика по моделям
   */
  async handleAIModelsCommand(chatId) {
    try {
      await this.telegram.sendMessage('📊 Получение статистики по AI моделям...');

      if (!this.analytics.db || !this.analytics.db.isAvailable()) {
        await this.telegram.sendMessage('⚠️ База данных недоступна');
        return;
      }

      const AIAnalyticsQueries = await import('./aiAnalyticsQueries.js');

      const modelStats = AIAnalyticsQueries.getAIModelUsageStats();

      if (!modelStats || modelStats.length === 0) {
        await this.telegram.sendMessage('📊 Статистика по моделям пока недоступна.');
        return;
      }

      const formatCost = (cost) => {
        if (!cost || cost === 0) return 'FREE';
        return `$${cost.toFixed(6)}`;
      };

      let msg = `📊 *СТАТИСТИКА ПО AI МОДЕЛЯМ*\n\n`;

      modelStats.forEach((model, i) => {
        msg += `${i + 1}. *${model.ai_model}*\n`;
        msg += `   • Запросов: ${model.requests_count}\n`;
        msg += `   • Токенов: ${(model.total_tokens || 0).toLocaleString()}\n`;
        msg += `   • Стоимость: ${formatCost(model.total_cost_usd)}\n`;
        msg += `   • Ср. время: ${Math.round(model.avg_response_time_ms || 0)}ms\n\n`;
      });

      // Сравнение стоимости
      const comparison = AIAnalyticsQueries.compareModelCosts();
      if (comparison && comparison.length > 0) {
        msg += `💰 *Стоимость за 1K токенов:*\n`;
        comparison.forEach(model => {
          if (model.cost_per_1k_tokens > 0) {
            msg += `• ${model.ai_model}: $${model.cost_per_1k_tokens.toFixed(6)}\n`;
          }
        });
      }

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '🤖 Общая аналитика', callback_data: '/ai' },
          { text: '💰 Стоимость', callback_data: '/aicost' }
        ],
        [
          { text: '🔄 Обновить', callback_data: '/aimodels' },
          { text: '⬅️ Назад', callback_data: '/help' }
        ]
      ]);

      await this.telegram.sendMessage(msg, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка получения статистики моделей: ' + error.message);
    }
  }

  /**
   * /aicost - Анализ стоимости AI
   */
  async handleAICostCommand(chatId) {
    try {
      await this.telegram.sendMessage('💰 Анализ стоимости AI...');

      if (!this.analytics.db || !this.analytics.db.isAvailable()) {
        await this.telegram.sendMessage('⚠️ База данных недоступна');
        return;
      }

      const AIAnalyticsQueries = await import('./aiAnalyticsQueries.js');

      const formatCost = (cost) => {
        if (!cost || cost === 0) return 'FREE';
        return `$${cost.toFixed(6)}`;
      };

      // Топ дорогих запросов
      const topCostly = AIAnalyticsQueries.getTopCostlyRequests(5);

      let msg = `💰 *АНАЛИЗ СТОИМОСТИ AI*\n\n`;

      // Общая стоимость
      const totalStats = AIAnalyticsQueries.getAITotalStats();
      if (totalStats) {
        msg += `📊 *Общие расходы:*\n`;
        msg += `• Всего: ${formatCost(totalStats.total_cost_usd)}\n`;
        msg += `• Средний запрос: ${formatCost(totalStats.avg_cost_per_request)}\n\n`;
      }

      // Прогноз
      const projection = AIAnalyticsQueries.getMonthlyProjection();
      if (projection && projection.requests_last_7_days > 0) {
        msg += `🔮 *Прогноз на месяц:*\n`;
        msg += `• За 7 дней: ${formatCost(projection.cost_last_7_days)}\n`;
        msg += `• Прогноз 30 дней: ${formatCost(projection.projected_monthly_cost)}\n\n`;
      }

      // Бесплатные vs платные
      const freeVsPaid = AIAnalyticsQueries.getFreeVsPaidRatio();
      if (freeVsPaid) {
        msg += `🆓 *Распределение:*\n`;
        msg += `• Бесплатные: ${freeVsPaid.free_percentage}%\n`;
        msg += `• Платные: ${(100 - freeVsPaid.free_percentage).toFixed(2)}%\n\n`;
      }

      // Топ дорогих запросов
      if (topCostly && topCostly.length > 0) {
        msg += `💸 *Топ-5 дорогих запросов:*\n`;
        topCostly.forEach((req, i) => {
          const date = new Date(req.created_at).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
          msg += `${i + 1}. ${req.ai_model}: ${formatCost(req.ai_cost_usd)} (${date})\n`;
        });
      }

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '🤖 Общая аналитика', callback_data: '/ai' },
          { text: '📊 Модели', callback_data: '/aimodels' }
        ],
        [
          { text: '🔄 Обновить', callback_data: '/aicost' },
          { text: '⬅️ Назад', callback_data: '/help' }
        ]
      ]);

      await this.telegram.sendMessage(msg, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка анализа стоимости: ' + error.message);
    }
  }

  /**
   * /health - Product Health Score
   */
  async handleHealthScoreCommand(chatId) {
    try {
      await this.telegram.sendMessage('🏥 Расчет Product Health Score...');

      const healthScore = await this.analytics.calculateProductHealth();

      if (!healthScore) {
        await this.telegram.sendMessage('⚠️ Health Score недоступен (требуется БД с данными поведения)');
        return;
      }

      const { overall, breakdown, grade, status } = healthScore;

      // Определяем эмодзи для grade
      const gradeEmoji = overall >= 80 ? '🟢' : overall >= 60 ? '🟡' : '🔴';

      let msg = `🏥 *PRODUCT HEALTH SCORE*\n\n`;
      msg += `${gradeEmoji} *Overall: ${overall}/100* \\(Grade: ${grade}\\)\n`;
      msg += `Status: ${status}\n\n`;

      msg += `📊 *Breakdown:*\n`;
      msg += `• Activation: ${breakdown.activation}% \\(30%\\)\n`;
      msg += `• Retention: ${breakdown.retention}% \\(30%\\)\n`;
      msg += `• Revenue: ${breakdown.revenue}% \\(25%\\)\n`;
      msg += `• Quality: ${breakdown.quality}% \\(15%\\)\n\n`;

      // Интерпретация
      if (overall >= 80) {
        msg += `✅ *Продукт в отличном состоянии!*\n`;
        msg += `Все ключевые метрики выше целевых значений\\.`;
      } else if (overall >= 60) {
        msg += `💡 *Продукт работает хорошо, но есть потенциал\\.*\n`;
        // Находим слабое звено
        const weakest = Object.entries(breakdown)
          .sort((a, b) => a[1] - b[1])[0];
        msg += `Фокус на улучшение: ${weakest[0]} \\(${weakest[1]}%\\)`;
      } else if (overall >= 40) {
        msg += `⚠️ *Требуются улучшения\\.*\n`;
        msg += `Необходимо повысить ключевые метрики\\.`;
      } else {
        msg += `🚨 *Критическое состояние!*\n`;
        msg += `Требуется немедленное вмешательство\\.`;
      }

      const keyboard = this.telegram.createInlineKeyboard([
        [
          { text: '📊 Неделя', callback_data: '/week' },
          { text: '👥 Пользователи', callback_data: '/users' }
        ],
        [
          { text: '🔄 Обновить', callback_data: '/health' },
          { text: '⬅️ Назад', callback_data: '/help' }
        ]
      ]);

      await this.telegram.sendMessage(msg, 'Markdown', keyboard);
    } catch (error) {
      console.error('❌ Ошибка:', error);
      await this.telegram.sendMessage('❌ Ошибка расчета Health Score: ' + error.message);
    }
  }
}

export default BotCommandsHandler;
