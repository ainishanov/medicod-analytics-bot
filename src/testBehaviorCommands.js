/**
 * Тестирование команд поведения пользователей
 */

import AnalyticsService from './analyticsService.js';
import dotenv from 'dotenv';

dotenv.config();

const analyticsService = new AnalyticsService(process.env.SERVICE_NAME || 'medicod-backend');

async function testBehaviorCommands() {
  try {
    console.log('🧪 Тестирование команд поведения пользователей\n');

    // Тест 1: Активные пользователи
    console.log('═'.repeat(80));
    console.log('📋 Тест 1: Активные пользователи');
    console.log('─'.repeat(80));
    const users = analyticsService.analyzeBehaviorUsers();
    if (users) {
      console.log('✅ Данные получены:');
      console.log(`   • Всего пользователей: ${users.total_users}`);
      console.log(`   • Новых: ${users.new_users}`);
      console.log(`   • Вернулось: ${users.returning_users}`);
      console.log(`   • Средняя длительность сессии: ${Math.round(users.avg_session_duration || 0)}s`);
    } else {
      console.log('⚠️  Данные недоступны');
    }

    // Тест 2: Воронка конверсии
    console.log('\n' + '═'.repeat(80));
    console.log('📋 Тест 2: Воронка конверсии');
    console.log('─'.repeat(80));
    const funnel = analyticsService.analyzeBehaviorFunnel();
    if (funnel) {
      console.log('✅ Данные получены:');
      console.log(`   • Всего сессий: ${funnel.total_sessions}`);
      console.log(`   • Загрузили анализ: ${funnel.uploaded_analysis} (${funnel.upload_rate}%)`);
      console.log(`   • Показан платёж: ${funnel.payment_triggered} (${funnel.payment_trigger_rate}%)`);
      console.log(`   • Оплатили: ${funnel.payment_completed} (${funnel.conversion_rate}%)`);
    } else {
      console.log('⚠️  Данные недоступны');
    }

    // Тест 3: Устройства
    console.log('\n' + '═'.repeat(80));
    console.log('📋 Тест 3: Статистика по устройствам');
    console.log('─'.repeat(80));
    const devices = analyticsService.analyzeBehaviorDevices();
    if (devices && devices.length > 0) {
      console.log('✅ Данные получены:');
      devices.forEach(device => {
        const convRate = device.session_count > 0
          ? ((device.conversions / device.session_count) * 100).toFixed(1)
          : 0;
        console.log(`   • ${device.device_type}: ${device.session_count} сессий (конверсия: ${convRate}%)`);
      });
    } else {
      console.log('⚠️  Данные недоступны');
    }

    // Тест 4: Источники трафика
    console.log('\n' + '═'.repeat(80));
    console.log('📋 Тест 4: Источники трафика');
    console.log('─'.repeat(80));
    const sources = analyticsService.analyzeBehaviorSources();
    if (sources && sources.length > 0) {
      console.log('✅ Данные получены:');
      sources.slice(0, 5).forEach(source => {
        console.log(`   • ${source.source}: ${source.sessions} сессий (конв: ${source.conversion_rate}%)`);
      });
    } else {
      console.log('⚠️  Данные недоступны');
    }

    // Тест 5: Популярные функции
    console.log('\n' + '═'.repeat(80));
    console.log('📋 Тест 5: Популярные функции');
    console.log('─'.repeat(80));
    const features = analyticsService.analyzeBehaviorFeatures(5);
    if (features && features.length > 0) {
      console.log('✅ Данные получены:');
      features.forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature.feature_name}: ${feature.total_usage} использований (${feature.success_rate}% успеха)`);
      });
    } else {
      console.log('⚠️  Данные недоступны');
    }

    // Тест 6: Retention
    console.log('\n' + '═'.repeat(80));
    console.log('📋 Тест 6: Retention (удержание)');
    console.log('─'.repeat(80));
    const retention = analyticsService.analyzeBehaviorRetention(3);
    if (retention && retention.length > 0) {
      console.log('✅ Данные получены:');
      retention.forEach(cohort => {
        const date = new Date(cohort.cohort_date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
        console.log(`   • ${date}: ${cohort.cohort_size} юзеров, Week 1: ${cohort.week1_retention_rate}%, Month 1: ${cohort.month1_retention_rate}%`);
      });
    } else {
      console.log('⚠️  Данные недоступны');
    }

    // Тест 7: Engagement по дням недели
    console.log('\n' + '═'.repeat(80));
    console.log('📋 Тест 7: Engagement по дням недели');
    console.log('─'.repeat(80));
    const engagement = analyticsService.analyzeBehaviorEngagement();
    if (engagement && engagement.length > 0) {
      console.log('✅ Данные получены:');
      engagement.forEach(day => {
        console.log(`   • ${day.day_name}: ${day.sessions} сессий, ${Math.round(day.avg_duration || 0)}s средняя длительность`);
      });
    } else {
      console.log('⚠️  Данные недоступны');
    }

    console.log('\n\n✅ Все тесты завершены!');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:', error);
    process.exit(1);
  }
}

// Запуск тестов
testBehaviorCommands();
