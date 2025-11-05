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
    const { payments, errors, features, comparison } = currentReport;

    // Бизнес-цели и контекст
    const businessGoals = {
      monthlyRevenue: 30000,
      weeklyRevenue: 7500,
      dailyRevenue: 1000,
      avgCheckTarget: 100,
      conversionRate: 10,
      errorRateMax: 5,
      ocrAdoptionTarget: 20,
      aiAdoptionTarget: 30
    };

    let prompt = `Ты эксперт по бизнес-аналитике SaaS приложения Medicod - медицинского сервиса для анализа крови.

🎯 БИЗНЕС-ЦЕЛИ:
- Целевая выручка: ${businessGoals.weeklyRevenue}₽/неделю (${businessGoals.monthlyRevenue}₽/месяц)
- Целевая выручка в день: ${businessGoals.dailyRevenue}₽
- Целевой средний чек: ${businessGoals.avgCheckTarget}₽
- Целевой adoption rate OCR: ${businessGoals.ocrAdoptionTarget}%
- Целевой adoption rate AI: ${businessGoals.aiAdoptionTarget}%
- Максимум ошибок: ${businessGoals.errorRateMax}%

📊 ТЕКУЩИЕ ДАННЫЕ (последняя неделя):

Финансы:
- Платежей: ${payments.total}`;

    if (comparison?.payments?.total) {
      const c = comparison.payments.total;
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous})`;
    }

    prompt += `\n- Выручка: ${payments.revenue}₽`;

    if (comparison?.payments?.revenue) {
      const c = comparison.payments.revenue;
      const revenueGap = businessGoals.weeklyRevenue - payments.revenue;
      const progress = Math.round((payments.revenue / businessGoals.weeklyRevenue) * 100);
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous}₽)
  ↳ ${progress}% от целевой выручки (не хватает ${revenueGap}₽)`;
    }

    prompt += `\n- Средний чек: ${payments.avgCheck}₽`;

    if (comparison?.payments?.avgCheck) {
      const c = comparison.payments.avgCheck;
      const checkGap = businessGoals.avgCheckTarget - payments.avgCheck;
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous}₽)
  ↳ на ${checkGap}₽ ниже цели (${businessGoals.avgCheckTarget}₽)`;
    }

    prompt += `\n- Динамика по дням: ${JSON.stringify(payments.byDay, null, 2)}

Функции:
- OCR запросов: ${features.ocr}`;

    if (comparison?.features?.ocr) {
      const c = comparison.features.ocr;
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous})`;
    }

    const ocrAdoption = payments.total > 0 ? Math.round((features.ocr / payments.total) * 100) : 0;
    prompt += `
  ↳ Adoption rate: ${ocrAdoption}% (цель: ${businessGoals.ocrAdoptionTarget}%)`;

    prompt += `\n- AI анализов: ${features.ai}`;

    if (comparison?.features?.ai) {
      const c = comparison.features.ai;
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous})`;
    }

    const aiAdoption = payments.total > 0 ? Math.round((features.ai / payments.total) * 100) : 0;
    prompt += `
  ↳ Adoption rate: ${aiAdoption}% (цель: ${businessGoals.aiAdoptionTarget}%)`;

    prompt += `

Ошибки:
- Всего: ${errors.total}`;

    if (comparison?.errors?.total) {
      const c = comparison.errors.total;
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous})`;
    }

    prompt += `\n- Webhook ошибки: ${errors.webhook}`;

    if (comparison?.errors?.webhook) {
      const c = comparison.errors.webhook;
      prompt += ` (${c.percent > 0 ? '+' : ''}${c.percent}% WoW, было ${c.previous})`;
    }

    const errorRate = payments.total > 0 ? Math.round((errors.total / payments.total) * 100) : 0;
    prompt += `
  ↳ Error rate: ${errorRate}% (макс: ${businessGoals.errorRateMax}%)`;

    // Корреляционный анализ
    prompt += `

🔗 КОРРЕЛЯЦИИ ДЛЯ АНАЛИЗА:
- Влияние ошибок на выручку
- Связь между OCR/AI adoption и retention
- Паттерны по дням недели
- Влияние среднего чека на количество платежей`;

    prompt += `

🎯 ЗАДАЧА:
Проанализируй данные в контексте бизнес-целей и предоставь:

1. **🔍 КЛЮЧЕВЫЕ ИНСАЙТЫ** (2-3 пункта)
   - Прогресс по целям (достигаем или отстаем?)
   - WoW тренды (что растет/падает и почему?)
   - Аномалии и неожиданные паттерны

2. **⚠️ ПРОБЛЕМЫ И РИСКИ** (1-2 пункта)
   - Что блокирует достижение целей?
   - Критические проблемы требующие немедленного внимания
   - Потенциальные риски для revenue/retention

3. **💡 ТОП-3 ДЕЙСТВИЯ** (приоритетные по impact)
   - Конкретные шаги с ожидаемым эффектом
   - A/B тесты или эксперименты для запуска
   - Quick wins (низкие усилия, высокий impact)

4. **📊 НЕДОСТАЮЩИЕ ДАННЫЕ** (1-2 метрики)
   - Какие метрики помогли бы лучше понять путь к целям?
   - Что нужно начать отслеживать для принятия решений?
   - Какая информация о пользователях/поведении отсутствует?

5. **❓ ВОПРОСЫ ДЛЯ ИССЛЕДОВАНИЯ** (1-2 вопроса)
   - Что нужно выяснить для принятия решений?
   - Гипотезы для проверки

Формат ответа: краткий, структурированный, с эмодзи. Максимум 1000 символов.
Будь конкретным и actionable. Фокусируйся на biggest impact действиях.`;

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
