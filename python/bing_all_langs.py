import requests
import json
import os
from datetime import datetime

# 定义语言代码列表
languages = ['hu-HU', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'es-ES', 'fr-FR', 'fr-CA', 'it-IT', 'ja-JP', 'pt-BR', 'de-DE', 'zh-CN']  # 可以添加其他语言代码

thisyear = datetime.now().year
directories = ['./bing', f'./bing/{thisyear}']
# 确保所有目标文件夹存在
for directory in directories:
    if not os.path.exists(directory):
        os.makedirs(directory)

# 遍历每种语言
for lang in languages:
    # 定义API URL，使用不同的语言代码
    api_url = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt={lang}"
    # api_url = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=8&n=8&mkt={lang}" # old
    # 语言不支持，会使用通用 ROW 数据
    if (lang == "hu-HU"): lang = "ROW"
    # 发起请求获取数据
    response = requests.get(api_url)
    data = response.json()

    # 提取所需数据并格式化
    images_info = []
    for image in data['images']:
        urlbase = f"https://www.bing.com{image['urlbase']}"
        parts = urlbase.split("OHR.")
        name, id = parts[1].split("_")
        image_info = {
            'date': datetime.strptime(image['enddate'], '%Y%m%d').strftime('%Y%m%d'),
            'url': f"https://www.bing.com{image['urlbase']}_1920x1080.jpg",
            'urlbase': urlbase,
            'copyright': image['copyright'],
            'hsh': image['hsh']
            # 'tag': [name, id] # such as "tag": ["DugiOtokCroatia","EN-CA6561432536"]
        }
        images_info.append(image_info)

    # 定义与语言代码相关的文件路径
    file_path_current = f'./bing/bing_{lang}.json'
    file_path_yearly = f'./bing/{thisyear}/bing_{lang}.json'

    # 函数读写数据
    def read_json(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return json.load(file)
        except FileNotFoundError:
            return []

    def write_json(file_path, data):
        with open(file_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, ensure_ascii=False, indent=4)

    # 读取现有数据
    existing_images_info_current = read_json(file_path_current)
    existing_images_info_yearly = read_json(file_path_yearly)

    # 提取现有数据中的startdate列表
    existing_dates_current = {image['date'] for image in existing_images_info_current}
    existing_dates_yearly = {image['date'] for image in existing_images_info_yearly}

    # 过滤新数据中没有的startdate并添加到现有数据中
    for image_info in images_info:
        if image_info['date'] not in existing_dates_current:
            existing_images_info_current.append(image_info)
        if image_info['date'] not in existing_dates_yearly:
            existing_images_info_yearly.append(image_info)

    # 按日期倒序排序现有数据
    existing_images_info_current.sort(key=lambda x: datetime.strptime(x['date'], '%Y%m%d'), reverse=True)
    existing_images_info_yearly.sort(key=lambda x: datetime.strptime(x['date'], '%Y%m%d'), reverse=True)

    # 将更新后的数据写回到本地JSON文件
    write_json(file_path_current, existing_images_info_current)
    write_json(file_path_yearly, existing_images_info_yearly)

    # 将数据写入以语言代码命名的每周JSON文件
    weekly_file_path = f'./bing/bing_weekly_{lang}.json'
    # 按日期倒序排序每周数据
    images_info.sort(key=lambda x: datetime.strptime(x['date'], '%Y%m%d'), reverse=True)
    with open(weekly_file_path, 'w', encoding='utf-8') as file:
        json.dump(images_info, file, ensure_ascii=False, indent=4)

    print(f"Bing每日一图数据已保存到 '{weekly_file_path}'")

print("所有语言的Bing每日一图数据已保存。")
