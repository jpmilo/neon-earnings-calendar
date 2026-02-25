const yahooFinance = require('yahoo-finance2').default;
async function test() {
  const chart = await yahooFinance.chart('0700.HK', {
    period1: '2025-11-01',
    period2: '2025-11-15',
    interval: '1d'
  });
  console.log(chart.quotes[0].date.toISOString());
}
test();
