/**
 * Test Report с mock данными
 * Для тестирования на Windows (без journalctl)
 */

import dotenv from 'dotenv';
import TelegramService from './telegramService.js';
import AIAnalysisService from './aiAnalysisService.js';

dotenv.config();

// Mock данные для тестирования
const mockReport = {
  payments: {
    total: 107,
    revenue: 4165,
    avgCheck: 39,
    byDay: {
      'Nov 01': { count: 24, revenue: 936 },
      'Nov 02': { count: 5, revenue: 243 },
      'Nov 03': { count: 5, revenue: 246 },
      'Nov 04': { count: 10, revenue: 390 },
      'Nov 05': { count: 15, revenue: 585 },
      'Nov 06': { count: 20, revenue: 780 },
      'Nov 07': { count: 28, revenue: 985 }
    }
  },
  errors: {
    total: 110,
    webhook: 110
  },
  features: {
    ocr: 0,
    ai: 1
  }
};

async function sendTestReport() {
  console.log('📊 Тестовая отправка отчета с mock данными...\n');

  const telegram = new TelegramService(
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.TELEGRAM_CHAT_ID
  );
  const aiService = new AIAnalysisService();

  // Проверка подключения к Telegram
  console.log('🔍 Проверка Telegram бота...');
  const health = await telegram.healthCheck();
  if (health.status === 'ok') {
    console.log(`✅ Бот подключен: @${health.bot.username}\n`);
  } else {
    console.log(`❌ Ошибка подключения к Telegram боту: ${health.message}\n`);
    return;
  }

  console.log('📊 Генерация отчета...');

  // AI анализ
  console.log('🤖 Запрос AI анализа...');
  const aiAnalysis = await aiService.analyzeReport(mockReport);

  if (aiAnalysis) {
    console.log('✅ AI анализ получен\n');
    mockReport.aiAnalysis = aiAnalysis;
  } else {
    console.log('ℹ️  AI анализ отключен или недоступен\n');
  }

  // Детекция аномалий
  mockReport.anomalies = aiService.detectAnomalies(mockReport);

  // Форматирование отчета
  const message = formatForTelegram(mockReport);

  // Отправка
  const result = await telegram.sendMessage(message);

  if (result.success) {
    console.log('✅ Отчет успешно отправлен в Telegram!');
  } else {
    console.log('❌ Ошибка отправки отчета:', result.error);
  }
}

function formatForTelegram(report) {
  const { payments, errors, features, aiAnalysis, anomalies } = report;

  let msg = `📊 *Тестовый отчет Medicod Backend*\n`;
  msg += `_${new Date().toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })}_\n\n`;

  msg += `💰 *Финансовая статистика*\n`;
  msg += `• Платежей: *${payments.total}*\n`;
  msg += `• Выручка: *${payments.revenue}₽*\n`;
  msg += `• Средний чек: *${payments.avgCheck}₽*\n`;
  msg += `• Успешность: *100%*\n\n`;

  msg += `📅 *Динамика по дням*\n`;
  const days = Object.entries(payments.byDay).slice(-7);
  days.forEach(([day, data]) => {
    msg += `• ${day}: ${data.count} платежей, ${data.revenue}₽\n`;
  });
  msg += `\n`;

  msg += `🤖 *Использование функций*\n`;
  msg += `• OCR запросов: ${features.ocr}\n`;
  msg += `• AI анализ: ${features.ai}\n\n`;

  msg += `⚠️ *Ошибки*\n`;
  msg += `• Всего: ${errors.total}\n`;
  if (errors.webhook > 0) {
    msg += `• Webhook ошибки: ${errors.webhook}\n`;
  }
  msg += `\n`;

  const dailyAvg = Math.round(payments.revenue / 7);
  const monthlyProjection = dailyAvg * 30;
  msg += `🔮 *Прогноз*\n`;
  msg += `• Средняя выручка в день: ${dailyAvg}₽\n`;
  msg += `• Прогноз на месяц: *${monthlyProjection}₽*\n\n`;

  // Добавляем AI инсайты
  if (aiAnalysis) {
    msg += `🤖 *AI ИНСАЙТЫ*\n\n${aiAnalysis}\n\n`;
  }

  // Показываем статус системы
  const hasHighSeverityAnomalies = anomalies?.some(a => a.severity === 'high');
  if (hasHighSeverityAnomalies) {
    msg += `⚠️ _Требуется внимание_`;
  } else {
    msg += `✅ _Система работает стабильно_`;
  }

  msg += `\n\n_Это тестовый отчет с mock данными для демонстрации_`;

  return msg;
}

// Запуск
sendTestReport().catch(error => {
  console.error('❌ Ошибка:', error.message);
  process.exit(1);
});
