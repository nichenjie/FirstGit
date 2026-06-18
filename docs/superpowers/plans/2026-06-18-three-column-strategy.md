# 三栏策略界面实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单页百分位图+二档设置重构为三栏独立策略栏目，每栏可独立配置统计周期和阈值，移除二档功能。

**Architecture:** 移除右侧 signal-panel 侧边栏，将百分位图改为三个独立策略栏（三栏平分），每栏包含：控制区（周期+阈值+智能分析）、百分位走势图、信号与收益区。顶部价格图保持不变，数据范围始终全量。

**Tech Stack:** HTML + CSS + JavaScript (原生) + ECharts 5.4.3

---

## 文件结构

```
web/
├── index.html      # 重构布局，新增3栏策略区HTML结构
├── js/
│   ├── charts.js   # 3个独立ECharts实例，移除tier2逻辑
│   └── main.js     # 3栏独立事件监听+实时计算
└── css/
    └── style.css   # 新增三栏布局样式，移除tier2相关样式
```

---

## Task 1: 重构 index.html 布局

**文件:**
- Modify: `web/index.html`

- [ ] **Step 1: 替换 `.main-layout` 内部结构**

删除原有的 `.left-column` + `.signal-panel` 左右布局，替换为新的结构：

```html
<div class="main-layout">
    <!-- 左侧：价格图 + 三栏策略区 + 数据表格 -->
    <div class="left-column">
        <!-- 收盘价走势对比（不变）-->
        <div class="chart-container" id="price-chart-container">
            <h3>收盘价走势对比</h3>
            <div id="price-chart" class="chart"></div>
        </div>

        <!-- 三栏策略区 -->
        <div class="strategy-columns" id="strategy-columns">
            <!-- 策略栏 1 -->
            <div class="strategy-column" id="column-1" data-column="1">
                <div class="column-header">
                    <h4>策略栏 1</h4>
                </div>
                <div class="column-controls">
                    <label>周期:
                        <select class="period-select" data-column="1">
                            <option value="0.25">3个月</option>
                            <option value="0.5">6个月</option>
                            <option value="1">1年</option>
                            <option value="2">2年</option>
                            <option value="3" selected>3年</option>
                            <option value="5">5年</option>
                        </select>
                    </label>
                    <label>低于 <input type="number" class="low-threshold" data-column="1" value="10" min="1" max="50" step="1">%</label>
                    <label>高于 <input type="number" class="high-threshold" data-column="1" value="90" min="50" max="99" step="1">%</label>
                </div>
                <div class="chart-container column-chart-container">
                    <div class="chart percentile-chart" id="percentile-chart-1"></div>
                </div>
                <button class="smart-analysis-btn" data-column="1">🤖 智能策略分析</button>
                <div class="smart-result" data-column="1"></div>
                <div class="signal-dates" data-column="1"></div>
                <div class="signal-returns" data-column="1">
                    <div class="signal-returns-content">-</div>
                </div>
            </div>

            <!-- 策略栏 2 (同结构) -->
            <div class="strategy-column" id="column-2" data-column="2">
                <div class="column-header">
                    <h4>策略栏 2</h4>
                </div>
                <div class="column-controls">
                    <label>周期:
                        <select class="period-select" data-column="2">
                            <option value="0.25">3个月</option>
                            <option value="0.5">6个月</option>
                            <option value="1">1年</option>
                            <option value="2" selected>2年</option>
                            <option value="3">3年</option>
                            <option value="5">5年</option>
                        </select>
                    </label>
                    <label>低于 <input type="number" class="low-threshold" data-column="2" value="10" min="1" max="50" step="1">%</label>
                    <label>高于 <input type="number" class="high-threshold" data-column="2" value="90" min="50" max="99" step="1">%</label>
                </div>
                <div class="chart-container column-chart-container">
                    <div class="chart percentile-chart" id="percentile-chart-2"></div>
                </div>
                <button class="smart-analysis-btn" data-column="2">🤖 智能策略分析</button>
                <div class="smart-result" data-column="2"></div>
                <div class="signal-dates" data-column="2"></div>
                <div class="signal-returns" data-column="2">
                    <div class="signal-returns-content">-</div>
                </div>
            </div>

            <!-- 策略栏 3 (同结构) -->
            <div class="strategy-column" id="column-3" data-column="3">
                <div class="column-header">
                    <h4>策略栏 3</h4>
                </div>
                <div class="column-controls">
                    <label>周期:
                        <select class="period-select" data-column="3">
                            <option value="0.25" selected>3个月</option>
                            <option value="0.5">6个月</option>
                            <option value="1">1年</option>
                            <option value="2">2年</option>
                            <option value="3">3年</option>
                            <option value="5">5年</option>
                        </select>
                    </label>
                    <label>低于 <input type="number" class="low-threshold" data-column="3" value="10" min="1" max="50" step="1">%</label>
                    <label>高于 <input type="number" class="high-threshold" data-column="3" value="90" min="50" max="99" step="1">%</label>
                </div>
                <div class="chart-container column-chart-container">
                    <div class="chart percentile-chart" id="percentile-chart-3"></div>
                </div>
                <button class="smart-analysis-btn" data-column="3">🤖 智能策略分析</button>
                <div class="smart-result" data-column="3"></div>
                <div class="signal-dates" data-column="3"></div>
                <div class="signal-returns" data-column="3">
                    <div class="signal-returns-content">-</div>
                </div>
            </div>
        </div>

        <!-- 数据详情表格（移至下方）-->
        <div class="data-table-container">
            <h3>数据详情（按统计周期显示）</h3>
            <table id="data-table" class="data-table">
                <!-- 同原有结构 -->
            </table>
        </div>
    </div>
</div>
```

- [ ] **Step 2: 删除不再需要的元素**

删除以下原有元素：
- `#percentile-chart-container`（旧的单百分位图容器）
- `#signal-panel`（右侧信号面板整块）
- `#percentile-period`（旧的全局周期选择器）
- `#low-threshold` / `#high-threshold`（旧的全局阈值输入）
- `#update-signals-btn`（旧的全局更新按钮）
- `.tier2-config`（二档设置区块）

- [ ] **Step 3: 提交**

```bash
git add web/index.html && git commit -m "refactor: 重构HTML布局为三栏策略结构"
```

---

## Task 2: 重构 style.css 样式

**文件:**
- Modify: `web/css/style.css`

- [ ] **Step 1: 新增三栏布局样式**

在文件末尾添加：

```css
/* 三栏策略布局 */
.strategy-columns {
    display: flex;
    gap: 12px;
}

.strategy-column {
    flex: 1;
    background: #16213e;
    border-radius: 12px;
    padding: 12px 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
}

.column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.column-header h4 {
    color: #00d9ff;
    font-size: 14px;
    margin: 0;
}

.column-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
}

.column-controls label {
    font-size: 12px;
    color: #aaa;
    display: flex;
    align-items: center;
    gap: 4px;
}

.column-controls select,
.column-controls input[type="number"] {
    background: #0f3460;
    border: 1px solid #00d9ff44;
    border-radius: 4px;
    color: #eee;
    padding: 4px 6px;
    font-size: 12px;
}

.column-controls input[type="number"] {
    width: 50px;
}

.column-chart-container {
    background: transparent;
    padding: 0;
    border-radius: 0;
}

.percentile-chart {
    height: 280px;
}

.smart-analysis-btn {
    padding: 6px 12px;
    font-size: 12px;
}

.smart-result {
    padding: 8px 10px;
    background: #0f3460;
    border-radius: 6px;
    border: 1px solid #00d9ff44;
    min-height: 40px;
}

.signal-dates {
    font-size: 12px;
    color: #aaa;
    min-height: 24px;
}

.signal-returns {
    background: #0f346033;
    border-radius: 6px;
    padding: 8px;
    flex: 1;
    overflow-y: auto;
    max-height: 200px;
}

.signal-returns-content {
    font-size: 12px;
}
```

- [ ] **Step 2: 移除 tier2 相关样式**

删除以下样式块：
- `.tier2-config` (line ~659-678)
- `button.period-tag.tier2` (line ~679-683)
- `button.period-tag.tier1` (line ~684-688)

- [ ] **Step 3: 调整 `.chart` 高度**

原有 `.chart { height: 320px; }` 保持不变（用于顶部价格图）。新增 `.percentile-chart { height: 280px; }` 如上。

- [ ] **Step 4: 调整响应式 breakpoint**

将 `@media (max-width: 1200px)` 块中的 `.left-column` 规则保留，添加三栏堆叠样式：

```css
@media (max-width: 1200px) {
    .strategy-columns {
        flex-direction: column;
    }
    .strategy-column {
        flex: none;
        width: 100%;
    }
    .percentile-chart {
        height: 250px;
    }
    /* ... 其他已有规则不变 ... */
}
```

- [ ] **Step 5: 提交**

```bash
git add web/css/style.css && git commit -m "refactor: 新增三栏布局CSS，移除tier2样式"
```

---

## Task 3: 重构 charts.js

**文件:**
- Modify: `web/js/charts.js`

- [ ] **Step 1: 声明3个独立的百分位图表实例**

删除原有 `let percentileChart = null;`，替换为：

```javascript
let priceChart = null;
let percentileCharts = {};  // { '1': instance, '2': instance, '3': instance }
```

- [ ] **Step 2: 修改 `createPercentileChartOption` 函数**

保持原有逻辑不变（只保留百分位线+买入线+卖出线三根），因为新设计中每栏都是独立阈值，所以不需要 tier 参数。删除 `thresholds` 参数中的 tier 信息。

原函数签名：`createPercentileChartOption(percentileData, thresholds)`
- `thresholds` 只需要 `{ lowPct, highPct }` 两个属性

- [ ] **Step 3: 新增 `initColumnChart(columnId)` 函数**

```javascript
function initColumnChart(columnId) {
    const dom = document.getElementById(`percentile-chart-${columnId}`);
    if (!dom) return;
    percentileCharts[columnId] = echarts.init(dom);
}
```

- [ ] **Step 4: 修改 `initCharts()` 函数**

```javascript
function initCharts() {
    priceChart = echarts.init(document.getElementById('price-chart'));
    // 初始化3个百分位图表
    for (let i = 1; i <= 3; i++) {
        initColumnChart(String(i));
    }
    window.addEventListener('resize', function() {
        priceChart && priceChart.resize();
        Object.values(percentileCharts).forEach(c => c && c.resize());
    });
}
```

- [ ] **Step 5: 新增 `updateColumnChart(columnId, percentileData, thresholds)` 函数**

```javascript
function updateColumnChart(columnId, percentileData, thresholds) {
    const chart = percentileCharts[columnId];
    if (!chart || !percentileData.dates || percentileData.dates.length === 0) return;

    const option = createPercentileChartOption(percentileData, thresholds);
    option.dataZoom[0].start = 0;
    option.dataZoom[0].end = 100;
    option.dataZoom[1].start = 0;
    option.dataZoom[1].end = 100;

    chart.setOption(option);
}
```

- [ ] **Step 6: 删除 tier2 相关函数**

删除：
- `chartsModule.updateTieredChart` 整个函数
- `chartsModule.updateSignalMarkers` 整个函数

- [ ] **Step 7: 更新 `window.chartsModule` 导出**

```javascript
window.chartsModule = {
    initCharts,
    setAllData,        // 顶部价格图
    updateCharts,
    updateColumnChart,  // 新增：更新指定栏的百分位图
    scrollChartToDate,
    // 移除 updateTieredChart, updateSignalMarkers
};
```

- [ ] **Step 8: 提交**

```bash
git add web/js/charts.js && git commit -m "refactor: charts.js三栏ECharts实例，移除tier2逻辑"
```

---

## Task 4: 重构 main.js

**文件:**
- Modify: `web/js/main.js`

- [ ] **Step 1: 新增 `ColumnManager` 类，管理单栏状态**

在文件开头（DOMContentLoaded 之前）新增：

```javascript
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
        // 实时自动刷新：周期变化
        this.periodSelect.addEventListener('change', () => this.refresh());
        // 实时自动刷新：低阈值变化
        this.lowInput.addEventListener('input', () => this.refresh());
        // 实时自动刷新：高阈值变化
        this.highInput.addEventListener('input', () => this.refresh());
        // 智能分析
        this.smartBtn.addEventListener('click', () => this.runSmartAnalysis());
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

        // 更新图表
        chartsModule.updateColumnChart(this.columnId, result.percentileData, {
            lowPct: result.thresholdLow,
            highPct: result.thresholdHigh
        });

        // 更新信号按钮
        this.renderSignalDates(result.signals);

        // 更新收益分析
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
        // 使用已有的 renderSignalReturns 逻辑，但传入 columnId 区分容器
        renderSignalReturnsForColumn(this.columnId, result, globalData.developmentData, globalData.controlData, globalData.ratioMap);
    }

    async runSmartAnalysis() {
        const btn = this.smartBtn;
        btn.disabled = true;
        btn.textContent = '🔍 分析中...';
        this.smartResult.innerHTML = '<span class="no-data">策略扫描中，请稍候...</span>';

        await new Promise(r => setTimeout(r, 50));

        const { periodYears } = this.getParams();
        const analysis = analyzeForColumn(this.columnId, periodYears);

        if (!analysis.found) {
            this.smartResult.innerHTML = '<span class="no-data">未找到有效的策略（至少需要2个完整交易对）</span>';
        } else {
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
                <button class="apply-btn" data-column="${this.columnId}" data-low="${analysis.bestLow}" data-high="${analysis.bestHigh}">应用此策略</button>
            `;
            this.smartResult.querySelector('.apply-btn').addEventListener('click', (e) => {
                const col = e.target.dataset.column;
                document.querySelector(`.low-threshold[data-column="${col}"]`).value = e.target.dataset.low;
                document.querySelector(`.high-threshold[data-column="${col}"]`).value = e.target.dataset.high;
                this.refresh();
                this.smartResult.innerHTML = '';
            });
        }

        btn.disabled = false;
        btn.textContent = '🤖 智能策略分析';
    }
}
```

- [ ] **Step 2: 新增 `findSignalsForColumn(columnId, periodYears, lowPct, highPct)` 函数**

将原 `findSignalsForTier` 逻辑和 `findExtremePeriods` 中对一档的处理合并为此函数，返回 `{ signals, thresholdLow, thresholdHigh, percentileData }`：

```javascript
function findSignalsForColumn(columnId, periodYears, lowPct, highPct) {
    const { ratioMap } = globalData;
    const { controlData } = globalData;
    if (controlData.length === 0) return null;

    // 计算截止日期
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - periodYears);
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

    // 信号检测（状态机）
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
```

- [ ] **Step 3: 新增 `analyzeForColumn(columnId, periodYears)` 函数**

将 `runSmartAnalysis` 中对单档的搜索逻辑提取为此函数，返回 `{ found, bestLow, bestHigh, bestExcess, bestPairs }`。

- [ ] **Step 4: 新增 `renderSignalReturnsForColumn(columnId, tierResult, ...)` 函数**

将原 `renderSignalReturns` 函数逻辑提取为此函数，唯一区别是需要用 `columnId` 定位到对应栏目的容器元素。

- [ ] **Step 5: 修改 `DOMContentLoaded`**

删除原有的全局事件监听代码，替换为：

```javascript
document.addEventListener('DOMContentLoaded', function() {
    chartsModule.initCharts();
    refreshBtn.addEventListener('click', refreshData);

    // 初始化3个栏目管理器
    window.columnManagers = {};
    for (let i = 1; i <= 3; i++) {
        window.columnManagers[i] = new ColumnManager(String(i));
    }

    loadAllData();
});
```

- [ ] **Step 6: 修改 `loadAllData` 末尾**

删除 `findExtremePeriods()` 调用和 `updateTable()` 调用，改为加载完成后触发各栏刷新：

```javascript
// 加载数据后，更新顶部图表
updateCharts();

// 触发各栏自动刷新
Object.values(window.columnManagers).forEach(cm => cm.refresh());

// 更新全局数据表格（固定显示全部数据）
updateTable();
```

- [ ] **Step 7: 修改 `updateCharts()` 函数**

确保它只更新顶部价格图，不涉及百分位图（百分位图由各 ColumnManager 自行管理）：

```javascript
function updateCharts() {
    const { controlData, developmentData } = globalData;
    if (controlData.length === 0) return;

    // 按日期建立港股数据的 Map
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

    chartsModule.setAllData(dates, controlPrices, developmentPrices);
}
```

- [ ] **Step 8: 修改 `refreshData()`**

确保刷新后重新触发各栏刷新：

```javascript
async function refreshData() {
    // ... 现有刷新逻辑 ...
    await loadAllData();
    // ... 按钮状态恢复 ...
}
```

- [ ] **Step 9: 删除废弃代码**

删除以下函数和变量：
- `findExtremePeriods()` 整个函数
- `renderSignalButtons()` 整个函数
- `updateSignalThresholds()` 整个函数
- `globalData.tierConfig` 相关代码
- `renderSignalReturns()` 可保留（被 `renderSignalReturnsForColumn` 调用）
- `runSmartAnalysis()` 整个函数（逻辑移至 ColumnManager）

- [ ] **Step 10: 提交**

```bash
git add web/js/main.js && git commit -m "refactor: main.js三栏独立管理逻辑，移除tier2"
```

---

## Task 5: 端到端验证

**文件:**
- 测试文件: 无（前端手动测试）

- [ ] **Step 1: 启动服务器并验证**

```bash
cd E:\0_CCProjects\FinanceAnylize
python backend/server.py
# 浏览器访问 http://localhost:5000
```

验证清单：
- [ ] 顶部价格图正常显示全量历史数据
- [ ] 三栏策略区并排显示，横向平分
- [ ] 每栏可以独立选择周期（3个月/6个月/1年/2年/3年/5年）
- [ ] 每栏独立修改低/高阈值后，图表实时自动刷新
- [ ] 每栏的智能策略分析只影响本栏
- [ ] 信号按钮点击后顶部价格图联动
- [ ] 数据表格正常显示全量数据
- [ ] 二档设置区块已移除
- [ ] 响应式布局（窗口缩小时三栏垂直堆叠）正常

- [ ] **Step 2: 提交**

```bash
git add -A && git commit -m "feat: 完成三栏策略界面全部功能"
```

---

## 实施顺序

1. **Task 1** (index.html) → **Task 2** (style.css) → **Task 3** (charts.js) → **Task 4** (main.js) → **Task 5** (验证)

每完成一个 task 即提交，便于回滚和问题定位。
