/**
 * LTV/Churn команды для бота
 * Добавляются в botCommands.js в конец класса перед закрывающей скобкой
 */

// Вставить эти методы в класс BotCommandsHandler перед финальной закрывающей скобкой

async handleLTVCommand(chatId) {
  try {
    await this.telegram.sendMessage('💰 Расчёт Customer Lifetime Value...');

    const topCustomers = this.analytics.analyzeTopCustomers(10);
    const cohorts = this.analytics.analyzeCohortLTV();

    if (!topCustomers || !cohorts) {
      await this.telegram.sendMessage('⚠️ Данные о LTV недоступны (нет платежей)');
      return;
    }

    let msg = `💰 *Customer Lifetime Value (LTV)*\n\n`;

    // Топ 10 клиентов
    msg += `🏆 *Топ-10 клиентов по выручке:*\n\n`;
    topCustomers.slice(0, 10).forEach((c, i) => {
      const status = c.is_churned ? '⚠️' : '✅';
      msg += `${i + 1}. ${status} ${c.user_id.substring(0, 20)}...\n`;
      msg += `   Выручка: *${c.total_revenue} ₽* (${c.total_transactions} покупок)\n`;
      msg += `   Средний чек: ${c.average_order_value.toFixed(0)} ₽\n`;
      msg += `   Predicted LTV: ${c.predicted_ltv.toFixed(0)} ₽\n\n`;
    });

    // Когортный анализ
    msg += `\n📊 *LTV по когортам (месяц регистрации):*\n\n`;
    cohorts.slice(0, 6).forEach(cohort => {
      msg += `📅 *${cohort.cohort_month}*\n`;
      msg += `   Размер когорты: ${cohort.cohort_size}\n`;
      msg += `   Средний LTV: *${cohort.avg_ltv.toFixed(0)} ₽*\n`;
      msg += `   Средний чек: ${cohort.avg_order_value.toFixed(0)} ₽\n`;
      msg += `   Churn rate: ${cohort.churn_rate}%\n\n`;
    });

    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '📊 Churn', callback_data: '/churn' },
        { text: '🔥 Воронка', callback_data: '/detailfunnel' }
      ],
      [
        { text: '📈 Отчёт', callback_data: '/week' },
        { text: '❓ Помощь', callback_data: '/help' }
      ]
    ]);

    await this.telegram.sendMessage(msg, 'Markdown', keyboard);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await this.telegram.sendMessage('❌ Ошибка получения LTV: ' + error.message);
  }
}

async handleChurnCommand(chatId) {
  try {
    await this.telegram.sendMessage('📉 Расчёт Churn Rate...');

    const churnRate = this.analytics.analyzeChurnRate();
    const churnByCohort = this.analytics.analyzeChurnByCohort();

    if (!churnRate) {
      await this.telegram.sendMessage('⚠️ Данные о Churn недоступны');
      return;
    }

    let msg = `📉 *Churn Rate (Коэффициент оттока)*\n\n`;
    msg += `🔍 Churn = нет покупок больше 90 дней\n\n`;

    // Общий Churn Rate
    msg += `📊 *Общая статистика:*\n\n`;
    msg += `• Всего клиентов: *${churnRate.total_customers}*\n`;
    msg += `• Churned клиентов: ${churnRate.churned_customers}\n`;
    msg += `• Churn Rate: *${churnRate.churn_rate}%*\n\n`;
    msg += `• Средняя выручка от активных: ${churnRate.avg_revenue_active?.toFixed(0) || 0} ₽\n`;
    msg += `• Средняя выручка от churned: ${churnRate.avg_revenue_churned?.toFixed(0) || 0} ₽\n\n`;

    // Churn по когортам
    if (churnByCohort && churnByCohort.length > 0) {
      msg += `📅 *Churn Rate по когортам:*\n\n`;
      churnByCohort.slice(0, 6).forEach(cohort => {
        const emoji = cohort.churn_rate < 30 ? '✅' : cohort.churn_rate < 50 ? '⚠️' : '🚨';
        msg += `${emoji} *${cohort.cohort_month}*\n`;
        msg += `   Когорта: ${cohort.cohort_size} клиентов\n`;
        msg += `   Churned: ${cohort.churned} (${cohort.churn_rate}%)\n`;
        msg += `   Avg LTV: ${cohort.avg_ltv.toFixed(0)} ₽\n\n`;
      });
    }

    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '💰 LTV', callback_data: '/ltv' },
        { text: '👥 Топ клиенты', callback_data: '/topcustomers' }
      ],
      [
        { text: '📊 Отчёт', callback_data: '/week' },
        { text: '❓ Помощь', callback_data: '/help' }
      ]
    ]);

    await this.telegram.sendMessage(msg, 'Markdown', keyboard);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await this.telegram.sendMessage('❌ Ошибка получения Churn: ' + error.message);
  }
}

async handleDetailedFunnelCommand(chatId) {
  try {
    await this.telegram.sendMessage('🔥 Построение детальной воронки...');

    const funnel = this.analytics.analyzeDetailedFunnel();

    if (!funnel) {
      await this.telegram.sendMessage('⚠️ Данные воронки недоступны');
      return;
    }

    let msg = `🔥 *Детальная воронка конверсии (8 этапов)*\n\n`;

    // Этапы воронки
    const stages = [
      { name: 'Landing', count: funnel.step1_landing, emoji: '🌐' },
      { name: 'Viewed Info (>2 pages)', count: funnel.step2_viewed_info, emoji: '👀' },
      { name: 'Uploaded Analysis', count: funnel.step3_uploaded_analysis, emoji: '📤' },
      { name: 'Viewed Results', count: funnel.step4_viewed_results, emoji: '📊' },
      { name: 'Clicked Payment', count: funnel.step5_clicked_payment, emoji: '💳' },
      { name: 'Payment Page Opened', count: funnel.step6_payment_page, emoji: '💰' },
      { name: 'Payment Completed', count: funnel.step7_payment_completed, emoji: '✅' },
      { name: 'Returned User', count: funnel.step8_returned_user, emoji: '🔄' }
    ];

    stages.forEach((stage, i) => {
      const prev = i > 0 ? stages[i - 1].count : stage.count;
      const conversion = prev > 0 ? ((stage.count / prev) * 100).toFixed(1) : 0;
      const overallConv = funnel.step1_landing > 0 ? ((stage.count / funnel.step1_landing) * 100).toFixed(1) : 0;

      msg += `${stage.emoji} *${stage.name}*\n`;
      msg += `   ${stage.count} (${overallConv}% от начала`;
      if (i > 0) msg += `, ${conversion}% от пред.`;
      msg += `)\n\n`;
    });

    // Ключевые конверсии
    msg += `\n📈 *Ключевые конверсии:*\n\n`;
    msg += `• Landing → Upload: *${funnel.conv_landing_to_upload}%*\n`;
    msg += `• Upload → Payment Click: *${funnel.conv_upload_to_payment_click}%*\n`;
    msg += `• Payment Click → Completed: *${funnel.conv_payment_click_to_completed}%*\n`;
    msg += `• Overall Conversion: *${funnel.conv_overall}%*\n`;

    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '💰 LTV', callback_data: '/ltv' },
        { text: '📉 Churn', callback_data: '/churn' }
      ],
      [
        { text: '👥 Пользователи', callback_data: '/users' },
        { text: '❓ Помощь', callback_data: '/help' }
      ]
    ]);

    await this.telegram.sendMessage(msg, 'Markdown', keyboard);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await this.telegram.sendMessage('❌ Ошибка воронки: ' + error.message);
  }
}

async handleTopCustomersCommand(chatId) {
  try {
    await this.telegram.sendMessage('👥 Получение топ клиентов...');

    const topCustomers = this.analytics.analyzeTopCustomers(20);

    if (!topCustomers || topCustomers.length === 0) {
      await this.telegram.sendMessage('⚠️ Данные о клиентах недоступны');
      return;
    }

    let msg = `👑 *Топ-20 клиентов по выручке*\n\n`;

    topCustomers.forEach((c, i) => {
      const status = c.is_churned ? '⚠️ Churned' : '✅ Active';
      const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;

      msg += `${medal} ${status}\n`;
      msg += `   User: ${c.user_id.substring(0, 25)}...\n`;
      msg += `   Выручка: *${c.total_revenue.toFixed(0)} ₽*\n`;
      msg += `   Покупок: ${c.total_transactions}, Чек: ${c.average_order_value.toFixed(0)} ₽\n`;
      msg += `   LTV прогноз: ${c.predicted_ltv.toFixed(0)} ₽\n`;
      msg += `   Когорта: ${c.cohort_month}\n\n`;
    });

    const keyboard = this.telegram.createInlineKeyboard([
      [
        { text: '💰 LTV анализ', callback_data: '/ltv' },
        { text: '📉 Churn', callback_data: '/churn' }
      ],
      [
        { text: '📊 Отчёт', callback_data: '/week' },
        { text: '❓ Помощь', callback_data: '/help' }
      ]
    ]);

    await this.telegram.sendMessage(msg, 'Markdown', keyboard);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    await this.telegram.sendMessage('❌ Ошибка получения клиентов: ' + error.message);
  }
}
