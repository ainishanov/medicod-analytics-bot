/**
 * AI Analysis Service
 * Использует ZhipuAI GLM-4.6 для анализа метрик и генерации инсайтов
 */

import { ZhipuAI } from 'zhipuai-sdk-nodejs-v4';
import dotenv from 'dotenv';

dotenv.config();

class AIAnalysisService {
  constructor() {
    this.apiKey = process.env.ZHIPUAI_API_KEY;
    this.enabled = process.env.AI_ANALYSIS_ENABLED === 'true';

    if (this.enabled && !this.apiKey) {
      console.warn('⚠️ AI анализ включен, но ZHIPUAI_API_KEY не задан');
      this.enabled = false;
    }

    if (this.enabled) {
      try {
        this.client = new ZhipuAI({
          apiKey: this.apiKey,
          baseUrl: 'https://api.z.ai/api/paas/v4'
        });
        console.log('✅ ZhipuAI client инициализирован (z.ai)');
      } catch (error) {
        console.error('❌ Ошибка инициализации ZhipuAI:', error.message);
        this.enabled = false;
      }
    }

    this.historicalData = [];
  }

  /**
   * Добавляет данные в историю для сравнительного анализа
   */
  addHistoricalData(report) {
    this.historicalData.push({
      date: new Date().toISOString(),
      ...report
    });

    // Храним последние 8 недель
    if (this.historicalData.length > 8) {
      this.historicalData.shift();
    }
  }

  /**
   * Создаёт компактный промпт для AI анализа
   */
  createAnalysisPrompt(currentReport) {
    const { payments, errors, features, comparison } = currentReport;

    // Бизнес-цели
    const weeklyGoal = 7500;
    const revenueGap = weeklyGoal - payments.revenue;
    const revenueProgress = Math.round((payments.revenue / weeklyGoal) * 100);

    // Тренды
    const revenueTrend = comparison?.payments?.revenue?.percent || 0;
    const paymentsTrend = comparison?.payments?.total?.percent || 0;

    let prompt = `Ты эксперт SaaS аналитики. Medicod - сервис анализа крови.

📊 МЕТРИКИ ЗА НЕДЕЛЮ:
• Выручка: ${payments.revenue}₽ (${revenueProgress}% от цели ${weeklyGoal}₽)
• Платежей: ${payments.total} (${paymentsTrend > 0 ? '+' : ''}${paymentsTrend}% WoW)
• Средний чек: ${payments.avgCheck}₽
• Ошибок: ${errors.total}

🎯 ГЭП: не хватает ${revenueGap}₽ до недельной цели

ЗАДАЧА: Дай топ-3 actionable инсайта для CEO.
Формат: [Проблема] → [Действие] → [Эффект]

Требования:
- Фокус на revenue impact
- Конкретные шаги (без общих советов)
- Max 600 символов

Пример: "Выручка +${Math.abs(revenueTrend)}% WoW → Масштабировать успешный канал → +${Math.round(revenueGap * 0.3)}₽ в неделю"`;

    return prompt;
  }

  /**
   * Выполняет AI анализ отчета
   */
  async analyzeReport(report) {
    if (!this.enabled) {
      console.log('ℹ️ AI анализ отключен');
      return null;
    }

    try {
      console.log('🤖 Запрос AI анализа...');

      const prompt = this.createAnalysisPrompt(report);

      const response = await this.client.createCompletions({
        model: 'glm-4.6',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      });

      console.log('📦 AI ответ:', JSON.stringify(response, null, 2));

      const analysis = response.choices?.[0]?.message?.content;

      if (analysis) {
        console.log('✅ AI анализ получен');
        // Сохраняем данные в историю для следующего анализа
        this.addHistoricalData(report);
        return analysis;
      }

      return null;
    } catch (error) {
      console.error('❌ Ошибка AI анализа:', error);
      return null;
    }
  }

  /**
   * Форматирует AI анализ для Telegram
   */
  formatAIAnalysisForTelegram(analysis) {
    if (!analysis) return '';

    // Конвертируем Markdown в HTML и экранируем спецсимволы
    let formatted = analysis
      // Escape HTML спецсимволы
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Конвертируем Markdown bold в HTML
      .replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>')
      // Конвертируем Markdown single * в HTML bold (для заголовков вроде *АНАЛИЗ*)
      .replace(/\*([^\*\n]+)\*/g, '<b>$1</b>');

    return `\n\n🤖 <b>AI ИНСАЙТЫ</b>\n\n${formatted}`;
  }

  /**
   * Отвечает на вопросы пользователя на основе контекста данных
   */
  async askQuestion(question, context) {
    if (!this.enabled) {
      console.log('ℹ️ AI анализ отключен');
      return null;
    }

    try {
      console.log('🤖 Обработка вопроса с AI...');

      const prompt = `Ты аналитический ассистент для сервиса Medicod - медицинского приложения для анализа крови.

📊 ДОСТУПНЫЕ ДАННЫЕ:
${context}

❓ ВОПРОС ПОЛЬЗОВАТЕЛЯ:
${question}

🎯 ЗАДАЧА:
Проанализируй доступные данные и дай краткий, конкретный ответ на вопрос пользователя.
- Используй только данные из контекста выше
- Если данных недостаточно, честно скажи об этом
- Будь конкретным, используй цифры и факты
- Формат ответа: краткий, структурированный, с эмодзи
- Максимум 500 символов

Ответь на вопрос:`;

      const response = await this.client.createCompletions({
        model: 'glm-4.6',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      });

      console.log('📦 AI ответ на вопрос:', JSON.stringify(response, null, 2));

      const answer = response.choices?.[0]?.message?.content;

      if (answer) {
        console.log('✅ AI ответ получен');
        return answer;
      }

      return null;
    } catch (error) {
      console.error('❌ Ошибка обработки вопроса AI:', error);
      return null;
    }
  }

  /**
   * Детектирует аномалии в данных
   */
  detectAnomalies(report) {
    const anomalies = [];

    // Аномалия: резкое падение платежей
    const dailyPayments = Object.values(report.payments.byDay).map(d => d.count);
    if (dailyPayments.length >= 3) {
      const recent = dailyPayments.slice(-2);
      const earlier = dailyPayments.slice(0, -2);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

      if (earlierAvg > 0 && recentAvg < earlierAvg * 0.5) {
        anomalies.push({
          type: 'payment_drop',
          severity: 'high',
          message: `Падение платежей на ${Math.round((1 - recentAvg/earlierAvg) * 100)}%`
        });
      }
    }

    // Аномалия: высокий процент ошибок
    if (report.errors.total > 50) {
      anomalies.push({
        type: 'high_errors',
        severity: 'medium',
        message: `Высокий уровень ошибок: ${report.errors.total}`
      });
    }

    // Аномалия: неиспользуемые функции
    if (report.features.ocr === 0 && report.payments.total > 20) {
      anomalies.push({
        type: 'unused_feature',
        severity: 'low',
        message: 'OCR не используется при наличии активности'
      });
    }

    return anomalies;
  }
}

export default AIAnalysisService;
