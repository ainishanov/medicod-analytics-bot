/**
 * Тест интеграции с базой данных
 */

import { getDatabaseInstance } from './database.js';

async function testDatabaseIntegration() {
  console.log('🧪 Тестирование интеграции с базой данных...\n');

  const db = getDatabaseInstance();

  if (!db || !db.isAvailable()) {
    console.error('❌ База данных недоступна');
    console.log('💡 Убедитесь что база данных существует в Medicod_Backend/data/medicod.db');
    return;
  }

  console.log('✅ База данных подключена\n');

  // Тест 1: Получить статистику за последние 7 дней
  console.log('📊 Тест 1: Статистика за последние 7 дней');
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 7);

  const stats = db.getPaymentStats({
    dateFrom: dateFrom.toISOString()
  });

  console.log('Результат:');
  console.log(`- Всего платежей: ${stats.total_count}`);
  console.log(`- Общая выручка: ${Math.round(stats.total_revenue)}₽`);
  console.log(`- Средний чек: ${Math.round(stats.avg_amount)}₽`);
  console.log(`- Уникальных пользователей: ${stats.unique_users}`);
  console.log('');

  // Тест 2: Получить платежи по дням
  console.log('📅 Тест 2: Разбивка по дням (последние 7 дней)');
  const dailyStats = db.getDailyStats({
    dateFrom: dateFrom.toISOString()
  });

  if (dailyStats.length > 0) {
    console.log('Результат:');
    dailyStats.slice(0, 5).forEach(day => {
      console.log(`${day.date}: ${day.count} платежей, ${Math.round(day.revenue)}₽`);
    });
    console.log('');
  } else {
    console.log('Нет данных за последние 7 дней');
    console.log('');
  }

  // Тест 3: Получить последние 5 платежей
  console.log('💰 Тест 3: Последние 5 платежей');
  const recentPayments = db.getPayments({ limit: 5 });

  if (recentPayments.length > 0) {
    console.log('Результат:');
    recentPayments.forEach(payment => {
      const date = new Date(payment.created_at).toLocaleString('ru-RU');
      console.log(`- ${date}: ${payment.amount}₽ (${payment.status})`);
    });
    console.log('');
  } else {
    console.log('Платежи не найдены');
    console.log('');
  }

  console.log('✅ Тестирование завершено!');
  db.close();
}

testDatabaseIntegration().catch(error => {
  console.error('❌ Ошибка тестирования:', error);
  process.exit(1);
});
