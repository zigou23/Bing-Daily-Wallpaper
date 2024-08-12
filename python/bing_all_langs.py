import requests
import json
import os
from datetime import datetime

# 定义语言代码列表
languages = ['hu-HU', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'fr-FR', 'it-IT', 'ja-JP', 'de-DE', 'zh-CN']  # 可以添加其他语言代码

# 确保目标文件夹存在
output_dir = '../bing'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# 遍历每种语言
for lang in languages:
    # 定义API URL，使用不同的语言代码
    api_url = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt={lang}"
    if (lang == "hu-HU"): lang = "ROW"
    # 发起请求获取数据
    response = requests.get(api_url)
    data = response.json()

    # 提取所需数据并格式化
    images_info = []
    for image in data['images']:
        image_info = {
            'date': datetime.strptime(image['startdate'], '%Y%m%d').strftime('%Y%m%d'),
            'url': f"https://www.bing.com{image['url']}",
            'urlbase': f"https://www.bing.com{image['urlbase']}",
            'copyright': image['copyright']
        }
        images_info.append(image_info)

    # 定义与语言代码相关的文件路径
    file_path = f'../bing/bing_{lang}.json'

    # 尝试读取现有的本地JSON文件
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            existing_images_info = json.load(file)
    except FileNotFoundError:
        # 如果文件不存在，则初始化为一个空列表
        existing_images_info = []

    # 提取现有数据中的startdate列表
    existing_dates = {image['date'] for image in existing_images_info}

    # 过滤新数据中没有的startdate并添加到现有数据中
    for image_info in images_info:
        if image_info['date'] not in existing_dates:
            existing_images_info.append(image_info)

    # 将更新后的数据写回到本地JSON文件
    with open(file_path, 'w', encoding='utf-8') as file:
        json.dump(existing_images_info, file, ensure_ascii=False, indent=4)

    # 将数据写入以语言代码命名的每周JSON文件
    weekly_file_path = f'../bing/bing_weekly_{lang}.json'
    with open(weekly_file_path, 'w', encoding='utf-8') as file:
        json.dump(images_info, file, ensure_ascii=False, indent=4)

    print(f"Bing每日一图数据已保存到 '{weekly_file_path}'")

print("所有语言的Bing每日一图数据已保存。")