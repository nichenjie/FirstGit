// ECharts 图表配置模块

let priceChart = null;
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

function initCharts() {
    priceChart = echarts.init(document.getElementById('price-chart'));

    window.addEventListener('resize', function() {
        priceChart && priceChart.resize();
    });
}

function setAllData(dates, controlPrices, developmentPrices) {
    allDates = dates;
    allControlPrices = controlPrices;
    allDevelopmentPrices = developmentPrices;

    const defaultDays = 30;
    const totalDays = dates.length;
    const startPercent = Math.max(0, 100 - (defaultDays / totalDays * 100));

    const option = createDualAxisChartOption(dates, controlPrices, developmentPrices);
    option.dataZoom[0].start = startPercent;
    option.dataZoom[0].end = 100;
    option.dataZoom[1].start = startPercent;
    option.dataZoom[1].end = 100;

    priceChart.setOption(option);
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
    scrollChartToDate
};