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
   * Создаёт промпт для AI анализа
   */
  createAnalysisPrompt(currentReport) {
    const { payments, errors, features } = currentReport;

    let prompt = `Ты эксперт по бизнес-аналитике SaaS приложения Medicod - медицинского сервиса для анализа крови.

📊 ТЕКУЩИЕ ДАННЫЕ (последняя неделя):

Финансы:
- Платежей: ${payments.total}
- Выручка: ${payments.revenue}₽
- Средний чек: ${payments.avgCheck}₽
- Динамика по дням: ${JSON.stringify(payments.byDay, null, 2)}

Функции:
- OCR запросов: ${features.ocr}
- AI анализов: ${features.ai}

Ошибки:
- Всего: ${errors.total}
- Webhook ошибки: ${errors.webhook}
`;

    // Добавляем исторические данные для сравнения
    if (this.historicalData.length > 0) {
      const lastWeek = this.historicalData[this.historicalData.length - 1];
      prompt += `\n📈 ДАННЫЕ ПРОШЛОЙ НЕДЕЛИ (для сравнения):
- Платежей: ${lastWeek.payments?.total || 'нет данных'}
- Выручка: ${lastWeek.payments?.revenue || 'нет данных'}₽
- Средний чек: ${lastWeek.payments?.avgCheck || 'нет данных'}₽
- OCR: ${lastWeek.features?.ocr || 0}
- AI анализов: ${lastWeek.features?.ai || 0}
- Ошибок: ${lastWeek.errors?.total || 0}
`;
    }

    prompt += `\n🎯 ЗАДАЧА:
Проанализируй данные и предоставь:

1. **🔍 КЛЮЧЕВЫЕ ИНСАЙТЫ** (2-3 пункта)
   - Важные наблюдения и аномалии
   - Положительные и негативные тренды
   - Сравнение с прошлой неделей (если есть данные)

2. **⚠️ ПРОБЛЕМЫ И РИСКИ** (1-2 пункта)
   - Что требует немедленного внимания
   - Потенциальные угрозы для бизнеса

3. **💡 РЕКОМЕНДАЦИИ** (2-3 конкретных действия)
   - Приоритетные шаги для улучшения метрик
   - Конкретные эксперименты для тестирования

4. **❓ ВОПРОСЫ ДЛЯ РАЗМЫШЛЕНИЯ** (2-3 вопроса)
   - Стратегические вопросы для владельца продукта
   - Идеи для улучшения продукта

Формат ответа: краткий, структурированный, с эмодзи. Максимум 800 символов.
Будь конкретным и actionable. Избегай общих фраз.`;

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

    return `\n\n🤖 *AI ИНСАЙТЫ*\n\n${analysis}`;
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
