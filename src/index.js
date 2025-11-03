/**
 * Medicod Analytics Bot
 * Автоматическая отправка еженедельных отчетов в Telegram
 */

import cron from 'node-cron';
import dotenv from 'dotenv';
import AnalyticsService from './analyticsService.js';
import TelegramService from './telegramService.js';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const serviceName = process.env.SERVICE_NAME || 'medicod-backend';

if (!botToken || !chatId) {
  console.error('❌ TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID должны быть установлены в .env');
  process.exit(1);
}

const analyticsService = new AnalyticsService(serviceName);
const telegramService = new TelegramService(botToken, chatId);

/**
 * Отправляет еженедельный отчет
 */
async function sendWeeklyReport() {
  try {
    console.log('\n📊 Запуск еженедельного отчета...');
    console.log(`⏰ ${new Date().toLocaleString('ru-RU')}\n`);

    // Проверяем бота
    const health = await telegramService.healthCheck();
    if (health.status !== 'ok') {
      throw new Error(`Telegram бот недоступен: ${health.message}`);
    }

    console.log(`✅ Telegram бот подключен: @${health.bot.username}`);

    // Генерируем отчет
    const report = await analyticsService.generateWeeklyReport();
    const message = analyticsService.formatForTelegram(report);

    // Отправляем в Telegram
    const result = await telegramService.sendMessage(message);

    if (result.success) {
      console.log('✅ Еженедельный отчет успешно отправлен\n');
    } else {
      console.error('❌ Не удалось отправить отчет:', result.error);
    }
  } catch (error) {
    console.error('❌ Ошибка отправки отчета:', error.message);
  }
}

// Запускаем планировщик
console.log('🚀 Medicod Analytics Bot запущен');
console.log(`📆 Расписание: Каждый понедельник в 10:00 МСК\n`);

// Каждый понедельник в 10:00 МСК
cron.schedule('0 10 * * 1', sendWeeklyReport, {
  timezone: 'Europe/Moscow'
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Получен SIGTERM, завершаем работу...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Получен SIGINT, завершаем работу...');
  process.exit(0);
});

console.log('✅ Планировщик активен. Ожидание расписания...\n');
