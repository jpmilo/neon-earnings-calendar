const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();

async function getEarningsAction(symbol) {
    try {
        const quoteSum = await yahooFinance.quoteSummary(symbol, { modules: ['earnings'] });
        const quarters = quoteSum.earnings.earningsChart.quarterly;
        const latestInfo = quarters[quarters.length - 1];
        const repTime = latestInfo.reportedDate;

        const startDate = new Date((repTime - 7 * 86400) * 1000);
        const endDate = new Date((repTime + 7 * 86400) * 1000);

        const chart = await yahooFinance.chart(symbol, {
            period1: startDate.toISOString().split('T')[0],
            period2: endDate.toISOString().split('T')[0],
            interval: '1d'
        });

        const quotes = chart.quotes.filter(q => q.close !== null).map(q => ({
            date: q.date.toISOString().split('T')[0],
            close: q.close
        }));

        const repDateStr = new Date(repTime * 1000).toISOString().split('T')[0];
        const repIndex = quotes.findIndex(q => q.date === repDateStr);

        console.log(`Reported Date: ${repDateStr} UTC for ${symbol} | Time: ${new Date(repTime * 1000).toISOString()}`);

        let day1Move = null;
        if (repIndex !== -1 && repIndex > 0) {
            // Gap 1 (BMO of repDateStr)
            const gap1 = (quotes[repIndex].close - quotes[repIndex - 1].close) / quotes[repIndex - 1].close;
            // Gap 2 (AMC of repDateStr -> next trading day)
            let gap2 = 0;
            if (repIndex + 1 < quotes.length) {
                gap2 = (quotes[repIndex + 1].close - quotes[repIndex].close) / quotes[repIndex].close;
            }

            // Pick max absolute
            if (Math.abs(gap1) > Math.abs(gap2)) {
                day1Move = gap1;
                console.log(`Identified BMO reaction. Gap1: ${(gap1 * 100).toFixed(2)}%, Gap2: ${(gap2 * 100).toFixed(2)}%`);
            } else {
                day1Move = gap2;
                console.log(`Identified AMC reaction. Gap1: ${(gap1 * 100).toFixed(2)}%, Gap2: ${(gap2 * 100).toFixed(2)}%`);
            }
        }

        console.log(`Final Day 1 Move for ${symbol}: ${(day1Move * 100).toFixed(2)}%\n`);

    } catch (e) {
        console.error(e.message);
    }
}

async function testAll() {
    await getEarningsAction('MSFT');
    await getEarningsAction('META'); // check someone else
}

testAll();
