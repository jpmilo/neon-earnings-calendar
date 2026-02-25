const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
async function test() {
  try {
    const res = await yahooFinance.quoteSummary('MSFT', { modules: ['earningsHistory', 'financialData', 'earnings', 'defaultKeyStatistics'] });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }
}
test();
