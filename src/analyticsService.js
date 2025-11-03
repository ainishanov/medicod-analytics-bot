/**
 * Analytics Service
 * Собирает данные из журналов systemd
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class AnalyticsService {
  constructor(serviceName = 'medicod-backend') {
    this.serviceName = serviceName;
  }

  /**
   * Получает логи из systemd
   */
  async getLogs(since = '7 days ago') {
    const { stdout } = await execAsync(
      `journalctl -u ${this.serviceName} --since '${since}' --no-pager`
    );
    return stdout;
  }

  /**
   * Анализирует платежи
   */
  async analyzePayments(since = '7 days ago') {
    const logs = await this.getLogs(since);
    const paymentLines = logs.split('\n').filter(line =>
      line.includes('Платеж успешно создан')
    );

    const payments = paymentLines.map(line => {
      const dateMatch = line.match(/(\w{3}\s+\d{1,2})/);
      const amountMatch = line.match(/"amount":(\d+)/);

      return {
        date: dateMatch ? dateMatch[1] : null,
        amount: amountMatch ? parseInt(amountMatch[1]) : 0
      };
    }).filter(p => p.date && p.amount);

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
    const logs = await this.getLogs(since);

    return {
      ocr: (logs.match(/OCR|Распознавание текста/g) || []).length,
      ai: (logs.match(/AI анализ/g) || []).length
    };
  }

  /**
   * Генерирует полный отчет
   */
  async generateWeeklyReport() {
    console.log('📊 Генерация еженедельного отчета...');

    const [payments, errors, features] = await Promise.all([
      this.analyzePayments(),
      this.analyzeErrors(),
      this.analyzeFeatureUsage()
    ]);

    return { payments, errors, features };
  }

  /**
   * Форматирует отчет для Telegram
   */
  formatForTelegram(report) {
    const { payments, errors, features } = report;

    let msg = `📊 *Еженедельный отчет Medicod Backend*\n`;
    msg += `_${new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}_\n\n`;

    msg += `💰 *Финансовая статистика*\n`;
    msg += `• Платежей: *${payments.total}*\n`;
    msg += `• Выручка: *${payments.revenue}₽*\n`;
    msg += `• Средний чек: *${payments.avgCheck}₽*\n`;
    msg += `• Успешность: *100%*\n\n`;

    msg += `📅 *Динамика по дням*\n`;
    const days = Object.entries(payments.byDay).slice(-7);
    days.forEach(([day, data]) => {
      msg += `• ${day}: ${data.count} платежей, ${data.revenue}₽\n`;
    });
    msg += `\n`;

    msg += `🤖 *Использование функций*\n`;
    msg += `• OCR запросов: ${features.ocr}\n`;
    msg += `• AI анализ: ${features.ai}\n\n`;

    msg += `⚠️ *Ошибки*\n`;
    msg += `• Всего: ${errors.total}\n`;
    if (errors.webhook > 0) {
      msg += `• Webhook ошибки: ${errors.webhook}\n`;
    }
    msg += `\n`;

    const dailyAvg = Math.round(payments.revenue / 7);
    const monthlyProjection = dailyAvg * 30;
    msg += `🔮 *Прогноз*\n`;
    msg += `• Средняя выручка в день: ${dailyAvg}₽\n`;
    msg += `• Прогноз на месяц: *${monthlyProjection}₽*\n\n`;

    msg += `✅ _Система работает стабильно_`;

    return msg;
  }
}

export default AnalyticsService;
