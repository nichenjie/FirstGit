"""
金融数据获取模块 - 使用 AkShare，支持数据缓存
"""

import akshare as ak
import pandas as pd
import json
import os
from datetime import datetime, timedelta

# 数据缓存目录
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')


def ensure_cache_dir():
    """确保缓存目录存在"""
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR)


def get_cache_path(stock_code: str, market: str = "A") -> str:
    """获取缓存文件路径"""
    ensure_cache_dir()
    return os.path.join(CACHE_DIR, f"{market}_{stock_code}_cache.json")


def load_cached_data(stock_code: str, market: str = "A") -> pd.DataFrame:
    """从缓存加载数据"""
    cache_path = get_cache_path(stock_code, market)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            df = pd.DataFrame(data)
            df['日期'] = pd.to_datetime(df['日期'])
            return df
        except Exception as e:
            print(f"加载缓存失败: {e}")
    return pd.DataFrame()


def save_cached_data(df: pd.DataFrame, stock_code: str, market: str = "A"):
    """保存数据到缓存"""
    if df.empty:
        return
    cache_path = get_cache_path(stock_code, market)
    # 转换日期为字符串以便JSON序列化
    df_copy = df.copy()
    df_copy['日期'] = df_copy['日期'].astype(str)
    try:
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(df_copy.to_dict('records'), f, ensure_ascii=False, indent=2)
        print(f"数据已缓存: {cache_path}")
    except Exception as e:
        print(f"保存缓存失败: {e}")


def get_a_stock_hist(code: str, period: str = "daily", start_date: str = None, end_date: str = None) -> pd.DataFrame:
    """获取A股历史行情（带缓存）"""
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=730)).strftime("%Y%m%d")  # 2年
    if end_date is None:
        end_date = datetime.now().strftime("%Y%m%d")

    # 尝试从缓存加载
    cached_df = load_cached_data(code, "A")

    try:
        # 优先使用 stock_zh_a_daily (新浪数据源)
        df = ak.stock_zh_a_daily(symbol=f"sh{code}", adjust="qfq")

        if not df.empty:
            # 转换列名
            df = df.rename(columns={
                'date': '日期',
                'open': '开盘',
                'high': '最高',
                'low': '最低',
                'close': '收盘',
                'volume': '成交量',
                'amount': '成交额'
            })
            # 合并缓存数据，去重
            if not cached_df.empty:
                df['日期'] = pd.to_datetime(df['日期'])
                cached_df['日期'] = pd.to_datetime(cached_df['日期'])
                combined = pd.concat([cached_df, df], ignore_index=True)
                combined = combined.drop_duplicates(subset=['日期'], keep='last')
                combined = combined.sort_values('日期').reset_index(drop=True)
                df = combined

            # 保存到缓存
            save_cached_data(df, code, "A")

        return df
    except Exception as e:
        print(f"获取A股历史数据失败(stock_zh_a_daily): {e}")
        try:
            # 备用：使用 stock_zh_a_hist
            df = ak.stock_zh_a_hist(symbol=code, period=period, start_date=start_date, end_date=end_date, adjust="qfq")
            if not df.empty:
                if not cached_df.empty:
                    df['日期'] = pd.to_datetime(df['日期'])
                    cached_df['日期'] = pd.to_datetime(cached_df['日期'])
                    combined = pd.concat([cached_df, df], ignore_index=True)
                    combined = combined.drop_duplicates(subset=['日期'], keep='last')
                    combined = combined.sort_values('日期').reset_index(drop=True)
                    df = combined
                save_cached_data(df, code, "A")
            return df
        except Exception as e2:
            print(f"获取A股历史数据失败(stock_zh_a_hist): {e2}")
            if not cached_df.empty:
                print("使用缓存数据")
                return cached_df
            return pd.DataFrame()


def get_hk_stock_hist(code: str, period: str = "daily", start_date: str = None, end_date: str = None) -> pd.DataFrame:
    """获取港股历史行情（带缓存）"""
    if start_date is None:
        start_date = (datetime.now() - timedelta(days=730)).strftime("%Y%m%d")  # 2年
    if end_date is None:
        end_date = datetime.now().strftime("%Y%m%d")

    # 尝试从缓存加载
    cached_df = load_cached_data(code, "HK")

    try:
        df = ak.stock_hk_hist(symbol=code, period=period, start_date=start_date, end_date=end_date, adjust="qfq")

        if not df.empty:
            # 合并缓存数据，去重
            if not cached_df.empty:
                df['日期'] = pd.to_datetime(df['日期'])
                cached_df['日期'] = pd.to_datetime(cached_df['日期'])
                combined = pd.concat([cached_df, df], ignore_index=True)
                combined = combined.drop_duplicates(subset=['日期'], keep='last')
                combined = combined.sort_values('日期').reset_index(drop=True)
                df = combined

            save_cached_data(df, code, "HK")

        return df
    except Exception as e:
        print(f"获取港股历史数据失败: {e}")
        # 使用 stock_hk_daily 作为备选
        try:
            df = ak.stock_hk_daily(symbol=code)
            if not df.empty:
                # 转换列名
                df = df.rename(columns={
                    'date': '日期',
                    'open': '开盘',
                    'high': '最高',
                    'low': '最低',
                    'close': '收盘',
                    'volume': '成交量',
                    'amount': '成交额'
                })
                if not cached_df.empty:
                    df['日期'] = pd.to_datetime(df['日期'])
                    cached_df['日期'] = pd.to_datetime(cached_df['日期'])
                    combined = pd.concat([cached_df, df], ignore_index=True)
                    combined = combined.drop_duplicates(subset=['日期'], keep='last')
                    combined = combined.sort_values('日期').reset_index(drop=True)
                    df = combined
                save_cached_data(df, code, "HK")
                return df
        except Exception as e2:
            print(f"stock_hk_daily 也失败: {e2}")

        if not cached_df.empty:
            print("使用缓存数据")
            return cached_df
        return pd.DataFrame()


def get_a_stock_spot() -> pd.DataFrame:
    """获取A股实时行情（所有股票）"""
    try:
        df = ak.stock_zh_a_spot_em()
        return df
    except Exception as e:
        print(f"获取A股实时行情失败: {e}")
        return pd.DataFrame()


def get_hk_stock_spot() -> pd.DataFrame:
    """获取港股实时行情"""
    try:
        df = ak.stock_hk_spot_em()
        return df
    except Exception as e:
        print(f"获取港股实时行情失败: {e}")
        return pd.DataFrame()


def get_exchange_rate() -> pd.DataFrame:
    """获取人民币汇率数据"""
    try:
        df = ak.currency_boc_sina()
        return df
    except Exception as e:
        print(f"获取汇率数据失败: {e}")
        return pd.DataFrame()


def get_hkd_exchange_rate_hist() -> pd.DataFrame:
    """获取港币兑人民币历史汇率（从本地Excel缓存读取）"""
    cache_path = os.path.join(CACHE_DIR, 'exchange_rate_cache.json')
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            df = pd.DataFrame(data)
            df['日期'] = pd.to_datetime(df['日期']).astype(str)
            return df
        except Exception as e:
            print(f"读取汇率缓存失败: {e}")

    # 如果本地缓存不存在，尝试从Excel文件读取
    print("本地汇率缓存不存在，从Excel文件读取...")
    all_data = []
    for year in range(2020, 2027):
        excel_file = os.path.join(CACHE_DIR, f'{year}汇率.xlsx')
        if os.path.exists(excel_file):
            try:
                df = pd.read_excel(excel_file)
                for _, row in df.iterrows():
                    date = str(row.iloc[0])
                    hkd_cny = row.iloc[5]
                    if date and hkd_cny != '---' and pd.notna(hkd_cny):
                        try:
                            rate = float(hkd_cny)
                            all_data.append({'日期': date, '汇率': rate})
                        except:
                            pass
            except Exception as e:
                print(f"读取{year}汇率文件失败: {e}")

    if all_data:
        all_data.sort(key=lambda x: x['日期'])
        # 保存到缓存
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(all_data, f, ensure_ascii=False, indent=2)
        df = pd.DataFrame(all_data)
        df['日期'] = pd.to_datetime(df['日期']).astype(str)
        return df

    print("无法获取汇率数据")
    return pd.DataFrame()


def get_cny_hkd_rate() -> dict:
    """获取人民币兑港币汇率（使用 open.er-api.com 免费API）"""
    try:
        import requests
        url = 'https://open.er-api.com/v6/latest/CNY'
        resp = requests.get(url, timeout=10)
        data = resp.json()
        if data.get('result') == 'success':
            rates = data.get('rates', {})
            return {
                "date": data.get('time_last_update_utc', '')[:10],
                "cny_usd": rates.get('USD', 0),
                "cny_hkd": rates.get('HKD', 0),
                "note": "数据来源: open.er-api.com"
            }
        return {"date": "", "cny_hkd": 0, "note": "API请求失败"}
    except Exception as e:
        print(f"获取港币汇率失败: {e}")
        return {"date": "", "cny_hkd": 0}


def format_stock_data(df: pd.DataFrame, market: str = "A") -> list:
    """格式化股票数据为前端需要的格式"""
    if df.empty:
        return []

    result = []
    for _, row in df.iterrows():
        date_val = str(row.get("日期", ""))
        # 格式化日期为 YYYY-MM-DD
        if " " in date_val:
            date_val = date_val.split(" ")[0]

        item = {
            "date": date_val,
            "open": float(row.get("开盘", 0)),
            "high": float(row.get("最高", 0)),
            "low": float(row.get("最低", 0)),
            "close": float(row.get("收盘", 0)),
            "volume": float(row.get("成交量", 0)),
            "amount": float(row.get("成交额", 0)) if "成交额" in row else 0,
        }

        if "涨跌幅" in row:
            item["change_pct"] = float(row["涨跌幅"])
        elif "收盘" in row and "开盘" in row:
            item["change_pct"] = (item["close"] - item["open"]) / item["open"] * 100

        result.append(item)

    return result


if __name__ == "__main__":
    # 初始化缓存数据
    print("=== 初始化数据缓存 ===")

    print("\n获取新城控股 A股 601155...")
    df_ctrl = get_a_stock_hist("601155")
    print(f"新城控股数据: {len(df_ctrl)} 条")

    print("\n获取新城发展 港股 01030...")
    df_dev = get_hk_stock_hist("01030")
    print(f"新城发展数据: {len(df_dev)} 条")

    print("\n获取汇率...")
    rate = get_cny_hkd_rate()
    print(f"汇率: {rate}")

    print("\n=== 初始化完成 ===")