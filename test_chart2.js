const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test(symbol) {
  try {
    const quoteSum = await yahooFinance.quoteSummary(symbol, { modules: ['earnings'] });
    const quarters = quoteSum.earnings.earningsChart.quarterly;
    const latest = quarters[quarters.length - 1];
    
    console.log("Latest reported date:", latest.reportedDate);
    const repDate = new Date(latest.reportedDate * 1000);
    console.log("Rep Date Object:", repDate.toISOString());

    const start = new Date(repDate); start.setDate(start.getDate() - 5);
    const end = new Date(repDate); end.setDate(end.getDate() + 5);

    const chart = await yahooFinance.chart(symbol, {
      period1: start.toISOString().split('T')[0],
      period2: end.toISOString().split('T')[0],
      interval: '1d'
    });

    console.table(chart.quotes.map(q => ({
      dateIso: q.date.toISOString(),
      timestamp: Math.floor(q.date.getTime() / 1000),
      open: q.open,
      close: q.close
    })));

  } catch (e) {
    console.error(e);
  }
}

test('MSFT');
