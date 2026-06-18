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
    percentileMap: {},
    allPercentiles: [],
    percentileData: {},
    thresholds: { lowPct: 10, highPct: 90 }
};

const refreshBtn = document.getElementById('refresh-btn');

// ============================================================
// ColumnManager 类
// ============================================================
class ColumnManager {
    constructor(columnId) {
        this.columnId = columnId;
        this.periodSelect = document.querySelector(`.period-select[data-column="${columnId}"]`);
        this.lowInput = document.querySelector(`.low-threshold[data-column="${columnId}"]`);
        this.highInput = document.querySelector(`.high-threshold[data-column="${columnId}"]`);
        this.smartBtn = document.querySelector(`.smart-analysis-btn[data-column="${columnId}"]`);
        this.smartResult = document.querySelector(`.smart-result[data-column="${columnId}"]`);
        this.signalDates = document.querySelector(`.signal-dates[data-column="${columnId}"]`);
        this.signalReturnsContent = document.querySelector(`.signal-returns[data-column="${columnId}"] .signal-returns-content`);

        this.bindEvents();
    }

    bindEvents() {
        this.periodSelect.addEventListener('change', () => this.refresh());
        this.lowInput.addEventListener('input', () => this.refresh());
        this.highInput.addEventListener('input', () => this.refresh());
    }

    getParams() {
        const periodYears = parseFloat(this.periodSelect.value) || 3;
        const lowPct = parseInt(this.lowInput.value) || 10;
        const highPct = parseInt(this.highInput.value) || 90;
        return { periodYears, lowPct, highPct };
    }

    refresh() {
        const { periodYears, lowPct, highPct } = this.getParams();
        const result = findSignalsForColumn(this.columnId, periodYears, lowPct, highPct);
        this.render(result);
    }

    render(result) {
        if (!result) return;

        const { lowPct, highPct } = this.getParams();
        chartsModule.updateColumnChart(this.columnId, result.percentileData, {
            lowPct: lowPct,
            highPct: highPct
        });

        this.renderSignalDates(result.signals);
        this.renderReturns(result);
    }

    renderSignalDates(signals) {
        const tierClass = { buy: 'low', sell: 'high' };
        let html = '';
        signals.forEach(sig => {
            const label = sig.type === 'buy' ? '买入' : '卖出';
            html += `<button class="period-tag ${tierClass[sig.type]}" onclick="chartsModule.scrollChartToDate('${sig.date}')">${label}: ${sig.date}</button>`;
        });
        this.signalDates.innerHTML = html || '<span class="no-data">无信号</span>';
    }

    renderReturns(result) {
        renderSignalReturnsForColumn(this.columnId, result, globalData.developmentData, globalData.controlData, globalData.ratioMap);
    }

    async runSmartAnalysis() {
        this.smartResult.innerHTML = '<span class="no-data">策略扫描中，请稍候...</span>';

        await new Promise(r => setTimeout(r, 50));

        const { periodYears } = this.getParams();
        const analysis = analyzeForColumn(this.columnId, periodYears);

        if (!analysis.found) {
            this.smartResult.innerHTML = '<span class="no-data">未找到有效的策略（至少需要2个完整交易对）</span>';
        } else {
            // 自动应用最优策略
            this.lowInput.value = analysis.bestLow;
            this.highInput.value = analysis.bestHigh;
            this.refresh();

            this.smartResult.innerHTML = `
                <div class="smart-result-item">
                    <span class="smart-label">最优买入阈值:</span>
                    <span class="smart-value">低于 <strong>${analysis.bestLow}%</strong></span>
                </div>
                <div class="smart-result-item">
                    <span class="smart-label">最优卖出阈值:</span>
                    <span class="smart-value">高于 <strong>${analysis.bestHigh}%</strong></span>
                </div>
                <div class="smart-result-item">
                    <span class="smart-label">预计超额收益:</span>
                    <span class="smart-value excess ${analysis.bestExcess >= 0 ? 'up' : 'down'}">${analysis.bestExcess >= 0 ? '+' : ''}${analysis.bestExcess.toFixed(2)}%</span>
                </div>
                <div class="smart-result-item">
                    <span class="smart-label">完整交易对:</span>
                    <span class="smart-value">${analysis.bestPairs} 个</span>
                </div>
            `;
        }
    }
}

async function runAllSmartAnalysis() {
    const btn = document.getElementById('all-smart-analysis-btn');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '🔍 全部分析中...';

    // 依次对3个栏目运行智能分析
    for (let i = 1; i <= 3; i++) {
        if (window.columnManagers[i]) {
            await window.columnManagers[i].runSmartAnalysis();
            await new Promise(r => setTimeout(r, 300)); // 间隔一下避免UI响应不过来
        }
    }

    btn.disabled = false;
    btn.textContent = '🤖 全部智能策略分析';
}

// ============================================================
// 新增函数
// ============================================================

/**
 * Detect buy/sell signals from period data based on low/high thresholds.
 * @param {Array} periodData - Array of control data objects with date property
 * @param {Object} ratioMap - Map of date -> ratio values
 * @param {number} thresholdLow - Below this ratio is a buy signal
 * @param {number} thresholdHigh - Above this ratio is a sell signal
 * @returns {Array} Array of signal objects {date, type, ratio}
 */
function detectSignals(periodData, ratioMap, thresholdLow, thresholdHigh) {
    const signals = [];
    let lastSignal = null;
    let lastSignalDate = null;

    periodData.forEach(ctrl => {
        const ratio = ratioMap[ctrl.date];
        if (ratio === undefined) return;

        let zone = 'middle';
        if (ratio < thresholdLow) zone = 'below';
        else if (ratio > thresholdHigh) zone = 'above';

        if (lastSignal === null) {
            if (zone === 'below') {
                signals.push({ date: ctrl.date, type: 'buy', ratio });
                lastSignal = 'buy';
                lastSignalDate = ctrl.date;
            }
        } else if (lastSignal === 'buy') {
            if (zone === 'above') {
                const gap = Math.round((new Date(ctrl.date) - new Date(lastSignalDate)) / (1000 * 60 * 60 * 24));
                if (gap >= MIN_GAP_DAYS) {
                    signals.push({ date: ctrl.date, type: 'sell', ratio });
                    lastSignal = 'sell';
                    lastSignalDate = ctrl.date;
                }
            }
        } else if (lastSignal === 'sell') {
            if (zone === 'below') {
                const gap = Math.round((new Date(ctrl.date) - new Date(lastSignalDate)) / (1000 * 60 * 60 * 24));
                if (gap >= MIN_GAP_DAYS) {
                    signals.push({ date: ctrl.date, type: 'buy', ratio });
                    lastSignal = 'buy';
                    lastSignalDate = ctrl.date;
                }
            }
        }
    });

    return signals;
}

function findSignalsForColumn(columnId, periodYears, lowPct, highPct) {
    const { ratioMap } = globalData;
    const { controlData } = globalData;
    if (controlData.length === 0) return null;

    // 计算截止日期（使用毫秒计算支持小数年份）
    const cutoffDate = new Date(Date.now() - periodYears * 365 * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    // 过滤周期内的数据
    const periodData = controlData.filter(ctrl => ctrl.date >= cutoffDateStr);
    const periodRatios = [];
    periodData.forEach(ctrl => {
        const ratio = ratioMap[ctrl.date];
        if (ratio !== undefined) periodRatios.push(ratio);
    });
    if (periodRatios.length === 0) return null;

    const sortedRatios = [...periodRatios].sort((a, b) => a - b);

    // 计算阈值
    const lowIdx = Math.floor(sortedRatios.length * lowPct / 100);
    const highIdx = Math.floor(sortedRatios.length * highPct / 100);
    const thresholdLow = sortedRatios[Math.min(lowIdx, sortedRatios.length - 1)];
    const thresholdHigh = sortedRatios[Math.min(highIdx, sortedRatios.length - 1)];

    // 使用共享函数检测信号
    const signals = detectSignals(periodData, ratioMap, thresholdLow, thresholdHigh);

    // 计算百分位走势数据
    const percentileMap = {};
    periodData.forEach(ctrl => {
        if (ctrl.date >= cutoffDateStr) {
            const ratio = ratioMap[ctrl.date];
            if (ratio !== undefined) {
                const rank = sortedRatios.filter(r => r <= ratio).length;
                percentileMap[ctrl.date] = (rank / sortedRatios.length) * 100;
            }
        }
    });

    const percentilesAll = [];
    const datesAll = [];
    periodData.forEach(ctrl => {
        if (percentileMap[ctrl.date] !== undefined) {
            datesAll.push(ctrl.date);
            percentilesAll.push(percentileMap[ctrl.date]);
        }
    });

    const latestCtrl = controlData[controlData.length - 1];
    const currentRatio = ratioMap[latestCtrl.date];
    const currentPercentile = percentileMap[latestCtrl.date];

    return {
        signals,
        thresholdLow,
        thresholdHigh,
        sortedRatios,
        periodRatios,
        percentileData: {
            dates: datesAll,
            percentiles: percentilesAll,
            currentRatio,
            currentPercentile
        }
    };
}

function analyzeForColumn(columnId, periodYears) {
    const { controlData, developmentData, ratioMap } = globalData;
    if (controlData.length === 0) return { found: false };

    const cutoffDate = new Date(Date.now() - periodYears * 365 * 24 * 60 * 60 * 1000);
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

    const periodData = controlData.filter(ctrl => ctrl.date >= cutoffDateStr);
    const periodRatios = [];
    periodData.forEach(ctrl => {
        const ratio = ratioMap[ctrl.date];
        if (ratio !== undefined) periodRatios.push(ratio);
    });

    if (periodRatios.length === 0) return { found: false };

    const sortedRatios = [...periodRatios].sort((a, b) => a - b);

    const ctrlPriceByDate = {};
    controlData.forEach(d => { ctrlPriceByDate[d.date] = d.close; });
    const devPriceByDate = {};
    developmentData.forEach(d => { devPriceByDate[d.date] = d.close; });

    let bestLow = 10;
    let bestHigh = 90;
    let bestExcess = -Infinity;
    let bestPairs = 0;

    for (let lowPct = 5; lowPct <= 45; lowPct += 2) {
        for (let highPct = 50; highPct <= 95; highPct += 5) {
            if (highPct <= lowPct) continue;

            const thresholdLow = sortedRatios[Math.min(Math.floor(sortedRatios.length * lowPct / 100), sortedRatios.length - 1)];
            const thresholdHigh = sortedRatios[Math.min(Math.floor(sortedRatios.length * highPct / 100), sortedRatios.length - 1)];

            // 使用共享函数检测信号
            const signals = detectSignals(periodData, ratioMap, thresholdLow, thresholdHigh);

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

            if (completedPairs >= 2 && totalExcess > bestExcess) {
                bestExcess = totalExcess;
                bestLow = lowPct;
                bestHigh = highPct;
                bestPairs = completedPairs;
            }
        }
    }

    if (bestPairs === 0) return { found: false };
    return { found: true, bestLow, bestHigh, bestExcess, bestPairs };
}

function renderSignalReturnsForColumn(columnId, tierResult, developmentData, controlData, ratioMap) {
    const signals = tierResult ? tierResult.signals : [];
    const container = document.querySelector(`.signal-returns[data-column="${columnId}"] .signal-returns-content`);
    if (!container) return;

    // 以下逻辑与原 renderSignalReturns 完全相同，只是 container 的获取方式不同
    const ctrlPriceByDate = {};
    controlData.forEach(d => { ctrlPriceByDate[d.date] = d.close; });
    const devPriceByDate = {};
    developmentData.forEach(d => { devPriceByDate[d.date] = d.close; });

    const tierLabel = '【策略栏' + columnId + '】';

    let html = '';
    let i = 0;
    let totalCtrlReturn = 0;
    let totalDevReturn = 0;
    let totalExcessReturn = 0;
    let completedPairs = 0;

    let currentRatio = null;
    let currentRatioPercentile = null;
    if (controlData.length > 0) {
        const latestCtrl = controlData[controlData.length - 1];
        currentRatio = ratioMap[latestCtrl.date];
        if (currentRatio && tierResult && tierResult.sortedRatios) {
            currentRatioPercentile = tierResult.sortedRatios.filter(r => r <= currentRatio).length / tierResult.sortedRatios.length * 100;
        }
    }

    let topBanner = '';
    const lastSig = signals.length > 0 ? signals[signals.length - 1] : null;
    if (lastSig && (lastSig.type === 'buy' || lastSig.type === 'sell')) {
        if (lastSig.type === 'buy') {
            const targetPct = tierResult.thresholdHigh ? (tierResult.sortedRatios ? tierResult.sortedRatios.filter(r => r <= tierResult.thresholdHigh).length / tierResult.sortedRatios.length * 100 : 90) : 90;
            if (currentRatioPercentile !== null) {
                const diff = targetPct - currentRatioPercentile;
                if (diff > 0) {
                    topBanner = `<div class="distance-banner pending"><span class="banner-label">📍 当前持仓中（买入发展）</span><span class="banner-distance">距触发卖出还差 <strong>${diff.toFixed(1)}%</strong> 百分位</span></div>`;
                } else {
                    topBanner = `<div class="distance-banner ready"><span class="banner-label">📍 当前持仓中（买入发展）</span><span class="banner-distance">已高于卖出阈值！可考虑卖出</span></div>`;
                }
            }
        } else {
            const targetPct = tierResult.thresholdLow ? (tierResult.sortedRatios ? tierResult.sortedRatios.filter(r => r <= tierResult.thresholdLow).length / tierResult.sortedRatios.length * 100 : 10) : 10;
            if (currentRatioPercentile !== null) {
                const diff = currentRatioPercentile - targetPct;
                if (diff > 0) {
                    topBanner = `<div class="distance-banner pending"><span class="banner-label">📍 当前空仓中（卖出发展）</span><span class="banner-distance">距触发买入还差 <strong>${diff.toFixed(1)}%</strong> 百分位</span></div>`;
                } else {
                    topBanner = `<div class="distance-banner ready"><span class="banner-label">📍 当前空仓中（卖出发展）</span><span class="banner-distance">已低于买入阈值！可考虑买入</span></div>`;
                }
            }
        }
    }

    html = topBanner;

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

                totalCtrlReturn = (1 + totalCtrlReturn / 100) * (1 + ctrlReturn / 100) * 100 - 100;
                totalDevReturn = (1 + totalDevReturn / 100) * (1 + devReturn / 100) * 100 - 100;
                totalExcessReturn = (1 + totalExcessReturn / 100) * (1 + excessReturn / 100) * 100 - 100;
                completedPairs++;

                const days = Math.round((new Date(sellSig.date) - new Date(buySig.date)) / (1000 * 60 * 60 * 24));
                const buyRatioPct = tierResult && tierResult.sortedRatios ? tierResult.sortedRatios.filter(r => r <= buySig.ratio).length / tierResult.sortedRatios.length * 100 : null;
                const sellRatioPct = tierResult && tierResult.sortedRatios ? tierResult.sortedRatios.filter(r => r <= sellSig.ratio).length / tierResult.sortedRatios.length * 100 : null;

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
                            <span>市值比 ${(buySig.ratio * 100).toFixed(2)}% (百分位 ${buyRatioPct ? buyRatioPct.toFixed(1) + '%' : '-'})</span>
                        </div>
                        <div class="reason-row">
                            <span class="reason-label">📌 卖出:</span>
                            <span>市值比 ${(sellSig.ratio * 100).toFixed(2)}% (百分位 ${sellRatioPct ? sellRatioPct.toFixed(1) + '%' : '-'})</span>
                        </div>
                    </div>
                </div>`;
            }
            i += 2;
        } else {
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

// ============================================================
// DOMContentLoaded
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    chartsModule.initCharts();
    refreshBtn.addEventListener('click', refreshData);

    // 初始化3个栏目管理器
    window.columnManagers = {};
    for (let i = 1; i <= 3; i++) {
        window.columnManagers[i] = new ColumnManager(String(i));
    }

    // 绑定统一智能分析按钮
    const allAnalysisBtn = document.getElementById('all-smart-analysis-btn');
    if (allAnalysisBtn) {
        allAnalysisBtn.addEventListener('click', runAllSmartAnalysis);
    }

    // 绑定顶部图表标签切换
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            chartsModule.switchTopChart(tab.dataset.tab);
        });
    });

    loadAllData();
});

// ============================================================
// Data Loading Functions
// ============================================================

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

        // 加载数据后，更新顶部图表
        updateCharts();

        // 触发各栏自动刷新
        Object.values(window.columnManagers).forEach(cm => cm.refresh());

        // 更新全局数据表格
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

    // 计算市值比百分位（全局3年窗口）
    const sortedAllRatios = [...allRatios].sort((a, b) => a - b);
    const percentileMap = {};
    const allPercentiles = [];

    controlData.forEach(ctrl => {
        const ratio = ratioMap[ctrl.date];
        if (ratio !== undefined) {
            const rank = sortedAllRatios.filter(r => r <= ratio).length;
            const pct = (rank / sortedAllRatios.length) * 100;
            percentileMap[ctrl.date] = pct;
            allPercentiles.push(pct);
        }
    });

    globalData.percentileMap = percentileMap;
    globalData.allPercentiles = allPercentiles;
}

function updateCharts() {
    const { controlData, developmentData, allRatios, allPercentiles } = globalData;
    if (controlData.length === 0) return;

    const devPriceByDate = {};
    developmentData.forEach(d => {
        devPriceByDate[d.date] = d.close;
    });

    const dates = [];
    const controlPrices = [];
    const developmentPrices = [];

    controlData.forEach(ctrl => {
        const devPrice = devPriceByDate[ctrl.date];
        if (devPrice !== undefined) {
            dates.push(ctrl.date);
            controlPrices.push(ctrl.close);
            developmentPrices.push(devPrice);
        }
    });

    // 将市值比转换为百分比形式（0-100）
    const ratiosForChart = allRatios.map(r => r * 100);

    chartsModule.setAllData(dates, controlPrices, developmentPrices, ratiosForChart, allPercentiles);
}

function updateTable() {
    const tableBody = document.getElementById('table-body');
    if (!tableBody) return;

    const { controlData, developmentData, ratioMap } = globalData;

    // 按日期建立港股数据的 Map，避免 index 不对齐问题
    const devPriceByDate = {};
    developmentData.forEach(d => {
        devPriceByDate[d.date] = d;
    });

    // 数据表格显示全部历史数据（不受栏目周期筛选影响）
    // 按时间倒序显示（最新在前）
    const reversedData = [...controlData].reverse();

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
            </tr>
        `;
    }).join('');
}