const Database = require('better-sqlite3');
const db = new Database('/var/www/medicod-backend/data/medicod.db', { readonly: true });

console.log('=== ПОСЛЕДНИЕ 7 ДНЕЙ ===');
const last7days = db.prepare(`
  SELECT date(created_at) as day,
         COUNT(*) as payments,
         SUM(amount) as revenue
  FROM payments_unified
  WHERE created_at >= datetime('now', '-7 days')
  GROUP BY date(created_at)
  ORDER BY day DESC
`).all();
console.table(last7days);

console.log('\n=== ВЧЕРА ===');
const yesterday = db.prepare(`
  SELECT COUNT(*) as payments,
         SUM(amount) as revenue
  FROM payments_unified
  WHERE date(created_at) = date('now', '-1 day')
`).get();
console.log('Платежей:', yesterday.payments, '| Выручка:', yesterday.revenue, '₽');

console.log('\n=== СЕГОДНЯ ===');
const today = db.prepare(`
  SELECT COUNT(*) as payments,
         SUM(amount) as revenue
  FROM payments_unified
  WHERE date(created_at) = date('now')
`).get();
console.log('Платежей:', today.payments, '| Выручка:', today.revenue, '₽');

console.log('\n=== ОБЩАЯ СТАТИСТИКА ===');
const total = db.prepare(`
  SELECT COUNT(*) as total_payments,
         SUM(amount) as total_revenue,
         MIN(created_at) as first_payment,
         MAX(created_at) as last_payment
  FROM payments_unified
`).get();
console.log('Всего платежей:', total.total_payments);
console.log('Общая выручка:', total.total_revenue, '₽');
console.log('Первый платёж:', total.first_payment);
console.log('Последний платёж:', total.last_payment);

console.log('\n=== ПОСЛЕДНИЕ 5 ПЛАТЕЖЕЙ ===');
const recent = db.prepare(`
  SELECT id, amount, status, created_at
  FROM payments_unified
  ORDER BY created_at DESC
  LIMIT 5
`).all();
console.table(recent);

db.close();
