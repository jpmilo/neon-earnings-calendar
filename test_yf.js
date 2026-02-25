const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function run() {
    try {
        const res1 = await yahooFinance.quote('AAPL');
        console.log("Quote sector:", res1.sector, "industry:", res1.industry);
        console.log("Exchange:", res1.exchange, "Market:", res1.market);

        const res2 = await yahooFinance.quoteSummary('AAPL', { modules: ['assetProfile'] });
        console.log("Profile sector:", res2.assetProfile?.sector, "industry:", res2.assetProfile?.industry);
    } catch (e) {
        console.error(e);
    }
}
run();
