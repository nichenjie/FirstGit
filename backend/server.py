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

# 数据缓存目录
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

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


@app.route('/api/refresh', methods=['POST'])
def api_refresh():
    """刷新所有数据并更新缓存"""
    import subprocess
    import json

    try:
        # 执行 data_fetch.py 获取最新数据
        result = subprocess.run(
            [sys.executable, os.path.join(backend_dir, 'data_fetch.py')],
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode != 0:
            return jsonify({
                "success": False,
                "error": result.stderr or "data_fetch.py failed"
            }), 500

        # 重新生成 embedded_data.js
        data_dir = os.path.join(PROJECT_ROOT, 'data')
        web_data_dir = os.path.join(WEB_DIR, 'data')
        os.makedirs(web_data_dir, exist_ok=True)

        embedded_path = os.path.join(web_data_dir, 'embedded_data.js')

        a_cache = os.path.join(data_dir, 'A_601155_cache.json')
        hk_cache = os.path.join(data_dir, 'HK_01030_cache.json')

        with open(a_cache, 'r', encoding='utf-8') as f:
            a_data = json.load(f)
        with open(hk_cache, 'r', encoding='utf-8') as f:
            hk_data = json.load(f)

        with open(embedded_path, 'w', encoding='utf-8') as f:
            f.write('// Embedded cache data - auto-generated\n')
            f.write('const EMBEDDED_A_DATA = ' + json.dumps(a_data, ensure_ascii=False) + ';\n')
            f.write('const EMBEDDED_HK_DATA = ' + json.dumps(hk_data, ensure_ascii=False) + ';\n')

        # 生成汇率数据
        exchange_cache = os.path.join(data_dir, 'exchange_rate_cache.json')
        if os.path.exists(exchange_cache):
            with open(exchange_cache, 'r', encoding='utf-8') as f:
                exchange_data = json.load(f)
            with open(embedded_path, 'a', encoding='utf-8') as f:
                f.write('const EMBEDDED_EXCHANGE_DATA = ' + json.dumps(exchange_data, ensure_ascii=False) + ';\n')

        return jsonify({
            "success": True,
            "message": "数据已刷新",
            "a_count": len(a_data),
            "hk_count": len(hk_data)
        })

    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "error": "数据获取超时"
        }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


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