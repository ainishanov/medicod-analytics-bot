/**
 * Yandex Metrika Service
 * Получает статистику посещений из Яндекс.Метрики
 *
 * Примечание: Для работы нужен OAuth токен от Яндекс.Метрики
 * https://oauth.yandex.ru/authorize?response_type=token&client_id=YOUR_CLIENT_ID
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

class YandexMetrikaService {
  constructor() {
    this.counterId = process.env.YANDEX_METRIKA_COUNTER_ID || '102952148';
    this.token = process.env.YANDEX_METRIKA_TOKEN;
    this.apiUrl = 'https://api-metrika.yandex.net/stat/v1/data';
    this.enabled = !!this.token;

    if (!this.enabled) {
      console.log('⚠️ Яндекс.Метрика отключена: YANDEX_METRIKA_TOKEN не задан');
    } else {
      console.log(`✅ Яндекс.Метрика подключена: счетчик ${this.counterId}`);
    }
  }

  /**
   * Получает данные из Яндекс.Метрики
   */
  async fetchData(params) {
    if (!this.enabled) {
      return null;
    }

    try {
      const queryParams = new URLSearchParams({
        id: this.counterId,
        oauth_token: this.token,
        accuracy: 'full',
        ...params
      });

      const response = await fetch(`${this.apiUrl}?${queryParams}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Яндекс.Метрика API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('❌ Ошибка получения данных из Яндекс.Метрики:', error.message);
      return null;
    }
  }

  /**
   * Получает количество визитов за период
   */
  async getVisits(date1, date2) {
    const data = await this.fetchData({
      metrics: 'ym:s:visits,ym:s:users,ym:s:pageviews',
      date1,
      date2,
      group: 'day'
    });

    if (!data || !data.data) {
      return {
        visits: 0,
        users: 0,
        pageviews: 0,
        byDay: {}
      };
    }

    const totals = data.totals || [0, 0, 0];
    const byDay = {};

    // Группируем по дням
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        const dimensions = item.dimensions || [];
        const metrics = item.metrics || [0, 0, 0];

        if (dimensions.length > 0) {
          const date = dimensions[0].name;
          byDay[date] = {
            visits: metrics[0] || 0,
            users: metrics[1] || 0,
            pageviews: metrics[2] || 0
          };
        }
      });
    }

    return {
      visits: totals[0] || 0,
      users: totals[1] || 0,
      pageviews: totals[2] || 0,
      byDay
    };
  }

  /**
   * Получает целевые действия (конверсии)
   */
  async getGoals(date1, date2) {
    const data = await this.fetchData({
      metrics: 'ym:s:goal<goal_id>reaches',
      date1,
      date2
    });

    if (!data || !data.totals) {
      return {
        total: 0,
        goals: {}
      };
    }

    return {
      total: data.totals[0] || 0,
      goals: {}
    };
  }

  /**
   * Получает источники трафика
   */
  async getTrafficSources(date1, date2) {
    const data = await this.fetchData({
      metrics: 'ym:s:visits',
      dimensions: 'ym:s:trafficSource',
      date1,
      date2
    });

    if (!data || !data.data) {
      return {
        direct: 0,
        search: 0,
        social: 0,
        referral: 0,
        other: 0
      };
    }

    const sources = {
      direct: 0,
      search: 0,
      social: 0,
      referral: 0,
      other: 0
    };

    data.data.forEach(item => {
      const sourceName = item.dimensions?.[0]?.name?.toLowerCase() || 'other';
      const visits = item.metrics?.[0] || 0;

      if (sourceName.includes('direct') || sourceName.includes('прямые')) {
        sources.direct += visits;
      } else if (sourceName.includes('search') || sourceName.includes('поиск')) {
        sources.search += visits;
      } else if (sourceName.includes('social') || sourceName.includes('соц')) {
        sources.social += visits;
      } else if (sourceName.includes('referral') || sourceName.includes('ссылки')) {
        sources.referral += visits;
      } else {
        sources.other += visits;
      }
    });

    return sources;
  }

  /**
   * Форматирует дату для API (YYYY-MM-DD)
   */
  formatDate(daysAgo = 0) {
    const date = new Date();
    date.setDate(date.setDate() - daysAgo);
    return date.toISOString().split('T')[0];
  }

  /**
   * Получает статистику за последние N дней
   */
  async getStats(days = 7) {
    if (!this.enabled) {
      console.log('⚠️ Яндекс.Метрика отключена');
      return null;
    }

    const date2 = this.formatDate(0);  // сегодня
    const date1 = this.formatDate(days); // N дней назад

    console.log(`📊 Получение статистики из Яндекс.Метрики за ${days} дней (${date1} - ${date2})...`);

    const [visits, sources] = await Promise.all([
      this.getVisits(date1, date2),
      this.getTrafficSources(date1, date2)
    ]);

    return {
      visits,
      sources,
      period: {
        from: date1,
        to: date2,
        days
      }
    };
  }
}

export default YandexMetrikaService;
