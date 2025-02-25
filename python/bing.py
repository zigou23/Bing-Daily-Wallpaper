import requests
import json
from datetime import datetime

# 定义API URL
api_url = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=8&n=8&mkt=en-US"
# api_url2 = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=8&n=8&mkt=en-US"
# https://r2.cdn.qsim.top/bing.json
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

# 尝试读取现有的本地JSON文件
file_path = './test/bing.json'
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


# 将数据写入本地JSON文件
with open('./test/bing_weekly.json', 'w', encoding='utf-8') as file:
    json.dump(images_info, file, ensure_ascii=False, indent=4)

print("Bing每日一图数据已保存到 'bing_weekly.json'")
