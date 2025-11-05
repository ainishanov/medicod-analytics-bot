/**
 * Webhook Management Utility
 * Утилита для управления webhook Telegram бота
 *
 * Использование:
 * node src/manageWebhook.js info      - Информация о текущем webhook
 * node src/manageWebhook.js set       - Установить webhook
 * node src/manageWebhook.js delete    - Удалить webhook (переход на polling)
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

async function getWebhookInfo() {
  console.log('📊 Получение информации о webhook...\n');

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`
    );
    const data = await response.json();

    if (!data.ok) {
      throw new Error(`API error: ${data.description}`);
    }

    const info = data.result;

    console.log('═══════════════════════════════════════');
    console.log('📊 WEBHOOK ИНФОРМАЦИЯ');
    console.log('═══════════════════════════════════════');
    console.log(`URL:                  ${info.url || '❌ не установлен'}`);
    console.log(`Статус:               ${info.url ? '✅ активен' : '❌ не активен (polling режим)'}`);
    console.log(`Ожидающих обновлений: ${info.pending_update_count || 0}`);
    console.log(`Максимум подключений: ${info.max_connections || 40}`);
    console.log(`Разрешённые обновл.:  ${(info.allowed_updates || []).join(', ') || 'все'}`);

    if (info.last_error_date) {
      const errorDate = new Date(info.last_error_date * 1000);
      console.log(`\n⚠️  ПОСЛЕДНЯЯ ОШИБКА:`);
      console.log(`   Время:   ${errorDate.toLocaleString('ru-RU')}`);
      console.log(`   Сообщение: ${info.last_error_message || 'нет'}`);
    }

    if (info.last_synchronization_error_date) {
      const syncDate = new Date(info.last_synchronization_error_date * 1000);
      console.log(`\n⚠️  ОШИБКА СИНХРОНИЗАЦИИ:`);
      console.log(`   Время: ${syncDate.toLocaleString('ru-RU')}`);
    }

    console.log('═══════════════════════════════════════\n');

    return info;
  } catch (error) {
    console.error('❌ Ошибка получения информации:', error.message);
    process.exit(1);
  }
}

async function setWebhook() {
  if (!WEBHOOK_URL) {
    console.error('❌ Ошибка: WEBHOOK_URL не задан в .env');
    console.log('\nПример:');
    console.log('WEBHOOK_URL=https://api.medicod.ru/telegram-webhook');
    process.exit(1);
  }

  console.log(`🔗 Установка webhook: ${WEBHOOK_URL}\n`);

  try {
    const params = {
      url: WEBHOOK_URL,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
      max_connections: 40,
    };

    if (WEBHOOK_SECRET) {
      params.secret_token = WEBHOOK_SECRET;
      console.log('🔐 Webhook будет защищён секретным токеном');
    } else {
      console.warn('⚠️  WEBHOOK_SECRET не задан - рекомендуется для безопасности');
    }

    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`API error: ${data.description || 'Unknown error'}`);
    }

    console.log('\n✅ Webhook успешно установлен!\n');

    // Показываем информацию
    await getWebhookInfo();

    console.log('💡 Что дальше:');
    console.log('   1. Запустите webhook сервер: npm run webhook');
    console.log('   2. Убедитесь что сервер доступен по HTTPS');
    console.log('   3. Telegram начнёт отправлять обновления на webhook\n');

  } catch (error) {
    console.error('❌ Ошибка установки webhook:', error.message);
    process.exit(1);
  }
}

async function deleteWebhook() {
  console.log('🗑️  Удаление webhook...\n');

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drop_pending_updates: true })
      }
    );

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`API error: ${data.description}`);
    }

    console.log('✅ Webhook удалён!\n');
    console.log('💡 Теперь можно запустить бота в polling режиме:');
    console.log('   npm run bot\n');

    await getWebhookInfo();

  } catch (error) {
    console.error('❌ Ошибка удаления webhook:', error.message);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║          Telegram Webhook Management Utility                 ║
╚══════════════════════════════════════════════════════════════╝

ИСПОЛЬЗОВАНИЕ:
  node src/manageWebhook.js <команда>

КОМАНДЫ:
  info      - Показать информацию о текущем webhook
  set       - Установить webhook (переход с polling на webhooks)
  delete    - Удалить webhook (переход с webhooks на polling)
  help      - Показать эту справку

ПРИМЕРЫ:
  # Проверить текущий статус
  node src/manageWebhook.js info

  # Установить webhook
  node src/manageWebhook.js set

  # Удалить webhook и вернуться к polling
  node src/manageWebhook.js delete

ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ (.env):
  TELEGRAM_BOT_TOKEN    - Токен бота (обязательно)
  WEBHOOK_URL          - URL для webhook (например: https://api.medicod.ru/telegram-webhook)
  WEBHOOK_SECRET       - Секретный токен для безопасности (опционально, но рекомендуется)
  WEBHOOK_PORT         - Порт для webhook сервера (по умолчанию: 8443)

ТРЕБОВАНИЯ TELEGRAM:
  ✅ URL должен использовать HTTPS (не HTTP)
  ✅ Сертификат должен быть валидным
  ✅ Порт должен быть: 443, 80, 88, или 8443
  ✅ URL не должен содержать Query Parameters (только path)

ПОЛЕЗНЫЕ ССЫЛКИ:
  📖 Документация: https://core.telegram.org/bots/api#setwebhook
  📖 Webhooks Guide: https://core.telegram.org/bots/webhooks
`);
}

// Обработка команд
async function main() {
  if (!BOT_TOKEN) {
    console.error('❌ Ошибка: TELEGRAM_BOT_TOKEN не задан в .env');
    process.exit(1);
  }

  const command = process.argv[2];

  switch (command) {
    case 'info':
      await getWebhookInfo();
      break;

    case 'set':
      await setWebhook();
      break;

    case 'delete':
    case 'remove':
      await deleteWebhook();
      break;

    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;

    default:
      console.error('❌ Неизвестная команда:', command || '(не указана)');
      console.log('\nИспользуйте: node src/manageWebhook.js help\n');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});
