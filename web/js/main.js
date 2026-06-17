// 主逻辑模块

const API_BASE = 'http://localhost:5000/api';

const STOCKS = {
    control: { code: '601155', name: '新城控股', market: 'A' },
    development: { code: '01030', name: '新城发展', market: 'HK' }
};

const SHARE_CAPITAL = {
    control: null,  // 从历史数据获取
    development: null
};

const MIN_GAP_DAYS = 7; // 买卖最小间隔天数

// 新城控股总股本历史（亿股）
const CTRL_SHARE_CAPITAL_HISTORY = [
    { date: '2022-11-24', shares: 22.56 },
    { date: '2022-08-01', shares: 22.61 },
    { date: '2022-01-28', shares: 22.64 },
    { date: '2021-12-15', shares: 22.60 },
    { date: '2021-02-09', shares: 22.61 },
    { date: '2020-11-25', shares: 22.56 },
    { date: '2018-01-02', shares: 22.57 },
    { date: '2017-05-19', shares: 22.58 },
    { date: '2016-12-06', shares: 22.59 },
    { date: '2016-04-21', shares: 22.20 },
    { date: '2015-12-04', shares: 17.08 }
];

// 新城发展总股本历史（亿股）
const DEV_SHARE_CAPITAL_HISTORY = [
    { date: '2026-02-11', shares: 72.6374 },
    { date: '2022-12-19', shares: 70.6574 },
    { date: '2021-12-23', shares: 65.0574 },
    { date: '2021-05-06', shares: 62.1003 },
    { date: '2020-01-21', shares: 62.1000 },
    { date: '2019-01-03', shares: 58.9900 }
];

function getCtrlShareCapital(date) {
    // 数组按日期从新到旧排列，找到第一个 <= date 的记录
    for (const record of CTRL_SHARE_CAPITAL_HISTORY) {
        if (date >= record.date) {
            return record.shares;
        }
    }
    return CTRL_SHARE_CAPITAL_HISTORY[CTRL_SHARE_CAPITAL_HISTORY.length - 1].shares;
}

function getDevShareCapital(date) {
    // 数组按日期从新到旧排列，找到第一个 <= date 的记录
    for (const record of DEV_SHARE_CAPITAL_HISTORY) {
        if (date >= record.date) {
            return record.shares;
        }
    }
    return DEV_SHARE_CAPITAL_HISTORY[DEV_SHARE_CAPITAL_HISTORY.length - 1].shares;
}

let globalData = {
    controlData: [],
    developmentData: [],
    exchangeRateByDate: {},  // {date: rate}
    allRatios: [],
    ratioMap: {},
    percentileData: {},
    thresholds: { lowPct: 10, highPct: 90 }
};

const refreshBtn = document.getElementById('refresh-btn');
const tableBody = document.getElementById('table-body');

document.addEventListener('DOMContentLoaded', function() {
    chartsModule.initCharts();
    refreshBtn.addEventListener('click', refreshData);
    document.getElementById('update-signals-btn').addEventListener('click', updateSignalThresholds);
    document.getElementById('smart-analysis-btn').addEventListener('click', runSmartAnalysis);
    loadAllData();
});

async function refreshData() {
    refreshBtn.textContent = '刷新中...';
    refreshBtn.disabled = true;

    try {
        // 先调用刷新接口更新缓存
        const response = await fetch(`${API_BASE}/refresh`, { method: 'POST' });
        const result = await response.json();

        if (result.success) {
            console.log(`刷新成功: A股 ${result.a_count}条, 港股 ${result.hk_count}条`);
        } else {
            console.warn('刷新失败:', result.error);
        }
    } catch (e) {
        console.warn('刷新接口不可用，将使用离线数据');
    }

    // 重新加载数据
    await loadAllData();
    refreshBtn.textContent = '🔄 刷新数据';
    refreshBtn.disabled = false;
}

async function loadAllData() {
    refreshBtn.textContent = '加载中...';
    refreshBtn.disabled = true;

    try {
        const [controlData, developmentData, exchangeData] = await Promise.all([
            fetchStockData('control'),
            fetchStockData('development'),
            fetchExchangeRateHistory()
        ]);

        globalData.controlData = controlData;
        globalData.developmentData = developmentData;

        // 构建按日期的汇率映射
        const rateMap = {};
        exchangeData.forEach(item => {
            const dateKey = item.date || item.日期;  // 兼容两种格式
            if (dateKey) {
                rateMap[dateKey] = parseFloat(item.汇率 || item.rate || 0.865);
            }
        });
        globalData.exchangeRateByDate = rateMap;

        // 计算市值比和百分位
        calculateRatiosAndPercentile();

        // 找出极端区间
        findExtremePeriods();

        updateCharts();
        updateTable();

    } catch (error) {
        console.error('加载数据失败:', error);
        alert('获取数据失败，请检查网络连接');
    } finally {
        refreshBtn.textContent = '🔄 刷新数据';
        refreshBtn.disabled = false;
    }
}

async function fetchStockData(type) {
    const stock = STOCKS[type];
    const endpoint = stock.market === 'A' ? 'stock/a' : 'stock/hk';

    try {
        const response = await fetch(`${API_BASE}/${endpoint}/${stock.code}`);
        if (!response.ok) throw new Error('API not available');
        const data = await response.json();
        return data.data || [];
    } catch (e) {
        // API 失败时，尝试读取本地缓存文件
        console.warn(`API fetch failed (${e.message}), trying cache file...`);
        const cacheFile = stock.market === 'A' ? 'A_601155_cache.json' : 'HK_01030_cache.json';
        try {
            const cacheResponse = await fetch(`/data/${cacheFile}`);
            if (cacheResponse.ok) {
                const cacheData = await cacheResponse.json();
                return formatCacheData(cacheData);
            }
        } catch (cacheErr) {
            console.warn('Cache file also failed, using embedded data');
        }
        // 最终 fallback：使用内嵌的缓存数据
        return formatCacheData(stock.market === 'A' ? EMBEDDED_A_DATA : EMBEDDED_HK_DATA);
    }
}

function formatCacheData(data) {
    if (!data || !Array.isArray(data)) return [];
    return data.map(item => ({
        date: item.日期 || item.date,
        open: parseFloat(item.开盘 || item.open || 0),
        high: parseFloat(item.最高 || item.high || 0),
        low: parseFloat(item.最低 || item.low || 0),
        close: parseFloat(item.收盘 || item.close || 0),
        volume: parseFloat(item.成交量 || item.volume || 0),
        amount: parseFloat(item.成交额 || item.amount || 0)
    }));
}

async function fetchExchangeRateHistory() {
    try {
        const response = await fetch(`${API_BASE}/exchange/hkd`);
        if (!response.ok) throw new Error('API not available');
        const data = await response.json();
        return data.data || [];
    } catch (e) {
        // API 失败时返回空，使用默认汇率
        console.warn(`Exchange API failed (${e.message}), using embedded data`);
        return EMBEDDED_EXCHANGE_DATA || [];
    }
}

function getExchangeRate(date) {
    // 尝试精确匹配，找不到则用最近的汇率
    if (globalData.exchangeRateByDate[date]) {
        return globalData.exchangeRateByDate[date];
    }
    // 找到最近的可用汇率
    const dates = Object.keys(globalData.exchangeRateByDate).sort();
    for (let i = 0; i < dates.length; i++) {
        if (dates[i] >= date) {
            if (i === 0) return globalData.exchangeRateByDate[dates[i]];
            return globalData.exchangeRateByDate[dates[i - 1]];
        }
    }
    return 0.865;  // 默认汇率
}

function calculateRatiosAndPercentile() {
    const { controlData, developmentData } = globalData;

    // 按日期建立港股数据的 Map，避免 index 不对齐问题
    const devPriceByDate = {};
    developmentData.forEach(d => {
        devPriceByDate[d.date] = d;
    });

    const allRatios = [];
    const ratioMap = {};

    controlData.forEach((ctrl) => {
        const dev = devPriceByDate[ctrl.date];
        if (!dev) return;

        const rate = getExchangeRate(ctrl.date);
        const ctrlShares = getCtrlShareCapital(ctrl.date);  // 亿股
        const devShares = getDevShareCapital(ctrl.date);  // 亿股
        const devMarketCapHKD = dev.close * devShares;
        const devMarketCapCNY = devMarketCapHKD * rate;
        const controlMarketCap = ctrl.close * ctrlShares;
        const ratio = devMarketCapCNY / controlMarketCap;

        allRatios.push(ratio);
        ratioMap[ctrl.date] = ratio;
    });

    globalData.allRatios = allRatios;
    globalData.ratioMap = ratioMap;
}

/**
 * 根据给定阈值和仓位比例计算买卖信号
 * @param {Object} ratioMap - 日期→市值比映射
 * @param {Array} periodData - 时间范围内的新城控股数据
 * @param {Object} tier - { lowPct, highPct, positionRatio }
 * @param {number} periodYears - 统计周期（年）
 * @returns {Object} { signals, thresholdLow, thresholdHigh, sortedRatios, periodRatios }
 */
function findSignalsForTier(ratioMap, periodData, tier, periodYears) {
    const { lowPct, highPct, positionRatio } = tier;

    // 计算统计周期的截止日期
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 过滤时间范围内的 ratio
    const filteredRatios = [];
    periodData.forEach(ctrl => {
        if (ctrl.date >= cutoffDateStr) {
            const ratio = ratioMap[ctrl.date];
            if (ratio !== undefined) filteredRatios.push(ratio);
        }
    });
    if (filteredRatios.length === 0) return null;

    // 计算阈值
    const sortedRatios = [...filteredRatios].sort((a, b) => a - b);
    const lowIdx = Math.floor(sortedRatios.length * lowPct / 100);
    const highIdx = Math.floor(sortedRatios.length * highPct / 100);
    const thresholdLow = sortedRatios[Math.min(lowIdx, sortedRatios.length - 1)];
    const thresholdHigh = sortedRatios[Math.min(highIdx, sortedRatios.length - 1)];

    // 信号检测（状态机）
    const signals = [];
    let lastSignal = null;
    let lastSignalDate = null;

    periodData.forEach(ctrl => {
        if (ctrl.date < cutoffDateStr) return;
        const ratio = ratioMap[ctrl.date];
        if (ratio === undefined) return;

        let zone = 'middle';
        if (ratio < thresholdLow) zone = 'below';
        else if (ratio > thresholdHigh) zone = 'above';

        if (lastSignal === null) {
            if (zone === 'below') {
                signals.push({ date: ctrl.date, type: 'buy', ratio, positionRatio });
                lastSignal = 'buy';
                lastSignalDate = ctrl.date;
            }
        } else if (lastSignal === 'buy') {
            if (zone === 'above') {
                const gap = Math.round((new Date(ctrl.date) - new Date(lastSignalDate)) / (1000 * 60 * 60 * 24));
                if (gap >= MIN_GAP_DAYS) {
                    signals.push({ date: ctrl.date, type: 'sell', ratio, positionRatio });
                    lastSignal = 'sell';
                    lastSignalDate = ctrl.date;
                }
            }
        } else if (lastSignal === 'sell') {
            if (zone === 'below') {
                const gap = Math.round((new Date(ctrl.date) - new Date(lastSignalDate)) / (1000 * 60 * 60 * 24));
                if (gap >= MIN_GAP_DAYS) {
                    signals.push({ date: ctrl.date, type: 'buy', ratio, positionRatio });
                    lastSignal = 'buy';
                    lastSignalDate = ctrl.date;
                }
            }
        }
    });

    return { signals, thresholdLow, thresholdHigh, sortedRatios, periodRatios: filteredRatios };
}

function findExtremePeriods() {
    const { ratioMap } = globalData;
    const { controlData, developmentData } = globalData;
    if (controlData.length === 0) return;

    // 双档配置
    const tier1 = { lowPct: 10, highPct: 90, positionRatio: 0.5 };
    const tier2 = { lowPct: 5, highPct: 95, positionRatio: 1.0 };
    const periodYears = parseInt(document.getElementById('percentile-period').value) || 3;

    // 计算两档信号
    const tier1Result = findSignalsForTier(ratioMap, controlData, tier1, periodYears);
    const tier2Result = findSignalsForTier(ratioMap, controlData, tier2, periodYears);

    // 保存供图表使用
    globalData.tierConfig = { tier1: tier1Result, tier2: tier2Result };

    // 渲染信号（按钮形式）
    renderSignalButtons([tier1Result, tier2Result]);

    // 计算收益
    renderSignalReturns(tier1Result, developmentData, controlData, ratioMap, { tier: 1, ...tier1 });
    renderSignalReturns(tier2Result, developmentData, controlData, ratioMap, { tier: 2, ...tier2 });

    // 更新图表
    chartsModule.updateTieredChart(tier1Result, tier2Result);
}

function renderSignalButtons(tierResults) {
    const container = document.getElementById('signal-dates');
    if (!container) return;

    const tierLabel = { 1: '一档(常规)', 2: '二档(极值)' };
    const tierClass = { 1: 'tier1', 2: 'tier2' };

    let html = '';
    tierResults.forEach((result, idx) => {
        if (!result) return;
        const tierNum = idx + 1;
        result.signals.forEach(sig => {
            const label = sig.type === 'buy' ? '买入' : '卖出';
            html += `<button class="period-tag ${tierClass[tierNum]}" onclick="chartsModule.scrollChartToDate('${sig.date}')">[${tierLabel[tierNum]}] ${label}: ${sig.date}</button>`;
        });
    });
    container.innerHTML = html || '<span class="no-data">无信号</span>';
}

function renderSignalReturns(tierResult, developmentData, controlData, ratioMap, opts) {
    // tierResult: { signals, thresholdLow, thresholdHigh, sortedRatios, periodRatios }
    const signals = tierResult ? tierResult.signals : [];
    const container = document.getElementById('signal-returns-content');
    if (!container) return;

    // 建立价格查找表
    const ctrlPriceByDate = {};
    controlData.forEach(d => { ctrlPriceByDate[d.date] = d.close; });
    const devPriceByDate = {};
    developmentData.forEach(d => { devPriceByDate[d.date] = d.close; });

    const posRatio = opts.positionRatio || 1.0;
    const tierLabel = opts.tier ? `【${opts.tier === 1 ? '一档(常规)' : '二档(极值)'}】` : '';

    let html = '';
    let i = 0;

    let totalCtrlReturn = 0;
    let totalDevReturn = 0;
    let totalExcessReturn = 0;
    let completedPairs = 0;

    // 计算当前最新 ratio 及其百分位（用于未平仓距离）
    let currentRatio = null;
    let currentRatioPercentile = null;
    if (controlData.length > 0) {
        const latestCtrl = controlData[controlData.length - 1];
        currentRatio = ratioMap[latestCtrl.date];
        if (currentRatio && tierResult && tierResult.sortedRatios) {
            currentRatioPercentile = tierResult.sortedRatios.filter(r => r <= currentRatio).length / tierResult.sortedRatios.length * 100;
        }
    }

    // 未平仓时，在最顶部显示距离下一次交易的信息
    let topBanner = '';
    const lastSig = signals.length > 0 ? signals[signals.length - 1] : null;
    if (lastSig && (lastSig.type === 'buy' || lastSig.type === 'sell') && opts) {
        if (lastSig.type === 'buy') {
            const targetPct = opts.highPct || 90;
            if (currentRatioPercentile !== null) {
                const diff = targetPct - currentRatioPercentile;
                if (diff > 0) {
                    topBanner = `<div class="distance-banner pending"><span class="banner-label">📍 当前持仓中（买入发展）</span><span class="banner-distance">距触发卖出还差 <strong>${diff.toFixed(1)}%</strong> 百分位（当前 ${currentRatioPercentile.toFixed(1)}%，需升至 ${targetPct}%）</span></div>`;
                } else {
                    topBanner = `<div class="distance-banner ready"><span class="banner-label">📍 当前持仓中（买入发展）</span><span class="banner-distance">已高于卖出阈值 ${targetPct}%！可考虑卖出</span></div>`;
                }
            }
        } else {
            const targetPct = opts.lowPct || 10;
            if (currentRatioPercentile !== null) {
                const diff = currentRatioPercentile - targetPct;
                if (diff > 0) {
                    topBanner = `<div class="distance-banner pending"><span class="banner-label">📍 当前空仓中（卖出发展）</span><span class="banner-distance">距触发买入还差 <strong>${diff.toFixed(1)}%</strong> 百分位（当前 ${currentRatioPercentile.toFixed(1)}%，需降至 ${targetPct}%）</span></div>`;
                } else {
                    topBanner = `<div class="distance-banner ready"><span class="banner-label">📍 当前空仓中（卖出发展）</span><span class="banner-distance">已低于买入阈值 ${targetPct}%！可考虑买入</span></div>`;
                }
            }
        }
    }

    html = topBanner;

    while (i < signals.length) {
        const sig = signals[i];
        if (sig.type === 'buy' && i + 1 < signals.length) {
            // 配对买入和卖出
            const buySig = sig;
            const sellSig = signals[i + 1];

            const ctrlBuy = ctrlPriceByDate[buySig.date];
            const ctrlSell = ctrlPriceByDate[sellSig.date];
            const devBuy = devPriceByDate[buySig.date];
            const devSell = devPriceByDate[sellSig.date];

            if (ctrlBuy && ctrlSell && devBuy && devSell) {
                const ctrlReturn = (ctrlSell - ctrlBuy) / ctrlBuy * 100;
                const devReturn = (devSell - devBuy) / devBuy * 100;
                const excessReturn = devReturn - ctrlReturn;

                // 仓位调整后的收益
                const adjustedCtrlReturn = ctrlReturn * posRatio;
                const adjustedDevReturn = devReturn * posRatio;
                const adjustedExcessReturn = excessReturn * posRatio;

                // 累计复利计算
                totalCtrlReturn = (1 + totalCtrlReturn / 100) * (1 + adjustedCtrlReturn / 100) * 100 - 100;
                totalDevReturn = (1 + totalDevReturn / 100) * (1 + adjustedDevReturn / 100) * 100 - 100;
                totalExcessReturn = (1 + totalExcessReturn / 100) * (1 + adjustedExcessReturn / 100) * 100 - 100;
                completedPairs++;

                const days = Math.round((new Date(sellSig.date) - new Date(buySig.date)) / (1000 * 60 * 60 * 24));

                // 计算买入/卖出时的市值比百分位
                const buyRatioPct = tierResult && tierResult.sortedRatios
                    ? tierResult.sortedRatios.filter(r => r <= buySig.ratio).length / tierResult.sortedRatios.length * 100
                    : null;
                const sellRatioPct = tierResult && tierResult.sortedRatios
                    ? tierResult.sortedRatios.filter(r => r <= sellSig.ratio).length / tierResult.sortedRatios.length * 100
                    : null;

                html += `
                <div class="return-item">
                    <div class="return-header">
                        <span class="return-period">${buySig.date} → ${sellSig.date}</span>
                        <span class="return-days">${days}天</span>
                    </div>
                    <div class="return-details">
                        <div class="return-stock">
                            <span class="stock-label">新城控股:</span>
                            <span class="stock-price">${ctrlBuy.toFixed(2)} → ${ctrlSell.toFixed(2)}</span>
                            <span class="stock-return ${ctrlReturn >= 0 ? 'up' : 'down'}">${ctrlReturn >= 0 ? '+' : ''}${ctrlReturn.toFixed(2)}%</span>
                        </div>
                        <div class="return-stock">
                            <span class="stock-label">新城发展:</span>
                            <span class="stock-price">${devBuy.toFixed(2)} → ${devSell.toFixed(2)}</span>
                            <span class="stock-return ${devReturn >= 0 ? 'up' : 'down'}">${devReturn >= 0 ? '+' : ''}${devReturn.toFixed(2)}%</span>
                        </div>
                        <div class="return-excess">
                            <span class="excess-label">超额收益:</span>
                            <span class="excess-value ${excessReturn >= 0 ? 'up' : 'down'}">${excessReturn >= 0 ? '+' : ''}${excessReturn.toFixed(2)}%</span>
                        </div>
                    </div>
                    <div class="return-reason">
                        <div class="reason-row">
                            <span class="reason-label">📌 买入:</span>
                            <span>市值比 ${(buySig.ratio * 100).toFixed(2)}% (百分位 ${buyRatioPct ? buyRatioPct.toFixed(1) + '%' : '-'})，低于 ${buySig.ratio < (tierResult?.thresholdLow || 0) ? '买入阈值' : '当前最低区间'}</span>
                        </div>
                        <div class="reason-row">
                            <span class="reason-label">📌 卖出:</span>
                            <span>市值比 ${(sellSig.ratio * 100).toFixed(2)}% (百分位 ${sellRatioPct ? sellRatioPct.toFixed(1) + '%' : '-'})，高于 ${sellSig.ratio > (tierResult?.thresholdHigh || Infinity) ? '卖出阈值' : '当前最高区间'}</span>
                        </div>
                    </div>
                </div>`;
            }
            i += 2;
        } else {
            // 无法配对的信号（最后一个买入但没有对应的卖出）
            html += `
            <div class="return-item unpaired ${sig.type === 'buy' ? 'position-long' : 'position-short'}">
                <div class="unpaired-header">
                    <span class="unpaired-title">${sig.type === 'buy' ? '买入发展/卖出控股' : '卖出发展/买入控股'}</span>
                    <span class="unpaired-date">${sig.date}</span>
                </div>
            </div>`;
            i++;
        }
    }

    // 汇总行
    if (completedPairs > 0) {
        html = `
        <div class="return-summary">
            <div class="summary-title">${tierLabel}区间累计收益（${completedPairs}个完整交易对）</div>
            <div class="summary-row">
                <span class="summary-label">新城控股:</span>
                <span class="summary-value ${totalCtrlReturn >= 0 ? 'up' : 'down'}">${totalCtrlReturn >= 0 ? '+' : ''}${totalCtrlReturn.toFixed(2)}%</span>
            </div>
            <div class="summary-row">
                <span class="summary-label">新城发展:</span>
                <span class="summary-value ${totalDevReturn >= 0 ? 'up' : 'down'}">${totalDevReturn >= 0 ? '+' : ''}${totalDevReturn.toFixed(2)}%</span>
            </div>
            <div class="summary-row total">
                <span class="summary-label">累计超额:</span>
                <span class="summary-value ${totalExcessReturn >= 0 ? 'up' : 'down'}">${totalExcessReturn >= 0 ? '+' : ''}${totalExcessReturn.toFixed(2)}%</span>
            </div>
        </div>` + html;
    }

    container.innerHTML = html || '<span class="no-data">无完整交易区间</span>';
}

function updateSignalThresholds() {
    findExtremePeriods();
    updateCharts();
    updateTable();
}

async function runSmartAnalysis() {
    const btn = document.getElementById('smart-analysis-btn');
    const resultDiv = document.getElementById('smart-analysis-result');
    btn.disabled = true;
    btn.textContent = '🔍 分析中...';
    resultDiv.innerHTML = '<span class="no-data">策略扫描中，请稍候...</span>';

    await new Promise(r => setTimeout(r, 50)); // yield to render

    const { controlData, developmentData, ratioMap } = globalData;
    if (controlData.length === 0) {
        resultDiv.innerHTML = '<span class="no-data">数据加载中，请稍候</span>';
        btn.disabled = false;
        btn.textContent = '🤖 智能策略分析';
        return;
    }

    const periodYears = parseInt(document.getElementById('percentile-period').value) || 3;
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const periodData = controlData.filter(ctrl => ctrl.date >= cutoffDateStr);
    const periodRatios = [];
    periodData.forEach(ctrl => {
        const ratio = ratioMap[ctrl.date];
        if (ratio !== undefined) periodRatios.push(ratio);
    });

    if (periodRatios.length === 0) {
        resultDiv.innerHTML = '<span class="no-data">数据不足</span>';
        btn.disabled = false;
        btn.textContent = '🤖 智能策略分析';
        return;
    }

    const sortedRatios = [...periodRatios].sort((a, b) => a - b);

    // 建立价格查找表
    const ctrlPriceByDate = {};
    controlData.forEach(d => { ctrlPriceByDate[d.date] = d.close; });
    const devPriceByDate = {};
    developmentData.forEach(d => { devPriceByDate[d.date] = d.close; });

    let bestLow = 10;
    let bestHigh = 90;
    let bestExcess = -Infinity;
    let bestPairs = 0;

    // Grid search: low from 5 to 45, high from 50 to 95
    for (let lowPct = 5; lowPct <= 45; lowPct += 2) {
        for (let highPct = 50; highPct <= 95; highPct += 5) {
            if (highPct <= lowPct) continue;

            const thresholdLow = sortedRatios[Math.min(Math.floor(sortedRatios.length * lowPct / 100), sortedRatios.length - 1)];
            const thresholdHigh = sortedRatios[Math.min(Math.floor(sortedRatios.length * highPct / 100), sortedRatios.length - 1)];

            const signals = [];
            let lastSignal = null;
            let lastSignalDate = null;

            periodData.forEach((ctrl) => {
                const ratio = ratioMap[ctrl.date];
                if (ratio === undefined) return;

                let zone = 'middle';
                if (ratio < thresholdLow) zone = 'below';
                else if (ratio > thresholdHigh) zone = 'above';

                const ctrlDate = ctrl.date;

                if (lastSignal === null) {
                    if (zone === 'below') {
                        signals.push({ date: ctrlDate, type: 'buy' });
                        lastSignal = 'buy';
                        lastSignalDate = ctrlDate;
                    }
                } else if (lastSignal === 'buy') {
                    if (zone === 'above') {
                        const gap = Math.round((new Date(ctrlDate) - new Date(lastSignalDate)) / (1000 * 60 * 60 * 24));
                        if (gap >= MIN_GAP_DAYS) {
                            signals.push({ date: ctrlDate, type: 'sell' });
                            lastSignal = 'sell';
                            lastSignalDate = ctrlDate;
                        }
                    }
                } else if (lastSignal === 'sell') {
                    if (zone === 'below') {
                        const gap = Math.round((new Date(ctrlDate) - new Date(lastSignalDate)) / (1000 * 60 * 60 * 24));
                        if (gap >= MIN_GAP_DAYS) {
                            signals.push({ date: ctrlDate, type: 'buy' });
                            lastSignal = 'buy';
                            lastSignalDate = ctrlDate;
                        }
                    }
                }
            });

            // 计算累计超额收益
            let totalExcess = 0;
            let completedPairs = 0;
            let i = 0;
            while (i < signals.length) {
                const sig = signals[i];
                if (sig.type === 'buy' && i + 1 < signals.length) {
                    const buySig = sig;
                    const sellSig = signals[i + 1];
                    const ctrlBuy = ctrlPriceByDate[buySig.date];
                    const ctrlSell = ctrlPriceByDate[sellSig.date];
                    const devBuy = devPriceByDate[buySig.date];
                    const devSell = devPriceByDate[sellSig.date];
                    if (ctrlBuy && ctrlSell && devBuy && devSell) {
                        const ctrlReturn = (ctrlSell - ctrlBuy) / ctrlBuy * 100;
                        const devReturn = (devSell - devBuy) / devBuy * 100;
                        const excessReturn = devReturn - ctrlReturn;
                        totalExcess = (1 + totalExcess / 100) * (1 + excessReturn / 100) * 100 - 100;
                        completedPairs++;
                    }
                    i += 2;
                } else {
                    break;
                }
            }

            // 优先选择有至少2个完整交易对的策略，再比较超额收益
            if (completedPairs >= 2 && totalExcess > bestExcess) {
                bestExcess = totalExcess;
                bestLow = lowPct;
                bestHigh = highPct;
                bestPairs = completedPairs;
            }
        }
    }

    if (bestPairs === 0) {
        resultDiv.innerHTML = '<span class="no-data">未找到有效的策略（至少需要2个完整交易对）</span>';
    } else {
        resultDiv.innerHTML = `
            <div class="smart-result-item">
                <span class="smart-label">最优买入阈值:</span>
                <span class="smart-value">低于 <strong>${bestLow}%</strong></span>
            </div>
            <div class="smart-result-item">
                <span class="smart-label">最优卖出阈值:</span>
                <span class="smart-value">高于 <strong>${bestHigh}%</strong></span>
            </div>
            <div class="smart-result-item">
                <span class="smart-label">预计超额收益:</span>
                <span class="smart-value excess ${bestExcess >= 0 ? 'up' : 'down'}">${bestExcess >= 0 ? '+' : ''}${bestExcess.toFixed(2)}%</span>
            </div>
            <div class="smart-result-item">
                <span class="smart-label">完整交易对:</span>
                <span class="smart-value">${bestPairs} 个</span>
            </div>
            <button id="apply-smart-btn" class="apply-btn">应用此策略</button>
        `;
        document.getElementById('apply-smart-btn').addEventListener('click', () => {
            document.getElementById('low-threshold').value = bestLow;
            document.getElementById('high-threshold').value = bestHigh;
            updateSignalThresholds();
            resultDiv.innerHTML = '';
        });
    }

    btn.disabled = false;
    btn.textContent = '🤖 智能策略分析';
}

function updateCharts() {
    const { controlData, developmentData, percentileData, thresholds } = globalData;

    // 获取当前统计周期
    const periodYears = parseInt(document.getElementById('percentile-period').value) || 3;
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    const endDateStr = controlData.length > 0 ? controlData[controlData.length - 1].date : '';

    // 按日期建立港股数据的 Map，避免 index 不对齐问题
    const devPriceByDate = {};
    developmentData.forEach(d => {
        devPriceByDate[d.date] = d.close;
    });

    // 按 A 股日期顺序，匹配对应日期的港股价格，并过滤到统计周期内
    const dates = [];
    const controlPrices = [];
    const developmentPrices = [];

    controlData.forEach(ctrl => {
        const devPrice = devPriceByDate[ctrl.date];
        if (devPrice !== undefined && ctrl.date >= cutoffDateStr) {
            dates.push(ctrl.date);
            controlPrices.push(ctrl.close);
            developmentPrices.push(devPrice);
        }
    });

    chartsModule.setAllData(dates, controlPrices, developmentPrices);

    // 更新百分位图表（percentileData.dates 已经是周期内的数据）
    if (percentileData.dates && percentileData.dates.length > 0) {
        chartsModule.updatePercentileChart(percentileData, thresholds);
    }
}

function updateTable() {
    const { controlData, developmentData, allRatios, ratioMap } = globalData;

    if (allRatios.length === 0) return;

    // 获取选择的统计周期
    const periodYears = parseInt(document.getElementById('percentile-period').value) || 3;

    // 根据选择的周期过滤数据计算百分位
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 按日期建立港股数据的 Map，避免 index 不对齐问题
    const devPriceByDate = {};
    developmentData.forEach(d => {
        devPriceByDate[d.date] = d;
    });

    // 根据周期过滤 A 股数据（从旧到新排列）
    const periodData = controlData.filter(ctrl => ctrl.date >= cutoffDateStr);

    // 计算周期内所有比率用于百分位计算
    const periodRatios = [];
    periodData.forEach(ctrl => {
        const ratio = ratioMap[ctrl.date];
        if (ratio !== undefined) {
            periodRatios.push(ratio);
        }
    });

    const sortedPeriod = [...periodRatios].sort((a, b) => a - b);

    // 反转数组，按时间倒序显示（最新在前）
    const reversedData = [...periodData].reverse();

    tableBody.innerHTML = reversedData.map((ctrl) => {
        const dev = devPriceByDate[ctrl.date];
        if (!dev) return '';

        const rate = getExchangeRate(ctrl.date);
        const ctrlShares = getCtrlShareCapital(ctrl.date);  // 亿股
        const devShares = getDevShareCapital(ctrl.date);  // 亿股
        const devMarketCapHKD = dev.close * devShares;
        const devMarketCapCNY = devMarketCapHKD * rate;
        const controlMarketCap = ctrl.close * ctrlShares;
        const ratio = devMarketCapCNY / controlMarketCap;

        // 计算百分位（基于选择的周期数据）
        const percentile = periodRatios.length > 0
            ? periodRatios.filter(r => r <= ratio).length / periodRatios.length * 100
            : 50;

        return `
            <tr>
                <td>${ctrl.date}</td>
                <td class="color-control">${ctrl.close.toFixed(2)}</td>
                <td class="color-control">${controlMarketCap.toFixed(2)}</td>
                <td class="color-development">${dev.close.toFixed(2)}</td>
                <td class="color-development">${devMarketCapHKD.toFixed(2)}</td>
                <td>${rate.toFixed(4)}</td>
                <td class="color-development">${devMarketCapCNY.toFixed(2)}</td>
                <td>${(ratio * 100).toFixed(2)}%</td>
                <td>${percentile.toFixed(2)}%</td>
            </tr>
        `;
    }).join('');
}