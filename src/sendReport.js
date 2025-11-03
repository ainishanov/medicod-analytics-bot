/**
 * Ручная отправка отчета (для тестирования)
 * Использование: npm run send-report
 */

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

async function main() {
  try {
    console.log('📊 Ручная отправка отчета...\n');

    // Проверяем бота
    console.log('🔍 Проверка Telegram бота...');
    const health = await telegramService.healthCheck();

    if (health.status !== 'ok') {
      throw new Error(`Telegram бот недоступен: ${health.message}`);
    }

    console.log(`✅ Бот подключен: @${health.bot.username}\n`);

    // Генерируем отчет
    console.log('📊 Генерация отчета...');
    const report = await analyticsService.generateWeeklyReport();
    const message = analyticsService.formatForTelegram(report);

    console.log('\n📝 Предпросмотр отчета:');
    console.log('─'.repeat(50));
    console.log(message);
    console.log('─'.repeat(50));
    console.log('');

    // Отправляем
    const result = await telegramService.sendMessage(message);

    if (result.success) {
      console.log('✅ Отчет успешно отправлен в Telegram!');
    } else {
      console.error('❌ Не удалось отправить отчет:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    process.exit(1);
  }
}

main();
