/**
 * Webhook Runner
 * Запускает Telegram бота в режиме webhooks вместо polling
 *
 * Использование:
 * npm run webhook
 */

import dotenv from 'dotenv';
import WebhookServer from './webhookServer.js';

dotenv.config();

async function startWebhookMode() {
  console.log('🚀 Запуск Medicod Analytics Bot (Webhook Mode)...\n');

  const server = new WebhookServer();
  await server.start();
}

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

// Запуск
startWebhookMode().catch(error => {
  console.error('❌ Ошибка запуска webhook сервера:', error.message);
  process.exit(1);
});
