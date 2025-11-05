/**
 * AI Analytics Queries
 * SQL запросы для аналитики использования AI моделей, токенов и стоимости
 */

import { getDatabaseInstance } from './database.js';

const db = getDatabaseInstance();

/**
 * Статистика использования AI моделей
 * @param {Object} options - Параметры фильтрации
 * @returns {Array} Статистика по каждой модели
 */
export function getAIModelUsageStats(options = {}) {
  const { dateFrom, dateTo } = options;

  let sql = `
    SELECT
      ai_model,
      COUNT(*) as requests_count,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      SUM(total_tokens) as total_tokens,
      SUM(ai_cost_usd) as total_cost_usd,
      AVG(ai_time_ms) as avg_response_time_ms,
      AVG(prompt_tokens) as avg_prompt_tokens,
      AVG(completion_tokens) as avg_completion_tokens,
      AVG(ai_cost_usd) as avg_cost_per_request
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND status = 'success'
  `;

  const params = [];

  if (dateFrom) {
    sql += ` AND created_at >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND created_at <= ?`;
    params.push(dateTo);
  }

  sql += ` GROUP BY ai_model ORDER BY total_cost_usd DESC`;

  return db.db.prepare(sql).all(...params);
}

/**
 * Динамика использования AI по дням
 * @param {Object} options - Параметры
 * @returns {Array} Статистика по дням
 */
export function getAIUsageByDay(options = {}) {
  const { model, dateFrom, dateTo } = options;

  let sql = `
    SELECT
      DATE(created_at) as date,
      ai_model,
      COUNT(*) as requests_count,
      SUM(total_tokens) as total_tokens,
      SUM(ai_cost_usd) as total_cost_usd,
      AVG(ai_time_ms) as avg_response_time_ms
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND status = 'success'
  `;

  const params = [];

  if (model) {
    sql += ` AND ai_model = ?`;
    params.push(model);
  }

  if (dateFrom) {
    sql += ` AND created_at >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND created_at <= ?`;
    params.push(dateTo);
  }

  sql += ` GROUP BY DATE(created_at), ai_model ORDER BY date DESC`;

  return db.db.prepare(sql).all(...params);
}

/**
 * Общая статистика AI за период
 * @param {Object} options - Параметры
 * @returns {Object} Общая статистика
 */
export function getAITotalStats(options = {}) {
  const { dateFrom, dateTo } = options;

  let sql = `
    SELECT
      COUNT(*) as total_requests,
      COUNT(DISTINCT ai_model) as models_used,
      SUM(total_tokens) as total_tokens,
      SUM(prompt_tokens) as total_prompt_tokens,
      SUM(completion_tokens) as total_completion_tokens,
      SUM(ai_cost_usd) as total_cost_usd,
      AVG(ai_cost_usd) as avg_cost_per_request,
      AVG(ai_time_ms) as avg_response_time_ms,
      MIN(created_at) as first_request,
      MAX(created_at) as last_request
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND status = 'success'
  `;

  const params = [];

  if (dateFrom) {
    sql += ` AND created_at >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    sql += ` AND created_at <= ?`;
    params.push(dateTo);
  }

  return db.db.prepare(sql).get(...params);
}

/**
 * Топ самых дорогих запросов
 * @param {number} limit - Количество запросов
 * @returns {Array} Список самых дорогих запросов
 */
export function getTopCostlyRequests(limit = 20) {
  const sql = `
    SELECT
      id,
      ai_model,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      ai_cost_usd,
      ai_time_ms,
      created_at,
      user_id
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND ai_cost_usd IS NOT NULL
      AND status = 'success'
    ORDER BY ai_cost_usd DESC
    LIMIT ?
  `;

  return db.db.prepare(sql).all(limit);
}

/**
 * Сравнение стоимости моделей
 * @returns {Array} Сравнение моделей по стоимости
 */
export function compareModelCosts() {
  const sql = `
    SELECT
      ai_model,
      COUNT(*) as requests,
      SUM(ai_cost_usd) as total_cost,
      AVG(ai_cost_usd) as avg_cost_per_request,
      SUM(total_tokens) as total_tokens,
      AVG(total_tokens) as avg_tokens_per_request,
      -- Стоимость за 1К токенов
      ROUND((SUM(ai_cost_usd) / SUM(total_tokens)) * 1000, 6) as cost_per_1k_tokens
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND ai_cost_usd IS NOT NULL
      AND total_tokens > 0
      AND status = 'success'
    GROUP BY ai_model
    ORDER BY total_cost DESC
  `;

  return db.db.prepare(sql).all();
}

/**
 * Прогноз расходов на месяц
 * @returns {Object} Прогноз расходов
 */
export function getMonthlyProjection() {
  const sql = `
    SELECT
      COUNT(*) as requests_last_7_days,
      SUM(ai_cost_usd) as cost_last_7_days,
      AVG(ai_cost_usd) as avg_cost_per_request,
      -- Прогноз на 30 дней
      ROUND((SUM(ai_cost_usd) / 7) * 30, 2) as projected_monthly_cost,
      -- Прогноз количества запросов
      ROUND((COUNT(*) / 7.0) * 30, 0) as projected_monthly_requests
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND ai_cost_usd IS NOT NULL
      AND status = 'success'
      AND created_at >= datetime('now', '-7 days')
  `;

  return db.db.prepare(sql).get();
}

/**
 * Статистика токенов по типам анализа
 * @returns {Array} Токены по типам
 */
export function getTokensByAnalysisType() {
  const sql = `
    SELECT
      analysis_type,
      ai_model,
      COUNT(*) as count,
      AVG(prompt_tokens) as avg_prompt_tokens,
      AVG(completion_tokens) as avg_completion_tokens,
      AVG(total_tokens) as avg_total_tokens,
      AVG(ai_cost_usd) as avg_cost
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND total_tokens > 0
      AND status = 'success'
    GROUP BY analysis_type, ai_model
    ORDER BY analysis_type, avg_cost DESC
  `;

  return db.db.prepare(sql).all();
}

/**
 * Процент бесплатных vs платных запросов
 * @returns {Object} Соотношение бесплатных и платных
 */
export function getFreeVsPaidRatio() {
  const sql = `
    SELECT
      SUM(CASE WHEN ai_cost_usd = 0 OR ai_cost_usd IS NULL THEN 1 ELSE 0 END) as free_requests,
      SUM(CASE WHEN ai_cost_usd > 0 THEN 1 ELSE 0 END) as paid_requests,
      COUNT(*) as total_requests,
      ROUND(
        SUM(CASE WHEN ai_cost_usd = 0 OR ai_cost_usd IS NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        2
      ) as free_percentage,
      SUM(ai_cost_usd) as total_cost
    FROM analyses
    WHERE ai_model IS NOT NULL
      AND status = 'success'
  `;

  return db.db.prepare(sql).get();
}

export default {
  getAIModelUsageStats,
  getAIUsageByDay,
  getAITotalStats,
  getTopCostlyRequests,
  compareModelCosts,
  getMonthlyProjection,
  getTokensByAnalysisType,
  getFreeVsPaidRatio
};
