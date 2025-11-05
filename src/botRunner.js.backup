/**
 * Bot Runner
 * Запускает интерактивный режим Telegram бота
 */

import dotenv from 'dotenv';
import BotCommandsHandler from './botCommands.js';

dotenv.config();

async function startBot() {
  console.log('🚀 Запуск Medicod Analytics Bot...\n');

  // Проверяем переменные окружения
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не задан в .env');
    process.exit(1);
  }

  if (!process.env.TELEGRAM_CHAT_ID) {
    console.error('❌ Ошибка: TELEGRAM_CHAT_ID не задан в .env');
    process.exit(1);
  }

  // Создаем обработчик команд
  const botHandler = new BotCommandsHandler();

  // Запускаем бота в режиме polling
  try {
    await botHandler.start();
  } catch (error) {
    console.error('❌ Критическая ошибка бота:', error.message);
    process.exit(1);
  }
}

// Обработка завершения процесса
process.on('SIGINT', () => {
  console.log('\n\n👋 Остановка бота...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Остановка бота...');
  process.exit(0);
});

// Запуск
startBot().catch(error => {
  console.error('❌ Ошибка запуска бота:', error.message);
  process.exit(1);
});
