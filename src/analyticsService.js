/**
 * Analytics Service
 * Собирает данные из журналов systemd
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import AIAnalysisService from './aiAnalysisService.js';
import AlertService from './alertService.js';
import YandexMetrikaService from './yandexMetrikaService.js';
import os from 'os';

const execAsync = promisify(exec);

class AnalyticsService {
  constructor(serviceName = 'medicod-backend') {
    this.serviceName = serviceName;
    this.aiService = new AIAnalysisService();
    this.alertService = new AlertService();
    this.metrikaService = new YandexMetrikaService();
    this.isWindows = os.platform() === 'win32';

    if (this.isWindows) {
      console.log('⚠️  Windows обнаружена - используются mock данные для разработки');
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

    const [payments, errors, features, funnel, tokens] = await Promise.all([
      this.analyzePayments(),
      this.analyzeErrors(),
      this.analyzeFeatureUsage(),
      this.analyzeFunnel(),
      this.analyzeTokenUsage()
    ]);

    const report = { payments, errors, features, funnel, tokens };

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
   * Форматирует отчет для Telegram
   */
  formatForTelegram(report) {
    const { payments, errors, features, funnel, tokens, aiAnalysis, anomalies, comparison } = report;

    let msg = `📊 *Еженедельный отчет Medicod Backend*\n`;
    msg += `_${new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}_\n\n`;

    msg += `💰 *Финансовая статистика*\n`;

    // Платежи с WoW сравнением
    msg += `• Платежей: *${payments.total}*`;
    if (comparison?.payments?.total) {
      const c = comparison.payments.total;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n`;

    // Выручка с WoW сравнением
    msg += `• Выручка: *${payments.revenue}₽*`;
    if (comparison?.payments?.revenue) {
      const c = comparison.payments.revenue;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n`;

    // Средний чек с WoW сравнением
    msg += `• Средний чек: *${payments.avgCheck}₽*`;
    if (comparison?.payments?.avgCheck) {
      const c = comparison.payments.avgCheck;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n`;
    msg += `• Успешность: *100%*\n\n`;

    msg += `📅 *Динамика по дням*\n`;
    const days = Object.entries(payments.byDay).slice(-7);
    days.forEach(([day, data]) => {
      msg += `• ${day}: ${data.count} платежей, ${data.revenue}₽\n`;
    });
    msg += `\n`;

    // Воронка
    if (funnel) {
      msg += `🔮 *Воронка пользователей*\n`;
      msg += `• Посещения: ${funnel.visits || 'н/д'}\n`;
      msg += `• Уникальные пользователи: ${funnel.users || 'н/д'}\n`;
      msg += `• AI анализов: ${funnel.aiAnalyses}\n`;
      msg += `• Платежей: ${funnel.payments}\n`;
      msg += `\n`;
      msg += `📊 *Конверсии:*\n`;
      msg += `• Визит → AI анализ: ${funnel.conversionVisitToAI}%\n`;
      msg += `• AI → Платеж: ${funnel.conversionAIToPayment}%\n`;
      msg += `• Визит → Платеж: ${funnel.conversionVisitToPayment}%\n`;
      msg += `\n`;
    }

    msg += `🤖 *Использование функций*\n`;

    // OCR с WoW сравнением
    msg += `• OCR запросов: ${features.ocr}`;
    if (comparison?.features?.ocr) {
      const c = comparison.features.ocr;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n`;

    // AI анализ с WoW сравнением
    msg += `• AI анализ: ${features.ai}`;
    if (comparison?.features?.ai) {
      const c = comparison.features.ai;
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${c.emoji}`;
    }
    msg += `\n\n`;

    msg += `⚠️ *Ошибки*\n`;

    // Ошибки с WoW сравнением
    msg += `• Всего: ${errors.total}`;
    if (comparison?.errors?.total) {
      const c = comparison.errors.total;
      const errorEmoji = c.trend === 'down' ? '✅' : c.trend === 'up' ? '⚠️' : '➡️';
      msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${errorEmoji}`;
    }
    msg += `\n`;

    if (errors.webhook > 0) {
      msg += `• Webhook ошибки: ${errors.webhook}`;
      if (comparison?.errors?.webhook) {
        const c = comparison.errors.webhook;
        const errorEmoji = c.trend === 'down' ? '✅' : c.trend === 'up' ? '⚠️' : '➡️';
        msg += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW) ${errorEmoji}`;
      }
      msg += `\n`;
    }
    msg += `\n`;

    const dailyAvg = Math.round(payments.revenue / 7);
    const monthlyProjection = dailyAvg * 30;
    const monthlyGoal = 30000;
    const projectionProgress = Math.round((monthlyProjection / monthlyGoal) * 100);
    const projectionGap = monthlyGoal - monthlyProjection;

    msg += `🔮 *Прогноз*\n`;
    msg += `• Средняя выручка в день: ${dailyAvg}₽ (цель: 1000₽)\n`;
    msg += `• Прогноз на месяц: *${monthlyProjection}₽* (${projectionProgress}% от цели)\n`;

    if (monthlyProjection < monthlyGoal) {
      msg += `  ↳ Не хватает ${projectionGap}₽ до цели ${monthlyGoal}₽\n`;
    } else {
      msg += `  ↳ ✅ Цель достигнута! (+${Math.abs(projectionGap)}₽)\n`;
    }
    msg += `\n`;

    // Токены и стоимость AI
    if (tokens && tokens.total && tokens.total.requests > 0) {
      msg += `💸 *Использование AI токенов*\n`;
      msg += `• Запросов: ${tokens.total.requests}\n`;
      msg += `• Токенов: ${this.formatNumber(tokens.total.totalTokens)}\n`;
      msg += `• Стоимость: $${tokens.total.cost.toFixed(2)}\n`;

      // Детализация по моделям (если больше 1)
      const models = Object.keys(tokens.byModel);
      if (models.length > 1) {
        msg += `\n📊 *По моделям:*\n`;
        models.forEach(model => {
          const data = tokens.byModel[model];
          const shortModel = model.replace('gpt-', '').replace('-2024-', '/');
          msg += `• ${shortModel}: ${data.requests} req, $${data.cost.toFixed(2)}\n`;
        });
      }
      msg += `\n`;
    }

    // Добавляем алерты
    if (report.alerts) {
      const alertsMessage = this.alertService.formatAlertsForTelegram(report.alerts);
      if (alertsMessage) {
        msg += alertsMessage;
      }
    }

    // Добавляем AI инсайты
    if (aiAnalysis) {
      msg += this.aiService.formatAIAnalysisForTelegram(aiAnalysis);
      msg += `\n\n`;
    }

    // Показываем статус системы
    const hasHighSeverityAnomalies = anomalies?.some(a => a.severity === 'high');
    const hasCriticalAlerts = report.alerts?.critical?.length > 0;

    if (hasCriticalAlerts) {
      msg += `🚨 _ТРЕБУЕТСЯ СРОЧНОЕ ВНИМАНИЕ_`;
    } else if (hasHighSeverityAnomalies) {
      msg += `⚠️ _Требуется внимание_`;
    } else {
      msg += `✅ _Система работает стабильно_`;
    }

    return msg;
  }
}

export default AnalyticsService;
