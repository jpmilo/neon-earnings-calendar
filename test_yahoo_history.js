const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function test(symbol, earningsDateStr) {
  try {
    const earningsDate = new Date(earningsDateStr);
    
    // We want to fetch historical prices around the earnings date
    // Let's get a window of a few days before and after
    const startDate = new Date(earningsDate);
    startDate.setDate(startDate.getDate() - 3);
    
    const endDate = new Date(earningsDate);
    endDate.setDate(endDate.getDate() + 5);

    const queryOptions = {
      period1: startDate.toISOString().split('T')[0],
      period2: endDate.toISOString().split('T')[0],
      interval: '1d' // 1 day interval
    };

    console.log(`Fetching history for ${symbol} from ${queryOptions.period1} to ${queryOptions.period2}`);
    const result = await yahooFinance.historical(symbol, queryOptions);
    
    console.log("Historical Data:");
    console.table(result.map(r => ({
      date: r.date.toISOString().split('T')[0],
      open: r.open.toFixed(2),
      close: r.close.toFixed(2),
      volume: r.volume
    })));

  } catch (e) {
    console.error(e);
  }
}

// MSFT reported on 2026-01-29
test('MSFT', '2026-01-29');
