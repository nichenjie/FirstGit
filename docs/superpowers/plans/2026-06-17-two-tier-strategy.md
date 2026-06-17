# 双档策略 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有单一档位策略基础上叠加双档策略——一档常规阈值(P10/P90)+轻仓(50%)，二档极值阈值(P5/P95)+重仓(100%)，两档独立计算信号和收益并叠加展示。

**Architecture:** 重构 `findExtremePeriods` 中的信号检测逻辑提取为参数化的 `findSignalsForTier` 函数，分别用两套阈值参数计算信号链；改造 `renderSignalReturns` 支持仓位比例；图表叠加双档阈值线和信号点。

**Tech Stack:** Vanilla JavaScript + ECharts 5.4.3

---

## File Map

| 文件 | 职责 |
|------|------|
| `web/js/main.js` | 重构信号检测函数、增加双档配置和仓位收益计算 |
| `web/js/charts.js` | 叠加双档阈值线、信号点、累计超额收益曲线 |
| `web/index.html` | 增加二档阈值和仓位比例 UI 输入 |
| `web/css/style.css` | 二档信号样式 |

---

## Task 1: 重构信号检测逻辑

**Files:**
- Modify: `web/js/main.js:250-384`

- [ ] **Step 1: 在 `findExtremePeriods` 前插入新函数 `findSignalsForTier`**

在 `findExtremePeriods` 函数定义之前（约第248行）插入以下新函数：

```javascript
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
```

- [ ] **Step 2: 重构 `findExtremePeriods` 调用双函数**

将 `findExtremePeriods` 函数内部（约第256-384行）替换为：

```javascript
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
```

- [ ] **Step 3: 提取信号按钮渲染函数**

在 `findExtremePeriods` 之后、`renderSignalReturns` 之前插入：

```javascript
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
```

- [ ] **Step 4: 改造 `renderSignalReturns` 支持仓位比例**

将 `renderSignalReturns` 函数签名从：
```javascript
function renderSignalReturns(signals, developmentData, controlData, ratioMap, opts)
```
改为接收 `opts.positionRatio`，在收益计算处乘以该系数（约第456-464行）：

```javascript
const ctrlReturn = (ctrlSell - ctrlBuy) / ctrlBuy * 100;
const devReturn = (devSell - devBuy) / devBuy * 100;
const excessReturn = devReturn - ctrlReturn;

// 仓位调整
const posRatio = opts.positionRatio || 1.0;
const adjustedCtrlReturn = ctrlReturn * posRatio;
const adjustedDevReturn = devReturn * posRatio;
const adjustedExcessReturn = excessReturn * posRatio;

// 累计复利计算（使用仓位调整后的收益）
totalCtrlReturn = (1 + totalCtrlReturn / 100) * (1 + adjustedCtrlReturn / 100) * 100 - 100;
totalDevReturn = (1 + totalDevReturn / 100) * (1 + adjustedDevReturn / 100) * 100 - 100;
totalExcessReturn = (1 + totalExcessReturn / 100) * (1 + adjustedExcessReturn / 100) * 100 - 100;
```

- [ ] **Step 5: Commit**

```bash
git add web/js/main.js
git commit -m "feat: 重构信号检测支持双档策略，仓位感知收益计算"
```

---

## Task 2: 图表叠加双档信号

**Files:**
- Modify: `web/js/charts.js`

- [ ] **Step 1: 读取现有 `charts.js` 中百分位图表 markLine 配置**

在 `charts.js` 中找到百分位走势图的 `markLine` 配置段（约第220-280行），了解当前阈值线如何定义。

- [ ] **Step 2: 增加 `updateTieredChart` 方法**

在 `charts.js` 末尾（`module.exports = chartsModule;` 之前）插入：

```javascript
chartsModule.updateTieredChart = function(tier1Result, tier2Result) {
    if (!this.percentileChart) return;

    // 更新 markLine：叠加两档阈值线
    const markLineData = [];

    if (tier1Result) {
        markLineData.push({
            yAxis: tier1Result.thresholdLow,
            lineStyle: { color: '#52c41a', type: 'solid', width: 2 },
            label: { formatter: '一档买入', position: 'insideStartTop', color: '#52c41a' }
        });
        markLineData.push({
            yAxis: tier1Result.thresholdHigh,
            lineStyle: { color: '#ff4d4f', type: 'solid', width: 2 },
            label: { formatter: '一档卖出', position: 'insideStartTop', color: '#ff4d4f' }
        });
    }

    if (tier2Result) {
        markLineData.push({
            yAxis: tier2Result.thresholdLow,
            lineStyle: { color: '#1890ff', type: 'dashed', width: 2 },
            label: { formatter: '二档买入', position: 'insideEndBottom', color: '#1890ff' }
        });
        markLineData.push({
            yAxis: tier2Result.thresholdHigh,
            lineStyle: { color: '#faad14', type: 'dashed', width: 2 },
            label: { formatter: '二档卖出', position: 'insideEndBottom', color: '#faad14' }
        });
    }

    this.percentileChart.setOption({
        series: [{
            markLine: {
                data: markLineData
            }
        }]
    });

    // 叠加两档信号点
    this.updateSignalMarkers(tier1Result, tier2Result);
};
```

- [ ] **Step 3: 增加信号点叠加函数**

在 `updateTieredChart` 之后插入：

```javascript
chartsModule.updateSignalMarkers = function(tier1Result, tier2Result) {
    if (!this.percentileChart) return;

    const tierMarkers = [
        { result: tier1Result, color: { buy: '#52c41a', sell: '#ff4d4f' }, symbol: 'circle' },
        { result: tier2Result, color: { buy: '#1890ff', sell: '#faad14' }, symbol: 'triangle' }
    ];

    tierMarkers.forEach(tier => {
        if (!tier.result) return;
        tier.result.signals.forEach(sig => {
            const percentile = tier.result.sortedRatios
                ? tier.result.sortedRatios.filter(r => r <= sig.ratio).length / tier.result.sortedRatios.length * 100
                : 0;

            this.percentileChart.dispatchAction({
                type: 'showTip',
                seriesIndex: 0,
                dataIndex: 0
            });
        });
    });
};
```

- [ ] **Step 4: Commit**

```bash
git add web/js/charts.js
git commit -m "feat: 图表叠加双档阈值线和信号点"
```

---

## Task 3: UI 输入扩展

**Files:**
- Modify: `web/index.html`, `web/css/style.css`

- [ ] **Step 1: 在 index.html 现有阈值控件旁增加二档控件**

在现有「低阈值」「高阈值」控件附近（约百分位过滤器区域）添加：

```html
<details class="tier2-config">
    <summary>二档设置（极值）</summary>
    <div class="config-row">
        <label>二档低阈值: <input type="number" id="tier2-low-threshold" value="5" min="1" max="45">%</label>
        <label>二档高阈值: <input type="number" id="tier2-high-threshold" value="95" min="50" max="99">%</label>
        <label>二档仓位: <input type="number" id="tier2-position-ratio" value="100" min="10" max="100">%</label>
    </div>
</details>
```

- [ ] **Step 2: 在 style.css 增加样式**

在 `web/css/style.css` 末尾添加：

```css
.tier2-config {
    margin-top: 8px;
    padding: 8px;
    background: #252540;
    border-radius: 4px;
}
.tier2-config summary {
    cursor: pointer;
    color: #888;
    font-size: 12px;
}
.config-row {
    display: flex;
    gap: 12px;
    margin-top: 8px;
}
.config-row label {
    font-size: 12px;
    color: #ccc;
}
button.period-tag.tier2 {
    border-color: #1890ff;
    color: #1890ff;
}
button.period-tag.tier1 {
    border-color: #52c41a;
    color: #52c41a;
}
```

- [ ] **Step 3: Commit**

```bash
git add web/index.html web/css/style.css
git commit -m "feat: 增加二档策略阈值和仓位 UI"
```

---

## 验证

1. 启动 `python backend/server.py`
2. 打开浏览器访问 http://localhost:5000
3. 确认页面加载无 JS 报错
4. 检查百分位走势图是否显示双档阈值线（实线=一档，虚线=二档）
5. 检查信号按钮区域是否分别显示一档和二档的买卖信号
6. 展开「二档设置」，调整阈值/仓位，确认图表和收益随之变化
