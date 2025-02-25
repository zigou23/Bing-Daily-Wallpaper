# Check if `date` are missing or duplicated.

# Note: This file must be executed in the ./bing folder.
# 注意：此文件必须在 ./bing 文件夹执行

import json
from datetime import datetime, timedelta

# 从文件中读取 JSON 数据
def load_json_from_file(filename):
    with open(filename, 'r') as file:
        return json.load(file)

# 生成日期范围内的日期
def generate_date_range(start_date, end_date):
    start = datetime.strptime(start_date, "%Y%m%d")
    end = datetime.strptime(end_date, "%Y%m%d")
    dates = []
    while start <= end:
        dates.append(start.strftime("%Y%m%d"))
        start += timedelta(days=1)
    return dates

# 查找缺失和重复的日期
def find_dates_issues(data, start_date, end_date):
    all_dates = set(generate_date_range(start_date, end_date))
    present_dates = set()
    duplicate_dates = set()
    
    for item in data:
        date = item['date']
        if date in present_dates:
            duplicate_dates.add(date)
        present_dates.add(date)
    
    missing_dates = sorted(all_dates - present_dates)
    return missing_dates, sorted(duplicate_dates)

# 获取文件中的第一个日期作为 start_date
def get_start_date_from_data(data):
    # 提取所有日期并排序，第一个日期即为 start_date
    dates = sorted(item['date'] for item in data)
    return dates[0] if dates else None

languages = ['ROW', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'es-ES', 'fr-FR', 'fr-CA', 'it-IT', 'ja-JP', 'pt-BR', 'de-DE', 'zh-CN']  # 可以添加其他语言代码

for lang in languages:
    # 文件名和日期范围
    filename = f'bing_{lang}.json'
    end_date = "20240814"
    # end_date = "20240814"

    # 读取 JSON 数据并查找缺失和重复的日期
    data = load_json_from_file(filename)
    start_date = get_start_date_from_data(data)

    missing_dates, duplicate_dates = find_dates_issues(data, start_date, end_date)

    print(f'{lang} {start_date}-{end_date} Missing dates:', missing_dates)
    print(f'{lang} {start_date}-{end_date} Duplicate dates:', duplicate_dates)
