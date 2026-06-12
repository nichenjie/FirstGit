"""
Flask API 服务 - 提供金融数据API
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sys
import os

# 添加backend目录到路径
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

# 获取项目根目录
PROJECT_ROOT = os.path.dirname(backend_dir)
WEB_DIR = os.path.join(PROJECT_ROOT, 'web')

app = Flask(__name__, static_folder=WEB_DIR, static_url_path='')
CORS(app)

# 导入数据获取模块（在设置路径之后）
from data_fetch import (
    get_a_stock_hist, get_hk_stock_hist,
    get_a_stock_spot, get_hk_stock_spot,
    get_exchange_rate, get_cny_hkd_rate,
    get_hkd_exchange_rate_hist,
    format_stock_data
)


@app.route('/api/stock/a/<code>', methods=['GET'])
def api_a_stock(code):
    """获取A股历史数据"""
    period = request.args.get('period', 'daily')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    df = get_a_stock_hist(code, period, start_date, end_date)
    data = format_stock_data(df, 'A')

    return jsonify({
        "code": code,
        "market": "A",
        "data": data,
        "count": len(data)
    })


@app.route('/api/stock/hk/<code>', methods=['GET'])
def api_hk_stock(code):
    """获取港股历史数据"""
    period = request.args.get('period', 'daily')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    df = get_hk_stock_hist(code, period, start_date, end_date)
    data = format_stock_data(df, 'HK')

    return jsonify({
        "code": code,
        "market": "HK",
        "data": data,
        "count": len(data)
    })


@app.route('/api/stocks/a/spot', methods=['GET'])
def api_a_stocks_spot():
    """获取A股实时行情列表"""
    df = get_a_stock_spot()
    if df.empty:
        return jsonify({"data": [], "count": 0})

    # 只返回部分常用列
    cols = ['代码', '名称', '最新价', '涨跌幅', '成交额', '市值']
    available_cols = [c for c in cols if c in df.columns]

    return jsonify({
        "data": df[available_cols].to_dict('records'),
        "count": len(df)
    })


@app.route('/api/stocks/hk/spot', methods=['GET'])
def api_hk_stocks_spot():
    """获取港股实时行情列表"""
    df = get_hk_stock_spot()
    if df.empty:
        return jsonify({"data": [], "count": 0})

    cols = ['代码', '名称', '最新价', '涨跌幅', '成交额', '市值']
    available_cols = [c for c in cols if c in df.columns]

    return jsonify({
        "data": df[available_cols].to_dict('records'),
        "count": len(df)
    })


@app.route('/api/exchange', methods=['GET'])
def api_exchange():
    """获取汇率数据"""
    rate = get_cny_hkd_rate()
    return jsonify(rate)


@app.route('/api/exchange/all', methods=['GET'])
def api_exchange_all():
    """获取所有汇率数据"""
    df = get_exchange_rate()
    if df.empty:
        return jsonify({"data": [], "count": 0})

    return jsonify({
        "data": df.to_dict('records'),
        "count": len(df)
    })


@app.route('/api/exchange/hkd', methods=['GET'])
def api_exchange_hkd():
    """获取港币兑人民币历史汇率"""
    df = get_hkd_exchange_rate_hist()
    if df.empty:
        return jsonify({"data": [], "count": 0})

    return jsonify({
        "data": df.to_dict('records'),
        "count": len(df)
    })


@app.route('/')
def index():
    """主页"""
    return send_from_directory(WEB_DIR, 'index.html')


@app.route('/health', methods=['GET'])
def health():
    """健康检查"""
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    print("启动金融数据API服务...")
    print("API端点:")
    print("  GET /api/stock/a/<code>     - 获取A股历史数据")
    print("  GET /api/stock/hk/<code>    - 获取港股历史数据")
    print("  GET /api/stocks/a/spot      - 获取A股实时行情")
    print("  GET /api/stocks/hk/spot     - 获取港股实时行情")
    print("  GET /api/exchange           - 获取汇率数据")
    print("")
    print("示例:")
    print("  curl http://localhost:5000/api/stock/a/000001")
    print("  curl http://localhost:5000/api/stock/hk/00700")

    app.run(host='0.0.0.0', port=5000, debug=True)