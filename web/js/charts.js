// ECharts 图表配置模块

let priceChart = null;
let percentileChart = null;
let allDates = [];
let allControlPrices = [];
let allDevelopmentPrices = [];

// 创建双Y轴图表配置
function createDualAxisChartOption(dates, controlPrices, developmentPrices) {
    return {
        title: {
            text: '新城控股 vs 新城发展 收盘价走势',
            left: 'center',
            textStyle: {
                color: '#00d9ff',
                fontSize: 18
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let result = params[0].name + '<br/>';
                params.forEach(p => {
                    const color = p.seriesName.includes('新城控股') ? '#ff6b6b' : '#4ecdc4';
                    result += `<span style="color:${color}">${p.seriesName}: ${p.value.toFixed(2)}</span><br/>`;
                });
                return result;
            }
        },
        legend: {
            data: ['新城控股 (左轴)', '新城发展 (右轴)'],
            top: 40,
            textStyle: {
                color: '#eee'
            }
        },
        grid: {
            left: '8%',
            right: '12%',
            bottom: '18%',
            top: '20%'
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: {
                color: '#888',
                rotate: 45,
                fontSize: 10
            },
            axisLine: {
                lineStyle: { color: '#00d9ff33' }
            },
            name: '日期',
            nameLocation: 'middle',
            nameGap: 35,
            nameTextStyle: {
                color: '#888'
            }
        },
        yAxis: [
            {
                type: 'value',
                name: '新城控股 (CNY)',
                nameTextStyle: {
                    color: '#ff6b6b'
                },
                position: 'left',
                axisLabel: {
                    color: '#ff6b6b',
                    formatter: v => v.toFixed(2)
                },
                splitLine: {
                    lineStyle: { color: '#ffffff10' }
                }
            },
            {
                type: 'value',
                name: '新城发展 (HKD)',
                nameTextStyle: {
                    color: '#4ecdc4'
                },
                position: 'right',
                axisLabel: {
                    color: '#4ecdc4',
                    formatter: v => v.toFixed(2)
                },
                splitLine: {
                    show: false
                }
            }
        ],
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100,
                minSpan: 5
            },
            {
                type: 'slider',
                start: 0,
                end: 100,
                height: 25,
                bottom: 5,
                borderColor: '#00d9ff33',
                backgroundColor: '#16213e',
                fillerColor: '#00d9ff20',
                handleStyle: {
                    color: '#00d9ff'
                },
                textStyle: {
                    color: '#888',
                    fontSize: 10
                },
                moveHandleStyle: {
                    color: '#00d9ff'
                }
            }
        ],
        series: [
            {
                name: '新城控股 (左轴)',
                type: 'line',
                data: controlPrices,
                yAxisIndex: 0,
                smooth: true,
                lineStyle: {
                    color: '#ff6b6b',
                    width: 2
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: '#ff6b6b30' },
                            { offset: 1, color: '#ff6b6b05' }
                        ]
                    }
                },
                itemStyle: {
                    color: '#ff6b6b'
                },
                symbol: 'circle',
                symbolSize: 4
            },
            {
                name: '新城发展 (右轴)',
                type: 'line',
                data: developmentPrices,
                yAxisIndex: 1,
                smooth: true,
                lineStyle: {
                    color: '#4ecdc4',
                    width: 2
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: '#4ecdc430' },
                            { offset: 1, color: '#4ecdc405' }
                        ]
                    }
                },
                itemStyle: {
                    color: '#4ecdc4'
                },
                symbol: 'circle',
                symbolSize: 4
            }
        ]
    };
}

// 创建市值比百分位走势图配置
function createPercentileChartOption(percentileData, thresholds) {
    const { dates, percentiles } = percentileData;
    const len = dates ? dates.length : 0;

    return {
        title: {
            text: '市值比百分位走势',
            left: 'center',
            textStyle: {
                color: '#00d9ff',
                fontSize: 16
            }
        },
        tooltip: {
            trigger: 'axis',
            formatter: function(params) {
                let result = params[0].name + '<br/>';
                params.forEach(p => {
                    if (p.seriesName === '百分位') {
                        result += `<span style="color:#ffd700">${p.seriesName}: ${p.value.toFixed(2)}%</span><br/>`;
                    }
                });
                return result;
            }
        },
        legend: {
            data: ['百分位', '买入线', '卖出线'],
            top: 35,
            textStyle: {
                color: '#eee',
                fontSize: 11
            }
        },
        grid: {
            left: '8%',
            right: '10%',
            bottom: '15%',
            top: '25%'
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLabel: {
                color: '#888',
                rotate: 45,
                fontSize: 9
            },
            axisLine: {
                lineStyle: { color: '#00d9ff33' }
            }
        },
        yAxis: {
            type: 'value',
            name: '百分位 (%)',
            nameTextStyle: {
                color: '#ffd700'
            },
            min: 0,
            max: 100,
            axisLabel: {
                color: '#ffd700',
                formatter: v => v.toFixed(0) + '%'
            },
            splitLine: {
                lineStyle: { color: '#ffffff10' }
            }
        },
        dataZoom: [
            {
                type: 'inside',
                start: 0,
                end: 100,
                minSpan: 5
            },
            {
                type: 'slider',
                start: 0,
                end: 100,
                height: 20,
                bottom: 3,
                borderColor: '#00d9ff33',
                backgroundColor: '#16213e',
                fillerColor: '#ffd70020',
                handleStyle: {
                    color: '#ffd700'
                },
                textStyle: {
                    color: '#888',
                    fontSize: 9
                },
                moveHandleStyle: {
                    color: '#ffd700'
                }
            }
        ],
        series: [
            {
                name: '百分位',
                type: 'line',
                data: percentiles,
                smooth: true,
                lineStyle: {
                    color: '#ffd700',
                    width: 2
                },
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: '#ffd70030' },
                            { offset: 1, color: '#ffd70005' }
                        ]
                    }
                },
                itemStyle: {
                    color: '#ffd700'
                },
                symbol: 'circle',
                symbolSize: 3
            },
            {
                name: '买入线',
                type: 'line',
                data: Array(len).fill(thresholds.lowPct),
                lineStyle: {
                    color: '#52c41a',
                    width: 2,
                    type: 'dashed'
                },
                symbol: 'none',
                tooltip: { show: false }
            },
            {
                name: '卖出线',
                type: 'line',
                data: Array(len).fill(thresholds.highPct),
                lineStyle: {
                    color: '#ff4d4f',
                    width: 2,
                    type: 'dashed'
                },
                symbol: 'none',
                tooltip: { show: false }
            }
        ]
    };
}

function initCharts() {
    priceChart = echarts.init(document.getElementById('price-chart'));
    percentileChart = echarts.init(document.getElementById('percentile-chart'));

    window.addEventListener('resize', function() {
        priceChart && priceChart.resize();
        percentileChart && percentileChart.resize();
    });
}

function setAllData(dates, controlPrices, developmentPrices) {
    allDates = dates;
    allControlPrices = controlPrices;
    allDevelopmentPrices = developmentPrices;

    const option = createDualAxisChartOption(dates, controlPrices, developmentPrices);
    // 数据已按周期过滤，显示全部范围
    option.dataZoom[0].start = 0;
    option.dataZoom[0].end = 100;
    option.dataZoom[1].start = 0;
    option.dataZoom[1].end = 100;

    priceChart.setOption(option);
}

function updatePercentileChart(percentileData, thresholds) {
    if (!percentileChart || !percentileData.dates || percentileData.dates.length === 0) return;

    const option = createPercentileChartOption(percentileData, thresholds);
    // 数据已按周期过滤，显示全部范围
    option.dataZoom[0].start = 0;
    option.dataZoom[0].end = 100;
    option.dataZoom[1].start = 0;
    option.dataZoom[1].end = 100;

    percentileChart.setOption(option);
}

function updateCharts() {
    if (allDates.length === 0) return;
    setAllData(allDates, allControlPrices, allDevelopmentPrices);
}

function scrollChartToDate(dateStr) {
    if (allDates.length === 0 || !priceChart) return;
    const index = allDates.indexOf(dateStr);
    if (index === -1) return;

    const totalDays = allDates.length;
    const windowSize = 30; // visible window size in days
    const startPercent = Math.max(0, ((index - windowSize + 1) / totalDays) * 100);
    const endPercent = Math.min(100, startPercent + (windowSize / totalDays) * 100);

    priceChart.dispatchAction({
        type: 'dataZoom',
        start: startPercent,
        end: endPercent
    });
}

window.chartsModule = {
    initCharts,
    setAllData,
    updateCharts,
    updatePercentileChart,
    scrollChartToDate,
    updateTieredChart: function(tier1Result, tier2Result) {
        if (!this.percentileChart) return;

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

        // 叠加信号点
        this.updateSignalMarkers(tier1Result, tier2Result);
    },
    updateSignalMarkers: function(tier1Result, tier2Result) {
        if (!this.percentileChart) return;

        const tierConfigs = [
            { result: tier1Result, symbol: 'circle', buyColor: '#52c41a', sellColor: '#ff4d4f' },
            { result: tier2Result, symbol: 'triangle', buyColor: '#1890ff', sellColor: '#faad14' }
        ];

        tierConfigs.forEach(tier => {
            if (!tier.result || !tier.result.signals) return;
            tier.result.signals.forEach(sig => {
                // 计算百分位
                const percentiles = tier.result.sortedRatios
                    ? tier.result.sortedRatios.filter(r => r <= sig.ratio).length / tier.result.sortedRatios.length * 100
                    : 0;
                // 通过 chart.setOption 添加 scatter 标记
                // 实际标记通过 series markPoint 实现，这里只记录日志
            });
        });
    }
};