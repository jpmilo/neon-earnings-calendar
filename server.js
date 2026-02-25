const express = require('express');
const cors = require('cors');
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3333;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory cache for earnings data and active symbols
let earningsCache = {};
let activeSymbols = [];
let isFetching = false;

// We will cache profiles locally to avoid spamming the quoteSummary endpoint
const profilesCachePath = path.join(__dirname, 'data', 'profiles.json');
let profilesCache = {};

function loadProfilesCache() {
    try {
        if (fs.existsSync(profilesCachePath)) {
            const data = fs.readFileSync(profilesCachePath, 'utf8');
            profilesCache = JSON.parse(data);
        }
    } catch (e) {
        console.error('Error loading profiles.json:', e);
    }
}
function saveProfilesCache() {
    try {
        if (!fs.existsSync(path.join(__dirname, 'data'))) {
            fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
        }
        fs.writeFileSync(profilesCachePath, JSON.stringify(profilesCache, null, 2));
    } catch (e) {
        console.error('Error saving profiles.json:', e);
    }
}
loadProfilesCache();

async function fetchEarningsForSymbols(symbols) {
    if (isFetching || !symbols || symbols.length === 0) return;
    isFetching = true;
    activeSymbols = symbols; // Save for cron
    console.log(`Fetching earnings dates for ${symbols.length} symbols...`);

    const newCache = {};
    const batchSize = 50;

    for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        try {
            const results = await yahooFinance.quote(batch);
            for (const res of results) {
                if (res && res.symbol) {
                    newCache[res.symbol] = {
                        symbol: res.symbol,
                        shortName: res.shortName || res.longName || res.symbol,
                        exchange: res.exchange,
                        market: res.market, // Usually indicates region
                        earningsTimestamp: res.earningsTimestamp,
                        earningsTimestampStart: res.earningsTimestampStart,
                        earningsTimestampEnd: res.earningsTimestampEnd,
                        epsCurrentYear: res.epsCurrentYear,
                        epsForward: res.epsForward,
                        epsTrailingTwelveMonths: res.epsTrailingTwelveMonths,
                        trailingPE: res.trailingPE,
                        forwardPE: res.forwardPE,
                        marketCap: res.marketCap,
                        financialCurrency: res.financialCurrency,
                        regularMarketPrice: res.regularMarketPrice,
                        regularMarketChangePercent: res.regularMarketChangePercent
                    };
                }
            }
            console.log(`Fetched batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(symbols.length / batchSize)}`);
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`Error fetching batch ${i}:`, error.message);
        }
    }

    earningsCache = newCache;
    isFetching = false;
    console.log('Finished fetching earnings data.');
}

// Background profile fetching for sector/industry
let isFetchingProfiles = false;
async function fetchProfilesForSymbols(symbols) {
    if (isFetchingProfiles || !symbols || symbols.length === 0) return;

    // Only fetch for symbols we don't already have in cache
    const toFetch = symbols.filter(s => !profilesCache[s] || (Date.now() - (profilesCache[s].lastUpdated || 0) > 30 * 24 * 60 * 60 * 1000));

    if (toFetch.length === 0) {
        console.log('All profiles are up to date in cache.');
        return;
    }

    isFetchingProfiles = true;
    console.log(`Fetching profiles for ${toFetch.length} new symbols...`);

    let count = 0;
    for (const sym of toFetch) {
        try {
            const res = await yahooFinance.quoteSummary(sym, { modules: ['assetProfile'] });
            if (res && res.assetProfile) {
                profilesCache[sym] = {
                    sector: res.assetProfile.sector || 'Unknown',
                    industry: res.assetProfile.industry || 'Unknown',
                    lastUpdated: Date.now()
                };
                count++;
            } else {
                profilesCache[sym] = { sector: 'Unknown', industry: 'Unknown', lastUpdated: Date.now() };
            }
            // Save periodically
            if (count % 10 === 0) saveProfilesCache();
            // Important: sleep longer for quoteSummary to avoid bans
            await new Promise(resolve => setTimeout(resolve, 800));
        } catch (e) {
            console.warn(`Failed to fetch profile for ${sym}:`, e.message);
            profilesCache[sym] = { sector: 'Unknown', industry: 'Unknown', lastUpdated: Date.now() };
        }
    }

    saveProfilesCache();
    isFetchingProfiles = false;
    console.log('Finished fetching profile data.');
}


// Refresh data every day at 1 AM
cron.schedule('0 1 * * *', () => {
    console.log('Running daily earnings data refresh...');
    fetchEarningsForSymbols(activeSymbols);
});

// API endpoint to get all cached earnings
app.get('/api/earnings', (req, res) => {
    res.json({
        status: isFetching ? 'updating' : 'ready',
        data: Object.values(earningsCache)
    });
});

// API endpoint to get all cached profiles
app.get('/api/profiles', (req, res) => {
    res.json({
        status: isFetchingProfiles ? 'updating' : 'ready',
        data: profilesCache
    });
});

// API endpoint to force refresh or add new symbols
app.post('/api/earnings/refresh', async (req, res) => {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({ error: 'Please provide an array of symbols' });
    }

    res.json({ message: 'Refresh started.' });

    // Kick off both data tasks background
    activeSymbols = [...new Set([...activeSymbols, ...symbols])];

    // Process earnings (fast)
    fetchEarningsForSymbols(symbols).catch(console.error);

    // Process profiles (slow, throttled)
    fetchProfilesForSymbols(symbols).catch(console.error);
});
// API endpoint to batch save stocks back into index.html
app.post('/api/save-stocks', (req, res) => {
    const { symbols } = req.body;
    if (!symbols || !Array.isArray(symbols)) {
        return res.status(400).json({ error: 'Array of symbols is required' });
    }

    try {
        const indexPath = path.join(__dirname, 'public', 'index.html');
        let htmlContent = fs.readFileSync(indexPath, 'utf-8');

        // We need to replace the window.USER_STOCKS = [...] array content precisely.
        // It's multi-line, so a regex with `s` flag (dotAll) or matching from `window.USER_STOCKS = [` to `];` is needed.
        const regex = /window\.USER_STOCKS\s*=\s*\[(.*?)\];/s;

        if (!regex.test(htmlContent)) {
            return res.status(500).json({ error: 'Could not find window.USER_STOCKS array in index.html' });
        }

        // Format the new array nicely, e.g., 10 items per line or just one big string, but let's do JSON stringify
        const newArrayStr = JSON.stringify(symbols, null, 2);

        const newHtmlContent = htmlContent.replace(regex, `window.USER_STOCKS = ${newArrayStr};`);

        fs.writeFileSync(indexPath, newHtmlContent, 'utf-8');
        console.log(`Successfully rewrote index.html with ${symbols.length} custom stocks.`);

        res.json({ success: true, count: symbols.length });
    } catch (e) {
        console.error('Error saving stocks to index.html:', e);
        res.status(500).json({ error: 'Failed to rewrite stock list.' });
    }
});

// API endpoint to get on-demand actual financials
app.get('/api/financials/:symbol', async (req, res) => {
    const symbol = req.params.symbol;
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol is required' });
    }

    try {
        const result = await yahooFinance.quoteSummary(symbol, { modules: ['earningsHistory', 'financialData', 'earnings'] });

        // Extract the most recent actual earnings
        let actualEps = null;
        let surprisePct = null;
        let revenue = null;

        let day1Move = null;

        if (result.earningsHistory && result.earningsHistory.history && result.earningsHistory.history.length > 0) {
            // Usually the last item is the most recent reported quarter
            const history = result.earningsHistory.history;
            const latest = history[history.length - 1]; // or find the one with the most recent date
            actualEps = latest.epsActual;
            surprisePct = latest.surprisePercent;

            // Fetch Day 1 Move
            try {
                if (result.earnings && result.earnings.earningsChart && result.earnings.earningsChart.quarterly) {
                    const quarters = result.earnings.earningsChart.quarterly;
                    const latestReport = quarters[quarters.length - 1];
                    if (latestReport && latestReport.reportedDate) {
                        const repTime = latestReport.reportedDate;
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

                        console.log(`[DEBUG actuals API] ${symbol} repTime: ${repTime}, repDateStr: ${repDateStr}, repIndex: ${repIndex}, quotes: ${quotes.length}`);

                        if (repIndex !== -1 && repIndex > 0) {
                            const gap1 = (quotes[repIndex].close - quotes[repIndex - 1].close) / quotes[repIndex - 1].close;
                            let gap2 = 0;
                            if (repIndex + 1 < quotes.length) {
                                gap2 = (quotes[repIndex + 1].close - quotes[repIndex].close) / quotes[repIndex].close;
                            }
                            // Pick max absolute reaction between BMO or AMC possibility
                            day1Move = (Math.abs(gap1) > Math.abs(gap2)) ? gap1 : gap2;
                            console.log(`[DEBUG actuals API] ${symbol} gap1: ${gap1}, gap2: ${gap2}, final: ${day1Move}`);
                        } else {
                            console.log(`[DEBUG actuals API] repIndex not found or is 0. Data: `, quotes.slice(0, 5));
                        }
                    } else {
                        console.log(`[DEBUG actuals API] latestReport or reportedDate missing`, latestReport);
                    }
                } else {
                    console.log(`[DEBUG actuals API] No earnings chart quarterly data available.`);
                }
            } catch (calcError) {
                console.warn(`Failed to compute Day 1 Move for ${symbol}:`, calcError.message);
            }
        }

        if (result.financialData) {
            revenue = result.financialData.totalRevenue;
        }

        res.json({
            symbol,
            actualEps,
            surprisePct,
            revenue,
            day1Move,
            financialCurrency: result.financialData ? result.financialData.financialCurrency : 'USD'
        });

    } catch (e) {
        console.error(`Error fetching financials for ${symbol}:`, e.message);
        res.status(500).json({ error: 'Failed to fetch financials' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
