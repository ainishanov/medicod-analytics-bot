/**
 * Behavior Analytics Queries
 * SQL запросы для аналитики поведения пользователей
 */

import { getDatabaseInstance } from './database.js';

const db = getDatabaseInstance();

/**
 * Фильтр для исключения localhost/тестовых пользователей
 */
const EXCLUDE_LOCALHOST = `
  AND user_id NOT LIKE 'anonymous_::1%'
  AND user_id NOT LIKE 'anonymous_::ffff:127.0.0.1%'
  AND user_id NOT LIKE 'anonymous_127.0.0.1%'
  AND user_id NOT LIKE 'test_%'
`;

/**
 * Получение активных пользователей
 */
export function getActiveUsers(options = {}) {
  const { dateFrom, dateTo } = options;

  const sql = `
    SELECT
      COUNT(DISTINCT user_id) as total_users,
      COUNT(DISTINCT CASE WHEN returning_user = 0 THEN user_id END) as new_users,
      COUNT(DISTINCT CASE WHEN returning_user = 1 THEN user_id END) as returning_users,
      AVG(session_duration_seconds) as avg_session_duration,
      AVG(page_views) as avg_page_views,
      AVG(analyses_uploaded) as avg_analyses_uploaded
    FROM user_sessions
    WHERE created_at >= ? AND created_at <= ?
    ${EXCLUDE_LOCALHOST}
  `;

  const from = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = dateTo || new Date().toISOString();

  return db.db.prepare(sql).get(from, to);
}

/**
 * Получение retention по когортам
 */
export function getCohortRetention(options = {}) {
  const sql = `
    WITH cohorts AS (
      SELECT
        user_id,
        DATE(MIN(created_at)) as cohort_date,
        MIN(created_at) as first_session
      FROM user_sessions
      GROUP BY user_id
    ),
    retention AS (
      SELECT
        c.cohort_date,
        COUNT(DISTINCT c.user_id) as cohort_size,
        COUNT(DISTINCT CASE
          WHEN DATE(s.created_at) = DATE(c.first_session, '+7 days')
          THEN c.user_id
        END) as week1_retained,
        COUNT(DISTINCT CASE
          WHEN DATE(s.created_at) = DATE(c.first_session, '+30 days')
          THEN c.user_id
        END) as month1_retained
      FROM cohorts c
      LEFT JOIN user_sessions s ON c.user_id = s.user_id
      GROUP BY c.cohort_date
    )
    SELECT
      cohort_date,
      cohort_size,
      week1_retained,
      month1_retained,
      ROUND(week1_retained * 100.0 / cohort_size, 2) as week1_retention_rate,
      ROUND(month1_retained * 100.0 / cohort_size, 2) as month1_retention_rate
    FROM retention
    ORDER BY cohort_date DESC
    LIMIT ?
  `;

  const limit = options.limit || 10;
  return db.db.prepare(sql).all(limit);
}

/**
 * Получение воронки конверсии
 */
export function getConversionFunnel(options = {}) {
  const { dateFrom, dateTo } = options;

  const sql = `
    SELECT
      COUNT(*) as total_sessions,
      SUM(CASE WHEN analyses_uploaded > 0 THEN 1 ELSE 0 END) as uploaded_analysis,
      SUM(CASE WHEN payment_triggered = 1 THEN 1 ELSE 0 END) as payment_triggered,
      SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) as payment_completed,
      ROUND(SUM(CASE WHEN analyses_uploaded > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as upload_rate,
      ROUND(SUM(CASE WHEN payment_triggered = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as payment_trigger_rate,
      ROUND(SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as conversion_rate
    FROM user_sessions
    WHERE created_at >= ? AND created_at <= ?
    ${EXCLUDE_LOCALHOST}
  `;

  const from = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = dateTo || new Date().toISOString();

  return db.db.prepare(sql).get(from, to);
}

/**
 * Топ событий пользователей
 */
export function getTopEvents(limit = 20) {
  const sql = `
    SELECT
      event_type,
      event_name,
      COUNT(*) as event_count,
      COUNT(DISTINCT user_id) as unique_users,
      COUNT(DISTINCT session_id) as unique_sessions
    FROM user_activity
    GROUP BY event_type, event_name
    ORDER BY event_count DESC
    LIMIT ?
  `;

  return db.db.prepare(sql).all(limit);
}

/**
 * Средняя длительность сессии по устройствам
 */
export function getSessionsByDevice() {
  const sql = `
    SELECT
      device_type,
      COUNT(*) as session_count,
      AVG(session_duration_seconds) as avg_duration,
      AVG(page_views) as avg_page_views,
      AVG(analyses_uploaded) as avg_analyses,
      SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) as conversions
    FROM user_sessions
    WHERE device_type IS NOT NULL
    ${EXCLUDE_LOCALHOST}
    GROUP BY device_type
    ORDER BY session_count DESC
  `;

  return db.db.prepare(sql).all();
}

/**
 * Статистика по источникам трафика
 */
export function getTrafficSources() {
  const sql = `
    SELECT
      COALESCE(utm_source, referral_source, 'direct') as source,
      utm_medium,
      utm_campaign,
      COUNT(*) as sessions,
      COUNT(DISTINCT user_id) as unique_users,
      SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) as conversions,
      ROUND(SUM(CASE WHEN payment_completed = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as conversion_rate
    FROM user_sessions
    GROUP BY source, utm_medium, utm_campaign
    ORDER BY sessions DESC
    LIMIT 20
  `;

  return db.db.prepare(sql).all();
}

/**
 * Топ популярных функций
 */
export function getTopFeatures(limit = 10) {
  const sql = `
    SELECT
      feature_name,
      feature_category,
      SUM(usage_count) as total_usage,
      COUNT(DISTINCT user_id) as unique_users,
      AVG(usage_count) as avg_usage_per_user,
      SUM(CASE WHEN success = 1 THEN usage_count ELSE 0 END) as successful_uses,
      SUM(CASE WHEN success = 0 THEN usage_count ELSE 0 END) as failed_uses,
      ROUND(SUM(CASE WHEN success = 1 THEN usage_count ELSE 0 END) * 100.0 / SUM(usage_count), 2) as success_rate
    FROM feature_usage
    GROUP BY feature_name, feature_category
    ORDER BY total_usage DESC
    LIMIT ?
  `;

  return db.db.prepare(sql).all(limit);
}

/**
 * Статистика engagement по дням недели
 */
export function getEngagementByDayOfWeek() {
  const sql = `
    SELECT
      CAST(strftime('%w', created_at) AS INTEGER) as day_of_week,
      CASE CAST(strftime('%w', created_at) AS INTEGER)
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END as day_name,
      COUNT(*) as sessions,
      AVG(session_duration_seconds) as avg_duration,
      AVG(page_views) as avg_page_views,
      SUM(analyses_uploaded) as total_analyses
    FROM user_sessions
    WHERE created_at >= DATE('now', '-30 days')
    ${EXCLUDE_LOCALHOST}
    GROUP BY day_of_week, day_name
    ORDER BY day_of_week
  `;

  return db.db.prepare(sql).all();
}

export default {
  getActiveUsers,
  getCohortRetention,
  getConversionFunnel,
  getTopEvents,
  getSessionsByDevice,
  getTrafficSources,
  getTopFeatures,
  getEngagementByDayOfWeek
};
