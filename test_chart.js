const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test(symbol, dateStr) {
  try {
    const d = new Date(dateStr);
    const start = new Date(d); start.setDate(start.getDate() - 3);
    const end = new Date(d); end.setDate(end.getDate() + 5);
    const res = await yahooFinance.chart(symbol, {
      period1: start.toISOString().split('T')[0],
      period2: end.toISOString().split('T')[0],
      interval: '1d'
    });
    console.log("Chart Quotes:");
    console.table(res.quotes.map(q => ({
        date: q.date.toISOString().split('T')[0],
        close: q.close ? q.close.toFixed(2) : null
    })));
  } catch (e) {
    console.error(e);
  }
}

test('MSFT', '2026-01-29');
