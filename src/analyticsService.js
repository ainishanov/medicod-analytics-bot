/**
 * Analytics Service
 * Собирает данные из журналов systemd
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import AIAnalysisService from './aiAnalysisService.js';
import AlertService from './alertService.js';
import YandexMetrikaService from './yandexMetrikaService.js';
import { getDatabaseInstance } from './database.js';
import * as BehaviorQueries from './behaviorQueries.js';
import * as AdvancedQueries from './advancedAnalyticsQueries.js';
import os from 'os';

const execAsync = promisify(exec);

class AnalyticsService {
  constructor(serviceName = 'medicod-backend') {
    this.serviceName = serviceName;
    this.aiService = new AIAnalysisService();
    this.alertService = new AlertService();
    this.metrikaService = new YandexMetrikaService();
    this.db = getDatabaseInstance();
    this.isWindows = os.platform() === 'win32';

    if (this.isWindows) {
      console.log('⚠️  Windows обнаружена - используются mock данные для разработки');
    }

    if (this.db && this.db.isAvailable()) {
      console.log('✅ Аналитика подключена к SQLite базе данных');
    } else {
      console.log('⚠️  База данных недоступна, используются mock/логи');
    }
  }

  /**
   * Генерирует mock данные для Windows
   */
  getMockData(since = '7 days ago') {
    // Определяем количество дней для mock данных
    const daysMap = {
      'today': 1,
      '1 day ago': 1,
      '7 days ago': 7
    };
    const days = daysMap[since] || 7;

    // Генерируем данные
    const mockPayments = [];
    const mockErrors = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });

      // Генерируем 3-5 платежей в день
      const paymentsPerDay = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < paymentsPerDay; j++) {
        mockPayments.push({
          date: dateStr,
          amount: 50 + Math.floor(Math.random() * 100)
        });
      }

      // Иногда генерируем ошибки
      if (Math.random() > 0.7) {
        mockErrors.push({
          type: Math.random() > 0.5 ? 'webhook' : 'general',
          date: dateStr
        });
      }
    }

    return { payments: mockPayments, errors: mockErrors };
  }

  /**
   * Получает логи из systemd
   */
  async getLogs(since = '7 days ago') {
    if (this.isWindows) {
      // На Windows возвращаем пустую строку, используем mock данные
      return '';
    }

    const { stdout } = await execAsync(
      `journalctl -u ${this.serviceName} --since '${since}' --no-pager`
    );
    return stdout;
  }

  /**
   * Анализирует платежи
   */
  async analyzePayments(since = '7 days ago') {
    // Пробуем получить данные из БД
    if (this.db && this.db.isAvailable()) {
      return await this.analyzePaymentsFromDB(since);
    }

    // Fallback на mock/логи
    let payments;

    if (this.isWindows) {
      // Используем mock данные на Windows
      const mockData = this.getMockData(since);
      payments = mockData.payments;
    } else {
      // Парсим логи на Linux
      const logs = await this.getLogs(since);
      const paymentLines = logs.split('\n').filter(line =>
        line.includes('Платеж успешно создан')
      );

      payments = paymentLines.map(line => {
        const dateMatch = line.match(/(\w{3}\s+\d{1,2})/);
        const amountMatch = line.match(/"amount":(\d+)/);

        return {
          date: dateMatch ? dateMatch[1] : null,
          amount: amountMatch ? parseInt(amountMatch[1]) : 0
        };
      }).filter(p => p.date && p.amount);
    }

    // Группировка по дням
    const byDay = {};
    payments.forEach(p => {
      if (!byDay[p.date]) {
        byDay[p.date] = { count: 0, revenue: 0 };
      }
      byDay[p.date].count++;
      byDay[p.date].revenue += p.amount;
    });

    return {
      total: payments.length,
      revenue: payments.reduce((sum, p) => sum + p.amount, 0),
      avgCheck: payments.length > 0 ? Math.round(payments.reduce((sum, p) => sum + p.amount, 0) / payments.length) : 0,
      byDay
    };
  }

  /**
   * Анализирует платежи из базы данных (НОВЫЙ МЕТОД)
   */
  async analyzePaymentsFromDB(since = '7 days ago') {
    // Парсим период
    const daysMap = {
      'today': 0,
      '1 day ago': 1,
      '7 days ago': 7,
      '14 days ago': 14
    };
    const days = daysMap[since] || 7;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    dateFrom.setHours(0, 0, 0, 0);

    // Получаем статистику из БД
    const stats = this.db.getPaymentStats({
      dateFrom: dateFrom.toISOString()
    });

    // Получаем статистику по дням
    const dailyStats = this.db.getDailyStats({
      dateFrom: dateFrom.toISOString()
    });

    // Форматируем в формат совместимый с предыдущей версией
    const byDay = {};
    dailyStats.forEach(day => {
      const date = new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      byDay[date] = {
        count: day.count,
        revenue: Math.round(day.revenue)
      };
    });

    return {
      total: stats?.total_count || 0,
      revenue: Math.round(stats?.total_revenue || 0),
      avgCheck: Math.round(stats?.avg_amount || 0),
      byDay
    };
  }

  /**
   * Анализирует ошибки
   */
  async analyzeErrors(since = '7 days ago') {
    if (this.isWindows) {
      // Используем mock данные на Windows
      const mockData = this.getMockData(since);
      const webhookErrors = mockData.errors.filter(e => e.type === 'webhook').length;

      return {
        total: mockData.errors.length,
        webhook: webhookErrors
      };
    }

    const logs = await this.getLogs(since);
    const errorLines = logs.split('\n').filter(line =>
      line.includes('[ERROR]') || line.includes('Ошибка')
    );

    const webhookErrors = errorLines.filter(line =>
      line.includes('Ошибка обработки webhook')
    ).length;

    return {
      total: errorLines.length,
      webhook: webhookErrors
    };
  }

  /**
   * Анализирует использование функций
   */
  async analyzeFeatureUsage(since = '7 days ago') {
    if (this.isWindows) {
      // Mock данные для Windows
      const daysMap = { 'today': 1, '1 day ago': 1, '7 days ago': 7 };
      const days = daysMap[since] || 7;

      return {
        ocr: Math.floor(Math.random() * days * 2),
        ai: Math.floor(Math.random() * days * 3)
      };
    }

    const logs = await this.getLogs(since);

    return {
      ocr: (logs.match(/📸 Получено изображение/g) || []).length,
      ai: (logs.match(/🚀 \[BACKEND\] ПОЛУЧЕН ЗАПРОС НА AI АНАЛИЗ/g) || []).length
    };
  }

  /**
   * Анализирует использование AI токенов по моделям
   */
  async analyzeTokenUsage(since = '7 days ago') {
    if (this.isWindows) {
      // Mock данные для Windows
      return {
        byModel: {
          'gpt-4o-mini-2024-07-18': {
            requests: 45,
            promptTokens: 125000,
            completionTokens: 78000,
            totalTokens: 203000,
            cost: 0.05  // $0.05
          },
          'gpt-4o-2024-08-06': {
            requests: 3,
            promptTokens: 15000,
            completionTokens: 8500,
            totalTokens: 23500,
            cost: 0.15  // $0.15
          }
        },
        total: {
          requests: 48,
          promptTokens: 140000,
          completionTokens: 86500,
          totalTokens: 226500,
          cost: 0.20  // $0.20
        }
      };
    }

    try {
      const logs = await this.getLogs(since);
      const lines = logs.split('\n');

      const byModel = {};
      let currentModel = null;
      let tokenData = null;

      for (const line of lines) {
        // Ищем модель
        const modelMatch = line.match(/🤖 \[AI SERVICE\] ИСПОЛЬЗОВАННАЯ МОДЕЛЬ: (.+)/);
        if (modelMatch) {
          currentModel = modelMatch[1].trim();
          if (!byModel[currentModel]) {
            byModel[currentModel] = {
              requests: 0,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0
            };
          }
        }

        // Ищем prompt_tokens
        const promptMatch = line.match(/prompt_tokens:\s*(\d+)/);
        if (promptMatch && currentModel) {
          if (!tokenData) tokenData = {};
          tokenData.prompt = parseInt(promptMatch[1]);
        }

        // Ищем completion_tokens
        const completionMatch = line.match(/completion_tokens:\s*(\d+)/);
        if (completionMatch && currentModel && tokenData) {
          tokenData.completion = parseInt(completionMatch[1]);
        }

        // Ищем total_tokens
        const totalMatch = line.match(/total_tokens:\s*(\d+)/);
        if (totalMatch && currentModel && tokenData) {
          tokenData.total = parseInt(totalMatch[1]);

          // Сохраняем данные
          byModel[currentModel].requests++;
          byModel[currentModel].promptTokens += tokenData.prompt || 0;
          byModel[currentModel].completionTokens += tokenData.completion || 0;
          byModel[currentModel].totalTokens += tokenData.total || 0;

          // Сбрасываем временные данные
          tokenData = null;
          currentModel = null;
        }
      }

      // Рассчитываем стоимость по моделям
      this.calculateTokenCosts(byModel);

      // Подсчитываем общую статистику
      const total = {
        requests: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0
      };

      for (const model in byModel) {
        total.requests += byModel[model].requests;
        total.promptTokens += byModel[model].promptTokens;
        total.completionTokens += byModel[model].completionTokens;
        total.totalTokens += byModel[model].totalTokens;
        total.cost += byModel[model].cost || 0;
      }

      return { byModel, total };
    } catch (error) {
      console.error('❌ Ошибка анализа токенов:', error.message);
      return {
        byModel: {},
        total: {
          requests: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0
        }
      };
    }
  }

  /**
   * Рассчитывает стоимость токенов по моделям OpenAI
   * Цены на февраль 2025 (актуально по состоянию на дату создания)
   */
  calculateTokenCosts(byModel) {
    // Цены в USD за 1M токенов
    const pricing = {
      'gpt-4o-mini-2024-07-18': {
        input: 0.150,    // $0.15 per 1M input tokens
        output: 0.600     // $0.60 per 1M output tokens
      },
      'gpt-4o-2024-08-06': {
        input: 2.50,      // $2.50 per 1M input tokens
        output: 10.00     // $10.00 per 1M output tokens
      },
      'gpt-4o-2024-11-20': {
        input: 2.50,
        output: 10.00
      },
      'gpt-4-turbo-2024-04-09': {
        input: 10.00,
        output: 30.00
      }
    };

    for (const model in byModel) {
      const modelPricing = pricing[model] || pricing['gpt-4o-mini-2024-07-18']; // fallback

      const inputCost = (byModel[model].promptTokens / 1000000) * modelPricing.input;
      const outputCost = (byModel[model].completionTokens / 1000000) * modelPricing.output;

      byModel[model].cost = Math.round((inputCost + outputCost) * 100) / 100; // округляем до центов
    }
  }

  /**
   * Анализирует использование Yandex Vision OCR
   */
  async analyzeOCRUsage(since = '7 days ago') {
    if (this.isWindows) {
      // Mock данные для Windows
      return {
        requests: 15,
        cost: 0.08  // $0.08
      };
    }

    try {
      const logs = await this.getLogs(since);

      // Считаем количество OCR запросов (через backend)
      const ocrRequests = (logs.match(/📸 Получено изображение/g) || []).length;

      // Yandex Vision OCR стоимость
      // Цены на 2025: 0.13₽ за единицу распознавания (за изображение/страницу)
      // Источник: https://cloud.yandex.ru/docs/vision/pricing
      // Конвертируем рубли в доллары (примерно 1$ = 100₽)
      const costInRubles = ocrRequests * 0.13; // 0.13₽ за запрос
      const costInUSD = costInRubles / 100; // конвертация в USD

      return {
        requests: ocrRequests,
        cost: Math.round(costInUSD * 100) / 100 // округляем до центов
      };
    } catch (error) {
      console.error('❌ Ошибка анализа OCR:', error.message);
      return {
        requests: 0,
        cost: 0
      };
    }
  }

  /**
   * Анализирует воронку пользователей
   */
  async analyzeFunnel(since = '7 days ago') {
    if (this.isWindows) {
      // Mock данные для Windows
      return {
        visits: 1250,
        users: 890,
        aiAnalyses: 156,
        payments: 24,
        conversionVisitToAI: 12.5,
        conversionAIToPayment: 15.4
      };
    }

    try {
      // Получаем данные из Яндекс.Метрики
      const daysMap = { 'today': 1, '1 day ago': 1, '7 days ago': 7, '14 days ago': 14 };
      const days = daysMap[since] || 7;

      const metrikaStats = await this.metrikaService.getStats(days);

      // Получаем данные из логов
      const logs = await this.getLogs(since);
      const aiAnalyses = (logs.match(/🚀 \[BACKEND\] ПОЛУЧЕН ЗАПРОС НА AI АНАЛИЗ/g) || []).length;
      const ocrRequests = (logs.match(/📸 Получено изображение/g) || []).length;
      const paymentsCount = (logs.match(/Платеж успешно создан/g) || []).length;

      const visits = metrikaStats?.visits?.visits || 0;
      const users = metrikaStats?.visits?.users || 0;

      return {
        visits,
        users,
        ocrRequests,
        aiAnalyses,
        payments: paymentsCount,
        // Конверсии
        conversionVisitToAI: visits > 0 ? Math.round((aiAnalyses / visits) * 100 * 10) / 10 : 0,
        conversionAIToPayment: aiAnalyses > 0 ? Math.round((paymentsCount / aiAnalyses) * 100 * 10) / 10 : 0,
        conversionVisitToPayment: visits > 0 ? Math.round((paymentsCount / visits) * 100 * 10) / 10 : 0
      };
    } catch (error) {
      console.error('❌ Ошибка анализа воронки:', error.message);
      return {
        visits: 0,
        users: 0,
        ocrRequests: 0,
        aiAnalyses: 0,
        payments: 0,
        conversionVisitToAI: 0,
        conversionAIToPayment: 0,
        conversionVisitToPayment: 0
      };
    }
  }

  /**
   * Генерирует дневной отчет
   */
  async generateDailyReport(period = 'today') {
    console.log(`📊 Генерация отчета за ${period}...`);

    const [payments, errors, features] = await Promise.all([
      this.analyzePayments(period),
      this.analyzeErrors(period),
      this.analyzeFeatureUsage(period)
    ]);

    return { payments, errors, features };
  }

  /**
   * Генерирует полный отчет
   */
  async generateWeeklyReport() {
    console.log('📊 Генерация еженедельного отчета...');

    const [payments, errors, features, funnel, tokens, ocr] = await Promise.all([
      this.analyzePayments(),
      this.analyzeErrors(),
      this.analyzeFeatureUsage(),
      this.analyzeFunnel(),
      this.analyzeTokenUsage(),
      this.analyzeOCRUsage()
    ]);

    const report = { payments, errors, features, funnel, tokens, ocr };

    // 👥 Добавляем данные поведения пользователей
    if (this.db && this.db.isAvailable()) {
      console.log('📊 Получение данных поведения пользователей...');
      report.behavior = {
        users: this.analyzeBehaviorUsers(),
        behaviorFunnel: this.analyzeBehaviorFunnel(),
        devices: this.analyzeBehaviorDevices(),
        sources: this.analyzeBehaviorSources(),
        topFeatures: this.analyzeBehaviorFeatures(5),
        retention: this.analyzeBehaviorRetention(3),
        engagement: this.analyzeBehaviorEngagement()
      };
    }

    // Получаем данные прошлой недели для сравнения
    const lastWeekReport = await this.getLastWeekReport();
    if (lastWeekReport) {
      report.comparison = this.calculateWoWComparison(report, lastWeekReport);
    }

    // Проверяем алерты
    report.alerts = this.alertService.checkAlerts(report);

    // Добавляем AI анализ
    const aiAnalysis = await this.aiService.analyzeReport(report);
    report.aiAnalysis = aiAnalysis;

    // Детектируем аномалии
    report.anomalies = this.aiService.detectAnomalies(report);

    return report;
  }

  /**
   * Получает данные прошлой недели
   */
  async getLastWeekReport() {
    try {
      const [payments, errors, features, funnel] = await Promise.all([
        this.analyzePayments('14 days ago'),
        this.analyzeErrors('14 days ago'),
        this.analyzeFeatureUsage('14 days ago'),
        this.analyzeFunnel('14 days ago')
      ]);

      return { payments, errors, features, funnel };
    } catch (error) {
      console.warn('⚠️ Не удалось получить данные прошлой недели:', error.message);
      return null;
    }
  }

  /**
   * Рассчитывает WoW сравнение
   */
  calculateWoWComparison(current, lastWeek) {
    const comparison = {};

    // Сравнение платежей
    comparison.payments = {
      total: this.calculateChange(current.payments.total, lastWeek.payments.total),
      revenue: this.calculateChange(current.payments.revenue, lastWeek.payments.revenue),
      avgCheck: this.calculateChange(current.payments.avgCheck, lastWeek.payments.avgCheck)
    };

    // Сравнение ошибок
    comparison.errors = {
      total: this.calculateChange(current.errors.total, lastWeek.errors.total),
      webhook: this.calculateChange(current.errors.webhook, lastWeek.errors.webhook)
    };

    // Сравнение функций
    comparison.features = {
      ocr: this.calculateChange(current.features.ocr, lastWeek.features.ocr),
      ai: this.calculateChange(current.features.ai, lastWeek.features.ai)
    };

    return comparison;
  }

  /**
   * Вычисляет изменение метрики
   */
  calculateChange(current, previous) {
    if (!previous || previous === 0) {
      return {
        absolute: current,
        percent: current > 0 ? 100 : 0,
        trend: current > 0 ? 'up' : 'stable',
        emoji: current > 0 ? '📈' : '➡️'
      };
    }

    const absolute = current - previous;
    const percent = Math.round((absolute / previous) * 100);

    let trend = 'stable';
    let emoji = '➡️';

    if (percent > 5) {
      trend = 'up';
      emoji = '📈';
    } else if (percent < -5) {
      trend = 'down';
      emoji = '📉';
    }

    return {
      absolute,
      percent,
      trend,
      emoji,
      previous
    };
  }

  /**
   * Форматирует большие числа с разделителями (123456 -> 123,456)
   */
  formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * 👥 АНАЛИТИКА ПОВЕДЕНИЯ ПОЛЬЗОВАТЕЛЕЙ
   */

  /**
   * Анализирует активных пользователей
   */
  analyzeBehaviorUsers(since = '7 days ago') {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      const daysMap = { 'today': 0, '1 day ago': 1, '7 days ago': 7, '14 days ago': 14 };
      const days = daysMap[since] || 7;

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const stats = BehaviorQueries.getActiveUsers({
        dateFrom: dateFrom.toISOString(),
        dateTo: new Date().toISOString()
      });

      return stats;
    } catch (error) {
      console.warn('⚠️ Не удалось получить данные о пользователях:', error.message);
      return null;
    }
  }

  /**
   * Анализирует воронку конверсии из поведения
   */
  analyzeBehaviorFunnel(since = '7 days ago') {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      const daysMap = { 'today': 0, '1 day ago': 1, '7 days ago': 7, '14 days ago': 14 };
      const days = daysMap[since] || 7;

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);

      const funnel = BehaviorQueries.getConversionFunnel({
        dateFrom: dateFrom.toISOString(),
        dateTo: new Date().toISOString()
      });

      return funnel;
    } catch (error) {
      console.warn('⚠️ Не удалось получить воронку конверсии:', error.message);
      return null;
    }
  }

  /**
   * Анализирует устройства пользователей
   */
  analyzeBehaviorDevices() {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      return BehaviorQueries.getSessionsByDevice();
    } catch (error) {
      console.warn('⚠️ Не удалось получить данные по устройствам:', error.message);
      return null;
    }
  }

  /**
   * Анализирует источники трафика
   */
  analyzeBehaviorSources() {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      return BehaviorQueries.getTrafficSources();
    } catch (error) {
      console.warn('⚠️ Не удалось получить источники трафика:', error.message);
      return null;
    }
  }

  /**
   * Анализирует популярные функции
   */
  analyzeBehaviorFeatures(limit = 10) {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      return BehaviorQueries.getTopFeatures(limit);
    } catch (error) {
      console.warn('⚠️ Не удалось получить популярные функции:', error.message);
      return null;
    }
  }

  /**
   * Анализирует retention
   */
  analyzeBehaviorRetention(limit = 5) {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      return BehaviorQueries.getCohortRetention({ limit });
    } catch (error) {
      console.warn('⚠️ Не удалось получить retention:', error.message);
      return null;
    }
  }

  /**
   * Анализирует engagement по дням недели
   */
  analyzeBehaviorEngagement() {
    if (!this.db || !this.db.isAvailable()) {
      return null;
    }

    try {
      return BehaviorQueries.getEngagementByDayOfWeek();
    } catch (error) {
      console.warn('⚠️ Не удалось получить engagement:', error.message);
      return null;
    }
  }

  /**
   * Форматирует отчет для Telegram
   */
  formatForTelegram(report) {
    const { payments, errors, features, funnel, aiAnalysis, comparison } = report;

    let msg = `📊 <b>Еженедельный отчет Medicod</b>\n`;
    msg += `<i>${new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}</i>\n\n`;

    msg += `💰 <b>Финансы</b>\n`;

    // Платежи с WoW сравнением
    msg += `• Платежей: <b>${payments.total}</b>`;
    if (comparison?.payments?.total) {
      const c = comparison.payments.total;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n`;

    // Выручка с WoW сравнением
    msg += `• Выручка: <b>${payments.revenue}₽</b>`;
    if (comparison?.payments?.revenue) {
      const c = comparison.payments.revenue;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n`;

    // Средний чек с WoW сравнением
    msg += `• Средний чек: <b>${payments.avgCheck}₽</b>`;
    if (comparison?.payments?.avgCheck) {
      const c = comparison.payments.avgCheck;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n\n`;

    // Ключевые метрики воронки
    if (funnel) {
      msg += `🔥 <b>Конверсии</b>\n`;
      msg += `• Визит → Платеж: <b>${funnel.conversionVisitToPayment}%</b>\n`;
      if (funnel.aiAnalyses > 0) {
        msg += `• AI → Платеж: ${funnel.conversionAIToPayment}%\n`;
      }
      msg += `\n`;
    }

    // Только если есть использование функций
    if (features.ocr > 0 || features.ai > 0) {
      msg += `🤖 <b>Функции</b>\n`;
      if (features.ocr > 0) {
        msg += `• OCR: ${features.ocr}`;
        if (comparison?.features?.ocr) {
          const c = comparison.features.ocr;
          msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
        }
        msg += `\n`;
      }
      if (features.ai > 0) {
        msg += `• AI: ${features.ai}`;
        if (comparison?.features?.ai) {
          const c = comparison.features.ai;
          msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
        }
        msg += `\n`;
      }
      msg += `\n`;
    }

    // Ошибки - только если есть проблемы
    if (errors.total > 0) {
      msg += `⚠️ <b>Ошибки</b>\n`;
      msg += `• Всего: ${errors.total}`;
      if (comparison?.errors?.total) {
        const c = comparison.errors.total;
        const errorEmoji = c.trend === 'down' ? '✅' : c.trend === 'up' ? '⚠️' : '➡️';
        msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${errorEmoji}`;
      }
      msg += `\n\n`;
    }

    const dailyAvg = Math.round(payments.revenue / 7);
    const monthlyProjection = dailyAvg * 30;
    const monthlyGoal = 30000;
    const projectionProgress = Math.round((monthlyProjection / monthlyGoal) * 100);

    msg += `🎯 <b>Прогноз</b>\n`;
    msg += `• Прогноз на месяц: <b>${monthlyProjection}₽</b> (${projectionProgress}% от цели 30,000₽)\n\n`;

    // AI инсайты - самое важное для CEO
    if (aiAnalysis) {
      msg += this.aiService.formatAIAnalysisForTelegram(aiAnalysis);
    }

    return msg;
  }

  /**
   * LTV - Customer Lifetime Value
   */
  analyzeCustomerLTV(options = {}) {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.calculateLTV(options);
    } catch (error) {
      console.warn('⚠️ Ошибка получения LTV:', error.message);
      return null;
    }
  }

  /**
   * Churn Rate - коэффициент оттока
   */
  analyzeChurnRate(options = {}) {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.getChurnRate(options);
    } catch (error) {
      console.warn('⚠️ Ошибка получения Churn Rate:', error.message);
      return null;
    }
  }

  /**
   * Churn Rate по когортам
   */
  analyzeChurnByCohort() {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.getChurnRateByCohort();
    } catch (error) {
      console.warn('⚠️ Ошибка получения Churn по когортам:', error.message);
      return null;
    }
  }

  /**
   * Детальная воронка (8 этапов)
   */
  analyzeDetailedFunnel(options = {}) {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.getDetailedFunnel(options);
    } catch (error) {
      console.warn('⚠️ Ошибка получения детальной воронки:', error.message);
      return null;
    }
  }

  /**
   * Средний чек
   */
  analyzeAverageOrderValue(options = {}) {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.getAverageOrderValue(options);
    } catch (error) {
      console.warn('⚠️ Ошибка получения среднего чека:', error.message);
      return null;
    }
  }

  /**
   * Топ клиентов по LTV
   */
  analyzeTopCustomers(limit = 20) {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.getTopCustomersByLTV(limit);
    } catch (error) {
      console.warn('⚠️ Ошибка получения топ клиентов:', error.message);
      return null;
    }
  }

  /**
   * Когортный анализ LTV
   */
  analyzeCohortLTV() {
    if (!this.db || !this.db.isAvailable()) return null;
    try {
      return AdvancedQueries.getCohortLTVAnalysis();
    } catch (error) {
      console.warn('⚠️ Ошибка когортного анализа:', error.message);
      return null;
    }
  }
}

export default AnalyticsService;
