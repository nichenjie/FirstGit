# 双档策略设计文档

## 背景与目标

当前系统使用单一百分位阈值（默认 P10/P90）进行全仓轮动——低于低阈值买入发展、高于高阈值卖出发展。这种方式存在两个问题：
1. **满仓轮动风险**：无仓位控制，极端行情下回撤大
2. **缺乏分层应对**：百分位走向极端时与处于中间区间时使用相同策略

本次设计在现有单一策略基础上**叠加双档策略**，实现：
- **阈值分档**：一档常规（P10/P90），二档极值（P5/P95）
- **仓位分档**：一档轻仓（如 50%），二档重仓（如 100%）
- **趋势确认切换**：百分位下穿上穿确认后才触发档位切换
- **超额收益对比**：展示各档位相对基准的累计超额收益

---

## 核心设计

### 1. 配置层

新增 `tierConfig` 配置对象，挂在 `globalData` 上：

```javascript
globalData.tierConfig = {
  tier1: { lowPct: 10, highPct: 90, positionRatio: 0.5 },  // 常规档
  tier2: { lowPct: 5,  highPct: 95, positionRatio: 1.0 },  // 极值档
}
```

### 2. 双档独立计算

复用现有 `findExtremePeriods` 逻辑，分别传入不同阈值计算两套信号：

```javascript
// 一档信号
const signals1 = findSignalsForTier(ratioMap, periodData, tierConfig.tier1);
// 二档信号
const signals2 = findSignalsForTier(ratioMap, periodData, tierConfig.tier2);
```

`findSignalsForTier` 是对原 `findExtremePeriods` 的重构——将信号检测逻辑提取为独立函数，接收阈值参数。

### 3. 仓位感知收益计算

改造 `renderSignalReturns`，支持按仓位比例计算收益：

```javascript
// 伪代码
const adjustedDevReturn = devReturn * positionRatio;
const adjustedExcessReturn = excessReturn * positionRatio;
```

### 4. 基准收益

基准 = 等权持有两只股票不动（各 50% 仓位）的累计收益。用于计算超额收益对比。

### 5. 图表叠加展示

- **百分位图**：叠加一档和二档的阈值线（一档实线，二档虚线）
- **信号点**：一档用圆形，二档用三角形，颜色区分买卖
- **累计收益曲线**：两条累计超额收益曲线（可在现有收益区域增加折线图）

---

## 修改范围

| 文件 | 修改内容 |
|------|----------|
| `web/js/main.js` | 重构信号检测为 `findSignalsForTier`，增加双档配置和仓位计算逻辑 |
| `web/js/charts.js` | 叠加两档阈值线和信号点，增加累计超额收益曲线 |
| `web/index.html` | 增加二档阈值和仓位比例的 UI 输入（默认折叠） |
| `web/css/style.css` | 二档信号样式（虚线、三角形图标） |

---

## 验证方式

1. 启动 `python backend/server.py`
2. 打开浏览器访问，查看双档信号是否正确叠加
3. 对比同一历史区间，单档 vs 双档的累计超额收益
4. 手动调整阈值/仓位，验证收益变化
