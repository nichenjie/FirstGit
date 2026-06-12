// 主逻辑模块

const API_BASE = 'http://localhost:5000/api';

const STOCKS = {
    control: { code: '601155', name: '新城控股', market: 'A' },
    development: { code: '01030', name: '新城发展', market: 'HK' }
};

const SHARE_CAPITAL = {
    control: 22.5,
    development: 66.72
};

let globalData = {
    controlData: [],
    developmentData: [],
    exchangeRateByDate: {},  // {date: rate}
    allRatios: []
};

const refreshBtn = document.getElementById('refresh-btn');
const tableBody = document.getElementById('table-body');

document.addEventListener('DOMContentLoaded', function() {
    chartsModule.initCharts();
    refreshBtn.addEventListener('click', loadAllData);
    loadAllData();
});

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
            rateMap[item.date] = parseFloat(item.汇率);
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
    const response = await fetch(`${API_BASE}/${endpoint}/${stock.code}`);
    const data = await response.json();
    return data.data || [];
}

async function fetchExchangeRateHistory() {
    const response = await fetch(`${API_BASE}/exchange/hkd`);
    const data = await response.json();
    return data.data || [];
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
    return 1.13;  // 默认汇率
}

function calculateRatiosAndPercentile() {
    const { controlData, developmentData } = globalData;

    const allRatios = [];
    const ratioMap = {};

    controlData.forEach((ctrl, idx) => {
        const dev = developmentData[idx];
        if (!dev) return;

        const rate = getExchangeRate(ctrl.date);
        const devMarketCapCNY = (dev.close * SHARE_CAPITAL.development) / rate;
        const controlMarketCap = ctrl.close * SHARE_CAPITAL.control;
        const ratio = devMarketCapCNY / controlMarketCap;

        allRatios.push(ratio);
        ratioMap[ctrl.date] = ratio;
    });

    globalData.allRatios = allRatios;
    globalData.ratioMap = ratioMap;
}

function findExtremePeriods() {
    const { allRatios, ratioMap } = globalData;
    const { controlData } = globalData;

    if (allRatios.length === 0) return;

    // 计算10%和90%分位数阈值
    const sortedRatios = [...allRatios].sort((a, b) => a - b);
    const p10Index = Math.floor(sortedRatios.length * 0.1);
    const p90Index = Math.floor(sortedRatios.length * 0.9);
    const threshold10 = sortedRatios[p10Index];
    const threshold90 = sortedRatios[p90Index];

    // 找出 <10% 和 >90% 的区间
    const lowPeriods = [];
    const highPeriods = [];
    let lowStart = null;
    let highStart = null;

    controlData.forEach((ctrl, idx) => {
        const ratio = ratioMap[ctrl.date];
        if (ratio === undefined) return;

        // <10% 区间
        if (ratio < threshold10) {
            if (!lowStart) lowStart = ctrl.date;
        } else {
            if (lowStart) {
                lowPeriods.push({ start: lowStart, end: ctrl.date });
                lowStart = null;
            }
        }

        // >90% 区间
        if (ratio > threshold90) {
            if (!highStart) highStart = ctrl.date;
        } else {
            if (highStart) {
                highPeriods.push({ start: highStart, end: ctrl.date });
                highStart = null;
            }
        }
    });

    if (lowStart) lowPeriods.push({ start: lowStart, end: controlData[controlData.length - 1].date });
    if (highStart) highPeriods.push({ start: highStart, end: controlData[controlData.length - 1].date });

    // 渲染极端区间
    document.getElementById('low-signal-dates').textContent =
        lowPeriods.length > 0 ? lowPeriods.map(p => `${p.start} ~ ${p.end}`).join('; ') : '无';

    document.getElementById('high-signal-dates').textContent =
        highPeriods.length > 0 ? highPeriods.map(p => `${p.start} ~ ${p.end}`).join('; ') : '无';
}

function updateCharts() {
    const { controlData, developmentData } = globalData;

    const dates = controlData.map(d => d.date);
    const controlPrices = controlData.map(d => d.close);
    const developmentPrices = developmentData.map(d => d.close);

    chartsModule.setAllData(dates, controlPrices, developmentPrices);
}

function updateTable() {
    const { controlData, developmentData, allRatios, ratioMap } = globalData;

    if (allRatios.length === 0) return;

    // 计算百分位阈值（只用最近3年数据）
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const threeYearsAgoStr = threeYearsAgo.toISOString().split('T')[0];

    const recentRatios = allRatios.filter((r, i) => {
        const date = controlData[i]?.date;
        return date && date >= threeYearsAgoStr;
    });

    const sortedRecent = [...recentRatios].sort((a, b) => a - b);

    const recentControl = [...controlData].reverse().slice(0, 100);
    const recentDevelopment = [...developmentData].reverse().slice(0, 100);

    tableBody.innerHTML = recentControl.map((ctrl, idx) => {
        const dev = recentDevelopment[idx];
        if (!dev) return '';

        const rate = getExchangeRate(ctrl.date);
        const devMarketCapHKD = dev.close * SHARE_CAPITAL.development;
        const devMarketCapCNY = devMarketCapHKD / rate;
        const controlMarketCap = ctrl.close * SHARE_CAPITAL.control;
        const ratio = ratioMap[ctrl.date] || 0;

        // 计算百分位（基于3年数据）
        const percentile = recentRatios.length > 0
            ? recentRatios.filter(r => r <= ratio).length / recentRatios.length * 100
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