/**
 * Database Service для работы с SQLite
 * Чтение истории платежей и аналитики
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

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

    let query = 'SELECT * FROM payments WHERE status = \'succeeded\'';
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

    let query = `
      SELECT
        COUNT(*) as total_count,
        SUM(amount) as total_revenue,
        AVG(amount) as avg_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        COUNT(DISTINCT user_id) as unique_users
      FROM payments
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
      FROM payments
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
