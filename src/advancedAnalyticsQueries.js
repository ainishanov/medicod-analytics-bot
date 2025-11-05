/**
 * Advanced Analytics Queries
 * SQL запросы для расширенной аналитики: LTV, Churn Rate, детальная воронка
 */

import { getDatabaseInstance } from './database.js';

const db = getDatabaseInstance();

/**
 * Расчёт Customer Lifetime Value (LTV)
 */
export function calculateLTV(options = {}) {
  const { userId, cohortMonth, limit = 100 } = options;

  let sql = `
    SELECT
      user_id,
      total_revenue,
      total_transactions,
      average_order_value,
      customer_lifetime_days,
      first_purchase_date,
      last_purchase_date,
      ltv_30_days,
      ltv_90_days,
      ltv_365_days,
      predicted_ltv,
      cohort_month,
      is_active,
      is_churned,
      days_since_last_purchase
    FROM customer_lifetime_value
    WHERE 1=1
  `;

  const params = [];

  if (userId) {
    sql += ` AND user_id = ?`;
    params.push(userId);
  }

  if (cohortMonth) {
    sql += ` AND cohort_month = ?`;
    params.push(cohortMonth);
  }

  sql += ` ORDER BY total_revenue DESC LIMIT ?`;
  params.push(limit);

  return db.db.prepare(sql).all(...params);
}

/**
 * Обновление или создание LTV записи для пользователя
 */
export function upsertUserLTV(userId) {
  // Получаем данные о платежах пользователя
  const payments = db.db.prepare(`
    SELECT
      COUNT(*) as total_transactions,
      SUM(amount) as total_revenue,
      AVG(amount) as average_order_value,
      MIN(completed_at) as first_purchase_date,
      MAX(completed_at) as last_purchase_date,
      JULIANDAY('now') - JULIANDAY(MAX(completed_at)) as days_since_last_purchase
    FROM payment_history
    WHERE user_id = ? AND status = 'succeeded'
  `).get(userId);

  if (!payments || payments.total_transactions === 0) {
    return null; // Нет платежей
  }

  // Получаем сессии пользователя
  const sessions = db.db.prepare(`
    SELECT
      COUNT(*) as total_sessions,
      SUM(analyses_uploaded) as total_analyses,
      SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) as sessions_with_purchase
    FROM user_sessions
    WHERE user_id = ?
  `).get(userId);

  // Рассчитываем LTV за разные периоды
  const ltv30 = db.db.prepare(`
    SELECT SUM(amount) as revenue
    FROM payment_history
    WHERE user_id = ?
      AND status = 'succeeded'
      AND completed_at >= datetime('now', '-30 days')
  `).get(userId);

  const ltv90 = db.db.prepare(`
    SELECT SUM(amount) as revenue
    FROM payment_history
    WHERE user_id = ?
      AND status = 'succeeded'
      AND completed_at >= datetime('now', '-90 days')
  `).get(userId);

  const ltv365 = db.db.prepare(`
    SELECT SUM(amount) as revenue
    FROM payment_history
    WHERE user_id = ?
      AND status = 'succeeded'
      AND completed_at >= datetime('now', '-365 days')
  `).get(userId);

  // Определяем когорту (месяц первой покупки)
  const cohortMonth = payments.first_purchase_date
    ? payments.first_purchase_date.substring(0, 7) // YYYY-MM
    : null;

  const cohortWeek = payments.first_purchase_date
    ? payments.first_purchase_date.substring(0, 10) // YYYY-MM-DD
    : null;

  // Lifetime в днях
  const lifetimeDays = payments.first_purchase_date && payments.last_purchase_date
    ? Math.floor(
        (new Date(payments.last_purchase_date) - new Date(payments.first_purchase_date)) /
        (1000 * 60 * 60 * 24)
      )
    : 0;

  // Прогнозируемый LTV (простая формула: средний чек * среднее количество покупок в год)
  const avgTransactionsPerYear = lifetimeDays > 0
    ? (payments.total_transactions / lifetimeDays) * 365
    : payments.total_transactions;

  const predictedLTV = payments.average_order_value * avgTransactionsPerYear;

  // Churn logic: если не было покупок больше 90 дней
  const isChurned = payments.days_since_last_purchase > 90 ? 1 : 0;
  const churnDate = isChurned && payments.last_purchase_date
    ? new Date(new Date(payments.last_purchase_date).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Upsert
  const stmt = db.db.prepare(`
    INSERT INTO customer_lifetime_value (
      id, user_id,
      total_revenue, total_transactions, average_order_value,
      first_purchase_date, last_purchase_date, customer_lifetime_days,
      total_sessions, total_analyses, sessions_with_purchase,
      ltv_30_days, ltv_90_days, ltv_365_days, predicted_ltv,
      cohort_month, cohort_week,
      is_active, is_churned, churn_date, days_since_last_purchase,
      updated_at
    ) VALUES (
      ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      datetime('now')
    )
    ON CONFLICT(user_id) DO UPDATE SET
      total_revenue = excluded.total_revenue,
      total_transactions = excluded.total_transactions,
      average_order_value = excluded.average_order_value,
      last_purchase_date = excluded.last_purchase_date,
      customer_lifetime_days = excluded.customer_lifetime_days,
      total_sessions = excluded.total_sessions,
      total_analyses = excluded.total_analyses,
      sessions_with_purchase = excluded.sessions_with_purchase,
      ltv_30_days = excluded.ltv_30_days,
      ltv_90_days = excluded.ltv_90_days,
      ltv_365_days = excluded.ltv_365_days,
      predicted_ltv = excluded.predicted_ltv,
      is_active = excluded.is_active,
      is_churned = excluded.is_churned,
      churn_date = excluded.churn_date,
      days_since_last_purchase = excluded.days_since_last_purchase,
      updated_at = datetime('now')
  `);

  stmt.run(
    userId,
    userId,
    payments.total_revenue || 0,
    payments.total_transactions || 0,
    payments.average_order_value || 0,
    payments.first_purchase_date,
    payments.last_purchase_date,
    lifetimeDays,
    sessions.total_sessions || 0,
    sessions.total_analyses || 0,
    sessions.sessions_with_purchase || 0,
    ltv30.revenue || 0,
    ltv90.revenue || 0,
    ltv365.revenue || 0,
    predictedLTV || 0,
    cohortMonth,
    cohortWeek,
    isChurned ? 0 : 1, // is_active
    isChurned,
    churnDate,
    payments.days_since_last_purchase || 0
  );

  return true;
}

/**
 * Расчёт Churn Rate
 */
export function getChurnRate(options = {}) {
  const { cohortMonth, period = 90 } = options;

  let sql = `
    SELECT
      COUNT(*) as total_customers,
      SUM(CASE WHEN is_churned = 1 THEN 1 ELSE 0 END) as churned_customers,
      ROUND(SUM(CASE WHEN is_churned = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as churn_rate,
      AVG(days_since_last_purchase) as avg_days_since_purchase,
      AVG(CASE WHEN is_churned = 0 THEN total_revenue ELSE 0 END) as avg_revenue_active,
      AVG(CASE WHEN is_churned = 1 THEN total_revenue ELSE 0 END) as avg_revenue_churned
    FROM customer_lifetime_value
    WHERE 1=1
  `;

  const params = [];

  if (cohortMonth) {
    sql += ` AND cohort_month = ?`;
    params.push(cohortMonth);
  }

  return db.db.prepare(sql).get(...params);
}

/**
 * Churn Rate по когортам
 */
export function getChurnRateByCohort() {
  const sql = `
    SELECT
      cohort_month,
      COUNT(*) as cohort_size,
      SUM(CASE WHEN is_churned = 1 THEN 1 ELSE 0 END) as churned,
      ROUND(SUM(CASE WHEN is_churned = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as churn_rate,
      AVG(total_revenue) as avg_ltv,
      AVG(customer_lifetime_days) as avg_lifetime_days
    FROM customer_lifetime_value
    WHERE cohort_month IS NOT NULL
    GROUP BY cohort_month
    ORDER BY cohort_month DESC
    LIMIT 12
  `;

  return db.db.prepare(sql).all();
}

/**
 * Детальная воронка конверсии по этапам
 */
export function getDetailedFunnel(options = {}) {
  const { dateFrom, dateTo } = options;

  const from = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = dateTo || new Date().toISOString();

  const sql = `
    SELECT
      -- Этап 1: Landing
      COUNT(*) as step1_landing,

      -- Этап 2: Просмотр информации (хотя бы 2 page views)
      SUM(CASE WHEN page_views >= 2 THEN 1 ELSE 0 END) as step2_viewed_info,

      -- Этап 3: Загрузка анализа
      SUM(CASE WHEN analyses_uploaded > 0 THEN 1 ELSE 0 END) as step3_uploaded_analysis,

      -- Этап 4: Просмотр результатов (после загрузки + дополнительные page views)
      SUM(CASE WHEN analyses_uploaded > 0 AND page_views > 3 THEN 1 ELSE 0 END) as step4_viewed_results,

      -- Этап 5: Клик на оплату (payment_triggered)
      SUM(CASE WHEN payment_triggered = 1 THEN 1 ELSE 0 END) as step5_clicked_payment,

      -- Этап 6: Открыта страница оплаты (можем трекать отдельно)
      SUM(CASE WHEN payment_triggered = 1 THEN 1 ELSE 0 END) as step6_payment_page,

      -- Этап 7: Оплата завершена
      SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) as step7_payment_completed,

      -- Этап 8: Повторный визит (returning_user)
      SUM(CASE WHEN returning_user = 1 THEN 1 ELSE 0 END) as step8_returned_user,

      -- Конверсии между этапами
      ROUND(SUM(CASE WHEN page_views >= 2 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as conv_landing_to_viewed,
      ROUND(SUM(CASE WHEN analyses_uploaded > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as conv_landing_to_upload,
      ROUND(SUM(CASE WHEN payment_triggered = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN analyses_uploaded > 0 THEN 1 ELSE 0 END), 0), 2) as conv_upload_to_payment_click,
      ROUND(SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(SUM(CASE WHEN payment_triggered = 1 THEN 1 ELSE 0 END), 0), 2) as conv_payment_click_to_completed,
      ROUND(SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as conv_overall
    FROM user_sessions
    WHERE created_at >= ? AND created_at <= ?
  `;

  return db.db.prepare(sql).get(from, to);
}

/**
 * Средний чек и динамика
 */
export function getAverageOrderValue(options = {}) {
  const { dateFrom, dateTo, groupBy = 'day' } = options;

  const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = dateTo || new Date().toISOString();

  let dateFormat;
  switch (groupBy) {
    case 'day':
      dateFormat = '%Y-%m-%d';
      break;
    case 'week':
      dateFormat = '%Y-W%W';
      break;
    case 'month':
      dateFormat = '%Y-%m';
      break;
    default:
      dateFormat = '%Y-%m-%d';
  }

  const sql = `
    SELECT
      strftime('${dateFormat}', completed_at) as period,
      COUNT(*) as transactions,
      SUM(amount) as total_revenue,
      AVG(amount) as average_order_value,
      MIN(amount) as min_order,
      MAX(amount) as max_order
    FROM payment_history
    WHERE status = 'succeeded'
      AND completed_at >= ?
      AND completed_at <= ?
    GROUP BY period
    ORDER BY period DESC
  `;

  return db.db.prepare(sql).all(from, to);
}

/**
 * Топ клиентов по LTV
 */
export function getTopCustomersByLTV(limit = 20) {
  const sql = `
    SELECT
      user_id,
      total_revenue,
      total_transactions,
      average_order_value,
      predicted_ltv,
      customer_lifetime_days,
      cohort_month,
      is_active,
      is_churned
    FROM customer_lifetime_value
    ORDER BY total_revenue DESC
    LIMIT ?
  `;

  return db.db.prepare(sql).all(limit);
}

/**
 * Когортный анализ LTV
 */
export function getCohortLTVAnalysis() {
  const sql = `
    SELECT
      cohort_month,
      COUNT(*) as cohort_size,
      SUM(total_revenue) as total_revenue,
      AVG(total_revenue) as avg_ltv,
      AVG(total_transactions) as avg_transactions,
      AVG(average_order_value) as avg_order_value,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_customers,
      SUM(CASE WHEN is_churned = 1 THEN 1 ELSE 0 END) as churned_customers,
      ROUND(SUM(CASE WHEN is_churned = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as churn_rate
    FROM customer_lifetime_value
    WHERE cohort_month IS NOT NULL
    GROUP BY cohort_month
    ORDER BY cohort_month DESC
    LIMIT 12
  `;

  return db.db.prepare(sql).all();
}

export default {
  calculateLTV,
  upsertUserLTV,
  getChurnRate,
  getChurnRateByCohort,
  getDetailedFunnel,
  getAverageOrderValue,
  getTopCustomersByLTV,
  getCohortLTVAnalysis
};
