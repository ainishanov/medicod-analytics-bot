/**
 * Database Service для работы с SQLite
 * Чтение истории платежей и аналитики
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
  constructor() {
    // По умолчанию используем БД из Backend (на продакшене это будет /root/medicod/Medicod_Backend/data/medicod.db)
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../Medicod_Backend/data/medicod.db');

    // Проверяем существование БД
    if (!fs.existsSync(dbPath)) {
      console.warn(`⚠️  База данных не найдена: ${dbPath}`);
      console.warn('⚠️  Используйте mock данные или укажите DATABASE_PATH');
      this.db = null;
      return;
    }

    this.db = new Database(dbPath, { readonly: true }); // Только чтение
    console.log(`✅ База данных подключена: ${dbPath}`);
  }

  /**
   * 🔒 Валидация даты (защита от SQL инъекций)
   */
  validateDate(dateString) {
    if (!dateString) return true; // null/undefined допустимы

    // ISO 8601 формат: YYYY-MM-DDTHH:MM:SS.sssZ
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const simpleDateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!isoDateRegex.test(dateString) && !simpleDateRegex.test(dateString)) {
      throw new Error(`Invalid date format: ${dateString}`);
    }

    return true;
  }

  /**
   * 🔒 Валидация user_id (защита от SQL инъекций)
   */
  validateUserId(userId) {
    if (!userId) return true;

    // Допустимы только алфавитно-цифровые символы, дефис, подчеркивание
    const userIdRegex = /^[a-zA-Z0-9_-]+$/;

    if (!userIdRegex.test(userId)) {
      throw new Error(`Invalid user_id format: ${userId}`);
    }

    return true;
  }

  /**
   * 🔒 Валидация limit (защита от переполнения)
   */
  validateLimit(limit) {
    if (!limit) return true;

    const numLimit = parseInt(limit, 10);

    if (isNaN(numLimit) || numLimit < 1 || numLimit > 10000) {
      throw new Error(`Invalid limit: ${limit} (must be 1-10000)`);
    }

    return true;
  }

  /**
   * Проверка доступности БД
   */
  isAvailable() {
    return this.db !== null;
  }

  /**
   * Получение платежей с фильтрацией
   */
  getPayments(options = {}) {
    if (!this.db) return [];

    // 🔒 Валидация входных данных
    this.validateDate(options.dateFrom);
    this.validateDate(options.dateTo);
    this.validateLimit(options.limit);

    let query = 'SELECT * FROM payments_unified WHERE status = \'succeeded\'';
    const params = {};

    if (options.dateFrom) {
      query += ' AND created_at >= @dateFrom';
      params.dateFrom = options.dateFrom;
    }

    if (options.dateTo) {
      query += ' AND created_at <= @dateTo';
      params.dateTo = options.dateTo;
    }

    query += ' ORDER BY created_at DESC';

    if (options.limit) {
      query += ' LIMIT @limit';
      params.limit = options.limit;
    }

    return this.db.prepare(query).all(params);
  }

  /**
   * Получение статистики платежей
   */
  getPaymentStats(options = {}) {
    if (!this.db) return null;

    // 🔒 Валидация
    this.validateDate(options.dateFrom);
    this.validateDate(options.dateTo);

    let query = `
      SELECT
        COUNT(*) as total_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        COUNT(DISTINCT user_id) as unique_users
      FROM payments_unified
      WHERE status = 'succeeded'
    `;

    const params = {};

    if (options.dateFrom) {
      query += ' AND created_at >= @dateFrom';
      params.dateFrom = options.dateFrom;
    }

    if (options.dateTo) {
      query += ' AND created_at <= @dateTo';
      params.dateTo = options.dateTo;
    }

    return this.db.prepare(query).get(params);
  }

  /**
   * Получение статистики по дням
   */
  getDailyStats(options = {}) {
    if (!this.db) return [];

    let query = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(amount) as revenue,
        AVG(amount) as avg_amount
      FROM payments_unified
      WHERE status = 'succeeded'
    `;

    const params = {};

    if (options.dateFrom) {
      query += ' AND created_at >= @dateFrom';
      params.dateFrom = options.dateFrom;
    }

    if (options.dateTo) {
      query += ' AND created_at <= @dateTo';
      params.dateTo = options.dateTo;
    }

    query += ' GROUP BY DATE(created_at) ORDER BY date DESC';

    return this.db.prepare(query).all(params);
  }

  /**
   * Получение статистики использования функций
   */
  getFeatureUsage(options = {}) {
    if (!this.db) return null;

    let query = `
      SELECT
        SUM(CASE WHEN feature_name = 'ocr' OR feature_name LIKE '%ocr%' THEN usage_count ELSE 0 END) as ocr_count,
        SUM(CASE WHEN feature_name = 'ai_analysis' OR feature_name LIKE '%ai%' THEN usage_count ELSE 0 END) as ai_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM feature_usage
      WHERE 1=1
    `;

    const params = {};

    if (options.dateFrom) {
      query += ' AND created_at >= @dateFrom';
      params.dateFrom = options.dateFrom;
    }

    if (options.dateTo) {
      query += ' AND created_at <= @dateTo';
      params.dateTo = options.dateTo;
    }

    return this.db.prepare(query).get(params);
  }

  /**
   * Закрытие соединения с БД
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('База данных закрыта');
    }
  }
}

// Singleton instance
let instance = null;

export const getDatabaseInstance = () => {
  if (!instance) {
    instance = new DatabaseService();
  }
  return instance;
};

export default DatabaseService;
