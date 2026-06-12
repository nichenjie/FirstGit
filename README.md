# 金融数据分析项目

使用 AkShare 获取免费金融数据，在网页上绘制图表进行分析。

## 数据源
- A股、港股实时及历史行情
- 人民币兑港币汇率

## 技术栈
- Python + AkShare (数据获取)
- Flask (本地API服务)
- HTML + JavaScript + ECharts (可视化)

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动API服务
```bash
python backend/server.py
```

### 3. 打开网页
在浏览器中打开 `web/index.html`

## 目录结构
```
FinanceAnylize/
├── backend/
│   ├── data_fetch.py   # 数据获取模块
│   └── server.py       # Flask API服务
├── web/
│   ├── index.html      # 主页面
│   ├── css/style.css   # 样式
│   └── js/
│       ├── main.js     # 主逻辑
│       └── charts.js   # 图表配置
└── data/               # 缓存数据
```