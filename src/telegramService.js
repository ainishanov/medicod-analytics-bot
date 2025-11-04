/**
 * Telegram Service
 * Отправка сообщений через Telegram Bot API
 */

import fetch from 'node-fetch';

class TelegramService {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
  }

  /**
   * Отправляет сообщение
   */
  async sendMessage(text, parseMode = 'Markdown', replyMarkup = null) {
    try {
      console.log('📤 Отправка сообщения в Telegram...');

      const body = {
        chat_id: this.chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      };

      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }

      const response = await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
      }

      const data = await response.json();

      if (!data.ok) {
        throw new Error(`Telegram error: ${data.description}`);
      }

      console.log('✅ Сообщение отправлено в Telegram');
      return { success: true, data };

    } catch (error) {
      console.error('❌ Ошибка отправки в Telegram:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Создает inline клавиатуру
   */
  createInlineKeyboard(buttons) {
    return {
      inline_keyboard: buttons
    };
  }

  /**
   * Создает reply клавиатуру
   */
  createReplyKeyboard(buttons, options = {}) {
    return {
      keyboard: buttons,
      resize_keyboard: options.resize !== false,
      one_time_keyboard: options.oneTime || false,
      selective: options.selective || false
    };
  }

  /**
   * Проверяет работоспособность бота
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.apiUrl}/getMe`);
      const data = await response.json();

      if (data.ok) {
        return {
          status: 'ok',
          bot: {
            username: data.result.username,
            name: data.result.first_name
          }
        };
      } else {
        return {
          status: 'error',
          message: data.description
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

export default TelegramService;
