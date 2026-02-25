const calendarGrid = document.getElementById('calendarGrid');
const currentMonthLabel = document.getElementById('currentMonthStr');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const syncStatus = document.querySelector('.status-dot');
const syncText = document.getElementById('statusText');
const sidebarList = document.getElementById('sidebarList');

const modal = document.getElementById('detailsModal');
const closeModalBtn = document.getElementById('closeModal');
const addStockBtn = document.getElementById('addStockBtn');
const newStockInput = document.getElementById('newStockInput');

let currentDate = new Date();
let earningsData = [];
// Unified list
let activeStocks = [...(window.USER_STOCKS || [])];

// State
let allEarningsMap = new Map(); // key: YYYY-MM-DD, value: array of quote objects
let profileData = {}; // target for /api/profiles

// Store collapsed state for sidebar
let collapsedMarkets = new Set();
let collapsedIndustries = new Set();

async function fetchEarningsData() {
    try {
        syncStatus.className = 'status-dot syncing';
        syncText.textContent = 'Syncing...';

        const response = await fetch('/api/earnings');
        const result = await response.json();

        earningsData = result.data;

        if (result.status === 'updating') {
            syncStatus.className = 'status-dot syncing';
            syncText.textContent = 'Fetching Background Data...';
            setTimeout(fetchEarningsData, 5000);
        } else {
            syncStatus.className = 'status-dot ready';
            syncText.textContent = 'Data Sync Complete';
        }

        processEarningsToMap();
        renderCalendar();
    } catch (e) {
        console.error('Error fetching data', e);
        syncStatus.className = 'status-dot';
        syncStatus.style.background = 'red';
        syncText.textContent = 'Sync Failed';
    }
}

async function fetchProfilesAndRenderSidebar() {
    try {
        const response = await fetch('/api/profiles');
        const result = await response.json();
        profileData = result.data || {};

        if (result.status === 'updating') {
            setTimeout(fetchProfilesAndRenderSidebar, 5000); // Check again soon
        }

        renderSidebar();
    } catch (e) {
        console.error('Error fetching profiles', e);
    }
}

function renderSidebar() {
    if (!activeStocks || activeStocks.length === 0) {
        sidebarList.innerHTML = '<div class="sidebar-loading">No stocks found.</div>';
        return;
    }

    // Build hierarchy: Market -> Industry -> Array[stockInfo]
    const hierarchy = {};

    activeStocks.forEach(sym => {
        // Find matching earnings data for shortName and market 
        const erData = earningsData.find(e => e.symbol === sym) || {};
        const pData = profileData[sym] || {};

        // Yahoo Market mappings (e.g., us_market, hk_market, jp_market)
        let market = erData.market || 'Unknown Market';
        let industry = pData.industry || 'Unknown Industry';

        // Format names nicely
        market = market.replace(/_/g, ' ').toUpperCase();

        if (!hierarchy[market]) hierarchy[market] = {};
        if (!hierarchy[market][industry]) hierarchy[market][industry] = [];

        hierarchy[market][industry].push({
            symbol: sym,
            shortName: erData.shortName || sym
        });
    });

    sidebarList.innerHTML = '';

    // Sort Markets
    Object.keys(hierarchy).sort().forEach(marketName => {
        const marketDiv = document.createElement('div');
        marketDiv.className = 'market-category';

        const mHeader = document.createElement('div');
        mHeader.className = 'market-header';

        const textSpan = document.createElement('span');
        textSpan.textContent = marketName;
        const iconSpan = document.createElement('span');

        mHeader.appendChild(textSpan);
        mHeader.appendChild(iconSpan);

        const mContent = document.createElement('div');

        // Initial State
        const isMarketCollapsed = collapsedMarkets.has(marketName);
        mContent.style.display = isMarketCollapsed ? 'none' : 'block';
        iconSpan.textContent = isMarketCollapsed ? '▶' : '▼';

        // Toggle Market
        mHeader.onclick = () => {
            const willCollapse = mContent.style.display !== 'none';
            if (willCollapse) {
                mContent.style.display = 'none';
                iconSpan.textContent = '▶';
                collapsedMarkets.add(marketName);
            } else {
                mContent.style.display = 'block';
                iconSpan.textContent = '▼';
                collapsedMarkets.delete(marketName);
            }
        };

        // Sort Industries
        Object.keys(hierarchy[marketName]).sort().forEach(indName => {
            const indDiv = document.createElement('div');
            indDiv.className = 'industry-category';

            const indHeader = document.createElement('div');
            indHeader.className = 'industry-header';
            indHeader.textContent = indName + ` (${hierarchy[marketName][indName].length})`;

            const stockListDiv = document.createElement('div');
            stockListDiv.className = 'stock-list';

            const indKey = marketName + '|' + indName;
            const isIndCollapsed = collapsedIndustries.has(indKey);
            if (isIndCollapsed) {
                stockListDiv.classList.add('collapsed');
            }

            // Toggle Industry
            indHeader.onclick = () => {
                const willCollapse = !stockListDiv.classList.contains('collapsed');
                if (willCollapse) {
                    stockListDiv.classList.add('collapsed');
                    collapsedIndustries.add(indKey);
                } else {
                    stockListDiv.classList.remove('collapsed');
                    collapsedIndustries.delete(indKey);
                }
            };

            // Sort Stocks by Name
            const stocks = hierarchy[marketName][indName].sort((a, b) => a.shortName.localeCompare(b.shortName));
            stocks.forEach(st => {
                const sItem = document.createElement('div');
                sItem.className = 'sidebar-stock-item';

                // Keep it clean
                let dName = st.shortName;
                if (dName.length > 20) dName = dName.substring(0, 18) + '...';

                sItem.innerHTML = `${dName} <span class="symbol">${st.symbol}</span>`;
                stockListDiv.appendChild(sItem);
            });

            indDiv.appendChild(indHeader);
            indDiv.appendChild(stockListDiv);
            mContent.appendChild(indDiv);
        });

        marketDiv.appendChild(mHeader);
        marketDiv.appendChild(mContent);
        sidebarList.appendChild(marketDiv);
    });
}

function processEarningsToMap() {
    allEarningsMap.clear();
    earningsData.forEach(item => {
        if (!item.earningsTimestamp) return;

        let dateObj;
        if (typeof item.earningsTimestamp === 'number' && item.earningsTimestamp < 10000000000) {
            dateObj = new Date(item.earningsTimestamp * 1000);
        } else {
            dateObj = new Date(item.earningsTimestamp);
        }

        if (isNaN(dateObj.getTime())) return;

        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const dateKey = `${y}-${m}-${d}`;

        item._parsedDate = dateObj;

        if (!allEarningsMap.has(dateKey)) {
            allEarningsMap.set(dateKey, []);
        }
        allEarningsMap.get(dateKey).push(item);
    });

    allEarningsMap.forEach((earningsArray, _dateKey) => {
        earningsArray.sort((a, b) => {
            let capA = a.marketCap || 0;
            if (a.financialCurrency === 'JPY') capA /= 150;
            else if (a.financialCurrency === 'HKD') capA /= 7.8;
            else if (a.financialCurrency === 'GBP') capA *= 1.25;
            else if (a.financialCurrency === 'EUR') capA *= 1.1;

            let capB = b.marketCap || 0;
            if (b.financialCurrency === 'JPY') capB /= 150;
            else if (b.financialCurrency === 'HKD') capB /= 7.8;
            else if (b.financialCurrency === 'GBP') capB *= 1.25;
            else if (b.financialCurrency === 'EUR') capB *= 1.1;

            return capB - capA;
        });
    });
    console.log(`[DEBUG] allEarningsMap created with ${allEarningsMap.size} dates.`);
    console.log(`[DEBUG] total raw earningsData elements: ${earningsData.length}`);
}

function renderCalendar() {
    calendarGrid.innerHTML = '';

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    currentMonthLabel.textContent = new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const endPadding = 6 - lastDay.getDay();

    const today = new Date();

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
        calendarGrid.appendChild(createDayCell(prevMonthLastDay - i, false));
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
        const isToday = i === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const cell = createDayCell(i, true, isToday, year, month);
        calendarGrid.appendChild(cell);
    }

    for (let i = 1; i <= endPadding; i++) {
        calendarGrid.appendChild(createDayCell(i, false));
    }
}

function createDayCell(day, isCurrentMonth, isToday = false, year, month) {
    const div = document.createElement('div');
    div.className = `calendar-day ${isCurrentMonth ? 'current-month' : ''} ${isToday ? 'today' : ''}`;

    const span = document.createElement('span');
    span.className = 'day-number';
    span.textContent = day;
    div.appendChild(span);

    if (isCurrentMonth) {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        const dateKey = `${year}-${m}-${d}`;

        const earnings = allEarningsMap.get(dateKey);
        if (earnings && earnings.length > 0) {
            const container = document.createElement('div');
            container.className = 'tickers-container';

            const limit = 4;
            const tags = [];

            for (let i = 0; i < earnings.length; i++) {
                const tag = document.createElement('div');
                tag.className = 'ticker-tag';
                let displayName = earnings[i].shortName || earnings[i].symbol;
                if (displayName.length > 20) displayName = displayName.substring(0, 18) + '...';
                tag.textContent = displayName;
                tag.title = earnings[i].symbol;
                tag.onclick = (e) => {
                    e.stopPropagation();
                    showModal(earnings[i]);
                };

                if (i >= limit) {
                    tag.style.display = 'none';
                    tag.classList.add('hidden-tag');
                }

                container.appendChild(tag);
                tags.push(tag);
            }

            if (earnings.length > limit) {
                const moreTag = document.createElement('div');
                moreTag.className = 'ticker-tag more-tag';
                moreTag.textContent = `+${earnings.length - limit} more`;
                moreTag.onclick = (e) => {
                    e.stopPropagation();
                    const isExpanded = container.classList.contains('expanded');
                    if (isExpanded) {
                        tags.slice(limit).forEach(t => t.style.display = 'none');
                        moreTag.textContent = `+${earnings.length - limit} more`;
                        container.classList.remove('expanded');
                    } else {
                        tags.slice(limit).forEach(t => t.style.display = 'block');
                        moreTag.textContent = `Collapse`;
                        container.classList.add('expanded');
                    }
                };
                container.appendChild(moreTag);
            }

            div.appendChild(container);
        }
    }

    return div;
}

// Modal Logic
async function showModal(data) {
    document.getElementById('modalTicker').textContent = data.symbol;
    document.getElementById('modalName').textContent = data.shortName || '';

    const timeStr = data._parsedDate ? data._parsedDate.toLocaleString() : '--';
    document.getElementById('modalDate').textContent = timeStr;

    document.getElementById('modalEpsCurrent').textContent = data.epsCurrentYear ? `$${data.epsCurrentYear.toFixed(2)}` : 'N/A';
    document.getElementById('modalEpsForward').textContent = data.epsForward ? `$${data.epsForward.toFixed(2)}` : 'N/A';
    document.getElementById('modalPeTrailing').textContent = data.trailingPE ? data.trailingPE.toFixed(2) : 'N/A';
    document.getElementById('modalPeForward').textContent = data.forwardPE ? data.forwardPE.toFixed(2) : 'N/A';

    // Reset actuals to loading state
    document.getElementById('modalActualEps').textContent = '--';
    document.getElementById('modalSurprisePct').textContent = '--';
    document.getElementById('modalActualRevenue').textContent = '--';
    document.getElementById('modalDay1Move').textContent = '--';
    document.getElementById('modalDay1Move').style.color = 'var(--text-main)';

    const statusSpan = document.getElementById('actualFetchStatus');
    statusSpan.textContent = 'Translating Data...';
    statusSpan.style.color = 'var(--neon-accent)';

    modal.classList.remove('hidden');

    // Fetch actuals on demand
    try {
        const res = await fetch(`/api/financials/${data.symbol}`);
        const finData = await res.json();

        if (finData.actualEps !== undefined && finData.actualEps !== null) {
            document.getElementById('modalActualEps').textContent = `$${finData.actualEps.toFixed(2)}`;

            if (finData.surprisePct !== undefined && finData.surprisePct !== null) {
                const surpriseStr = (finData.surprisePct * 100).toFixed(2) + '%';
                const el = document.getElementById('modalSurprisePct');
                el.textContent = finData.surprisePct > 0 ? `+${surpriseStr}` : surpriseStr;
                el.style.color = finData.surprisePct > 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            }
        } else {
            document.getElementById('modalActualEps').textContent = 'N/A';
            document.getElementById('modalSurprisePct').textContent = 'N/A';
        }

        if (finData.revenue !== undefined && finData.revenue !== null) {
            // Format revenue to Billions or Millions
            let revStr = '';
            if (finData.revenue >= 1e9) {
                revStr = `$${(finData.revenue / 1e9).toFixed(2)}B`;
            } else if (finData.revenue >= 1e6) {
                revStr = `$${(finData.revenue / 1e6).toFixed(2)}M`;
            } else {
                revStr = `$${finData.revenue.toLocaleString()}`;
            }
            document.getElementById('modalActualRevenue').textContent = revStr;
        } else {
            document.getElementById('modalActualRevenue').textContent = 'N/A';
        }

        if (finData.day1Move !== undefined && finData.day1Move !== null) {
            const movePct = (finData.day1Move * 100).toFixed(2);
            const moveStr = movePct + '%';
            const el = document.getElementById('modalDay1Move');
            el.textContent = finData.day1Move > 0 ? `+${moveStr}` : moveStr;
            if (finData.day1Move > 0) el.style.color = 'var(--accent-green)';
            else if (finData.day1Move < 0) el.style.color = 'var(--accent-red)';
            else el.style.color = 'var(--text-main)';
        } else {
            document.getElementById('modalDay1Move').textContent = 'N/A';
        }

        statusSpan.textContent = ''; // clear loading text

    } catch (e) {
        console.error('Failed to fetch actuals', e);
        statusSpan.textContent = 'Data Unavailable';
        statusSpan.style.color = 'var(--accent-red)';
    }
}

closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
});

// Month navigation
prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// Add Stock
addStockBtn.addEventListener('click', async () => {
    const symbol = newStockInput.value.trim().toUpperCase();
    if (!symbol) return;

    if (activeStocks.includes(symbol)) {
        alert('Stock already in custom list!');
        return;
    }

    // 1. Optimistically add to active stocks
    activeStocks.push(symbol);
    newStockInput.value = '';

    // 2. Optimistically add a placeholder so the sidebar sees it immediately
    if (!profileData[symbol]) {
        profileData[symbol] = { sector: 'Pending...', industry: 'Pending...' };
    }

    // Check if we already have it in earningsData (unlikely if it wasn't in activeStocks, but safe)
    if (!earningsData.some(e => e.symbol === symbol)) {
        earningsData.push({
            symbol: symbol,
            shortName: symbol,
            market: 'PENDING',
            // Assign a fake future date just so it appears on the calendar somewhere if needed, 
            // or just leave timestamp empty so it only shows in sidebar until we get real data
        });
    }

    // 3. Immediately re-render sidebar (and calendar if we had a fake date)
    renderSidebar();

    // 4. Tell backend to fetch it
    try {
        syncStatus.className = 'status-dot syncing';
        syncText.textContent = 'Fetching New Stock...';

        await fetch('/api/earnings/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: [symbol] })
        });

        // 5. Poll for the real data shortly after
        setTimeout(fetchEarningsData, 2000);
        setTimeout(fetchProfilesAndRenderSidebar, 3000);
    } catch (e) {
        console.error('Failed to request backend refresh', e);
        syncStatus.className = 'status-dot';
        syncStatus.style.background = 'red';
        syncText.textContent = 'Sync Failed';
    }
});

// Init
async function init() {
    if (activeStocks.length > 0) {
        try {
            await fetch('/api/earnings/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: activeStocks })
            });
        } catch (e) {
            console.error('Failed init custom stocks', e);
        }
    }
    fetchEarningsData();
    fetchProfilesAndRenderSidebar();
}
init();

// --- Manage Stocks Modal Logic ---
let tempManageList = [];

const manageModal = document.getElementById('manageStocksModal');
const currentStocksListEl = document.getElementById('currentStocksList');
const stockCountLabel = document.getElementById('stockCountLabel');
const txtUpload = document.getElementById('txtUpload');
const uploadStatusText = document.getElementById('uploadStatusText');
const batchInputArea = document.getElementById('batchInputArea');
const saveStocksBtn = document.getElementById('saveStocksBtn');
const saveStatus = document.getElementById('saveStatus');

function renderManageList() {
    stockCountLabel.textContent = tempManageList.length;
    currentStocksListEl.innerHTML = '';
    tempManageList.forEach(sym => {
        const chip = document.createElement('div');
        chip.className = 'stock-chip';
        chip.innerHTML = `
            ${sym}
            <span class="remove-btn" title="Remove">&times;</span>
        `;
        chip.querySelector('.remove-btn').addEventListener('click', () => {
            tempManageList = tempManageList.filter(s => s !== sym);
            renderManageList();
        });
        currentStocksListEl.appendChild(chip);
    });
}

// Hook into modal opening (we can observe class mutations or just hook the global logic)
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' && !manageModal.classList.contains('hidden')) {
            // Modal opened, initialize temporary list
            tempManageList = [...activeStocks];
            batchInputArea.value = '';
            uploadStatusText.textContent = 'No file chosen';
            saveStatus.style.opacity = '0';
            renderManageList();
        }
    });
});
observer.observe(manageModal, { attributes: true });

// Handle File Upload
txtUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadStatusText.textContent = file.name;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target.result;
        // Basic parsing: split by commas, spaces, or newlines
        const symbols = text.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(s => s);

        // Append parsed text into the textarea so the user can see/edit it before saving
        const existingVal = batchInputArea.value.trim();
        batchInputArea.value = existingVal ? existingVal + '\n' + symbols.join('\n') : symbols.join('\n');
    };
    reader.readAsText(file);
});

// Save and Sync API
saveStocksBtn.addEventListener('click', async () => {
    const textVals = batchInputArea.value.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(s => s);
    const finalSet = new Set([...tempManageList, ...textVals]);
    const finalArray = Array.from(finalSet);

    try {
        saveStocksBtn.textContent = 'SAVING...';
        saveStocksBtn.disabled = true;

        const res = await fetch('/api/save-stocks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols: finalArray })
        });

        if (res.ok) {
            saveStatus.style.opacity = '1';
            saveStatus.textContent = 'Saved! Reloading portfolio...';
            // Wait 1 second and full page reload to act as a source of truth reset
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            throw new Error('Server returned error');
        }
    } catch (e) {
        console.error('Failed to save batch stocks', e);
        saveStatus.style.opacity = '1';
        saveStatus.style.color = 'var(--accent-red)';
        saveStatus.textContent = 'Failed to save.';
        saveStocksBtn.textContent = 'SAVE & SYNC PORTFOLIO';
        saveStocksBtn.disabled = false;
    }
});
