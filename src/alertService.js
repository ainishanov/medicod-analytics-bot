/**
 * Alert Service
 * Детектирует аномалии и отправляет критические уведомления
 */

class AlertService {
  constructor() {
    this.businessGoals = {
      monthlyRevenue: 30000,
      weeklyRevenue: 7500,
      dailyRevenue: 1000,
      avgCheckTarget: 100,
      errorRateMax: 5,
      ocrAdoptionTarget: 20,
      aiAdoptionTarget: 30
    };
  }

  /**
   * Проверяет все условия и возвращает алерты
   */
  checkAlerts(report) {
    const alerts = {
      critical: [],
      warning: [],
      opportunity: []
    };

    // Проверяем критические условия
    this.checkCriticalAlerts(report, alerts);

    // Проверяем предупреждения
    this.checkWarningAlerts(report, alerts);

    // Проверяем возможности
    this.checkOpportunityAlerts(report, alerts);

    return alerts;
  }

  /**
   * Критические алерты
   */
  checkCriticalAlerts(report, alerts) {
    const { payments, errors, comparison } = report;

    // 1. Резкое падение revenue >20%
    if (comparison?.payments?.revenue?.percent < -20) {
      alerts.critical.push({
        type: 'revenue_drop',
        severity: 'critical',
        emoji: '🚨',
        title: 'Критическое падение выручки',
        message: `Выручка упала на ${Math.abs(comparison.payments.revenue.percent)}% за неделю`,
        impact: `Потеряно ${Math.abs(comparison.payments.revenue.absolute)}₽`,
        action: 'Срочно проверить webhook ошибки и маркетинговые каналы'
      });
    }

    // 2. Error rate >50 ошибок
    if (errors.total > 50) {
      const errorRate = payments.total > 0 ? Math.round((errors.total / payments.total) * 100) : 0;
      alerts.critical.push({
        type: 'high_errors',
        severity: 'critical',
        emoji: '🚨',
        title: 'Критический уровень ошибок',
        message: `${errors.total} ошибок (${errorRate}% от транзакций)`,
        impact: `Потенциально блокирует ~${Math.round(errors.total * 0.3)} транзакций`,
        action: 'Проверить логи и исправить webhook интеграцию'
      });
    }

    // 3. Webhook ошибки блокируют транзакции
    if (errors.webhook > payments.total * 0.5) {
      alerts.critical.push({
        type: 'webhook_blocking',
        severity: 'critical',
        emoji: '🚨',
        title: 'Webhook блокируют платежи',
        message: `${errors.webhook} webhook ошибок при ${payments.total} платежах`,
        impact: `Теряем ~${Math.round(errors.webhook * payments.avgCheck * 0.5)}₽/неделю`,
        action: 'НЕМЕДЛЕННО исправить webhook интеграцию'
      });
    }

    // 4. AI adoption <5% (критически низкий)
    const aiAdoption = payments.total > 0 ? Math.round((report.features.ai / payments.total) * 100) : 0;
    if (payments.total > 50 && aiAdoption < 5) {
      alerts.critical.push({
        type: 'low_ai_adoption',
        severity: 'critical',
        emoji: '🚨',
        title: 'Критически низкий AI adoption',
        message: `Только ${aiAdoption}% пользователей используют AI анализ`,
        impact: 'Пользователи не получают ключевую ценность продукта',
        action: 'Проверить onboarding и доступность AI функции'
      });
    }
  }

  /**
   * Предупреждения
   */
  checkWarningAlerts(report, alerts) {
    const { payments, errors, features, comparison } = report;

    // 1. Revenue не растет 2 недели подряд
    if (comparison?.payments?.revenue?.trend === 'down' ||
        comparison?.payments?.revenue?.trend === 'stable') {
      const revenueGap = this.businessGoals.weeklyRevenue - payments.revenue;
      alerts.warning.push({
        type: 'revenue_stagnation',
        severity: 'warning',
        emoji: '⚠️',
        title: 'Выручка не растет',
        message: `${payments.revenue}₽ (${Math.round((payments.revenue / this.businessGoals.weeklyRevenue) * 100)}% от цели)`,
        impact: `Не хватает ${revenueGap}₽ до цели`,
        action: 'Запустить эксперименты для роста: ценообразование, маркетинг, retention'
      });
    }

    // 2. Падение платежей
    if (comparison?.payments?.total?.percent < -10) {
      alerts.warning.push({
        type: 'payments_decline',
        severity: 'warning',
        emoji: '⚠️',
        title: 'Падение количества платежей',
        message: `${payments.total} платежей (${comparison.payments.total.percent}% WoW)`,
        impact: 'Уменьшение активной пользовательской базы',
        action: 'Проверить acquisition каналы и retention'
      });
    }

    // 3. Средний чек далеко от цели
    const checkGap = this.businessGoals.avgCheckTarget - payments.avgCheck;
    if (checkGap > 30) {
      alerts.warning.push({
        type: 'low_avg_check',
        severity: 'warning',
        emoji: '⚠️',
        title: 'Средний чек ниже цели',
        message: `${payments.avgCheck}₽ (цель: ${this.businessGoals.avgCheckTarget}₽)`,
        impact: `Потенциал роста revenue на ${Math.round((checkGap / payments.avgCheck) * 100)}%`,
        action: 'A/B тест повышения цены или upsell'
      });
    }

    // 4. OCR adoption низкий
    const ocrAdoption = payments.total > 0 ? Math.round((features.ocr / payments.total) * 100) : 0;
    if (ocrAdoption < this.businessGoals.ocrAdoptionTarget) {
      alerts.warning.push({
        type: 'low_ocr_adoption',
        severity: 'warning',
        emoji: '⚠️',
        title: 'Низкий OCR adoption',
        message: `${ocrAdoption}% (цель: ${this.businessGoals.ocrAdoptionTarget}%)`,
        impact: 'Барьер для пользователей, влияет на retention',
        action: 'Упростить UX загрузки фото, добавить onboarding'
      });
    }

    // 5. Рост ошибок
    if (comparison?.errors?.total?.percent > 20) {
      alerts.warning.push({
        type: 'errors_growth',
        severity: 'warning',
        emoji: '⚠️',
        title: 'Рост ошибок',
        message: `${errors.total} ошибок (+${comparison.errors.total.percent}% WoW)`,
        impact: 'Ухудшение user experience',
        action: 'Мониторить логи и fix основные причины'
      });
    }
  }

  /**
   * Возможности (положительные сигналы)
   */
  checkOpportunityAlerts(report, alerts) {
    const { payments, errors, features, comparison } = report;

    // 1. Сильный рост revenue
    if (comparison?.payments?.revenue?.percent > 50) {
      alerts.opportunity.push({
        type: 'revenue_surge',
        severity: 'opportunity',
        emoji: '💡',
        title: 'Сильный рост выручки!',
        message: `+${comparison.payments.revenue.percent}% WoW`,
        impact: `+${comparison.payments.revenue.absolute}₽ за неделю`,
        action: 'Проанализировать: что сработало? Масштабировать успешные каналы'
      });
    }

    // 2. Рост среднего чека
    if (comparison?.payments?.avgCheck?.percent > 15) {
      alerts.opportunity.push({
        type: 'avgcheck_growth',
        severity: 'opportunity',
        emoji: '💡',
        title: 'Рост среднего чека',
        message: `${payments.avgCheck}₽ (+${comparison.payments.avgCheck.percent}% WoW)`,
        impact: 'Улучшение монетизации',
        action: 'Что изменилось? Продолжить в том же направлении'
      });
    }

    // 3. Хороший AI adoption
    const aiAdoption = payments.total > 0 ? Math.round((features.ai / payments.total) * 100) : 0;
    if (aiAdoption > this.businessGoals.aiAdoptionTarget) {
      alerts.opportunity.push({
        type: 'high_ai_adoption',
        severity: 'opportunity',
        emoji: '💡',
        title: 'Отличный AI adoption!',
        message: `${aiAdoption}% пользователей используют AI`,
        impact: 'Высокая вовлеченность в ключевую фичу',
        action: 'Собрать feedback и улучшать AI дальше'
      });
    }

    // 4. Падение ошибок
    if (comparison?.errors?.total?.percent < -30) {
      alerts.opportunity.push({
        type: 'errors_decrease',
        severity: 'opportunity',
        emoji: '💡',
        title: 'Снижение ошибок',
        message: `${errors.total} ошибок (${comparison.errors.total.percent}% WoW)`,
        impact: 'Улучшение стабильности системы',
        action: 'Отлично! Продолжить мониторинг'
      });
    }

    // 5. Достигнута цель revenue
    if (payments.revenue >= this.businessGoals.weeklyRevenue) {
      alerts.opportunity.push({
        type: 'revenue_goal_achieved',
        severity: 'opportunity',
        emoji: '🎉',
        title: 'Цель по выручке достигнута!',
        message: `${payments.revenue}₽ (${Math.round((payments.revenue / this.businessGoals.weeklyRevenue) * 100)}% от цели)`,
        impact: 'Отличная работа!',
        action: 'Повысить планку: новая цель ${Math.round(this.businessGoals.weeklyRevenue * 1.2)}₽/неделю'
      });
    }
  }

  /**
   * Форматирует алерты для Telegram
   */
  formatAlertsForTelegram(alerts) {
    let message = '';

    // Критические алерты
    if (alerts.critical.length > 0) {
      message += `\n\n🚨 *КРИТИЧЕСКИЕ ПРОБЛЕМЫ*\n`;
      alerts.critical.forEach((alert, i) => {
        message += `\n${i + 1}. *${alert.title}*\n`;
        message += `   ${alert.message}\n`;
        message += `   💥 Impact: ${alert.impact}\n`;
        message += `   🎯 Действие: ${alert.action}\n`;
      });
    }

    // Предупреждения
    if (alerts.warning.length > 0) {
      message += `\n\n⚠️ *ТРЕБУЮТ ВНИМАНИЯ*\n`;
      alerts.warning.forEach((alert, i) => {
        message += `\n${i + 1}. *${alert.title}*\n`;
        message += `   ${alert.message}\n`;
        message += `   📊 Impact: ${alert.impact}\n`;
        message += `   💡 Действие: ${alert.action}\n`;
      });
    }

    // Возможности
    if (alerts.opportunity.length > 0) {
      message += `\n\n💡 *ВОЗМОЖНОСТИ*\n`;
      alerts.opportunity.forEach((alert, i) => {
        message += `\n${i + 1}. *${alert.title}*\n`;
        message += `   ${alert.message}\n`;
        message += `   ✨ Impact: ${alert.impact}\n`;
        message += `   🚀 Действие: ${alert.action}\n`;
      });
    }

    return message;
  }

  /**
   * Проверяет, нужно ли отправлять немедленное уведомление
   */
  shouldSendImmediateAlert(alerts) {
    // Отправляем если есть критические алерты
    return alerts.critical.length > 0;
  }

  /**
   * Создает краткое резюме алертов
   */
  getAlertsSummary(alerts) {
    const total = alerts.critical.length + alerts.warning.length + alerts.opportunity.length;

    if (total === 0) {
      return '✅ Все в порядке';
    }

    const parts = [];
    if (alerts.critical.length > 0) {
      parts.push(`🚨 ${alerts.critical.length} критических`);
    }
    if (alerts.warning.length > 0) {
      parts.push(`⚠️ ${alerts.warning.length} предупреждений`);
    }
    if (alerts.opportunity.length > 0) {
      parts.push(`💡 ${alerts.opportunity.length} возможностей`);
    }

    return parts.join(', ');
  }
}

export default AlertService;
