import requests
import json
import os
from datetime import datetime, timezone
import urllib.parse

print("Starts time: ", datetime.now(timezone.utc))
# 定义语言代码列表
languages = ['hu-HU', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'es-ES', 'fr-FR', 'fr-CA', 'it-IT', 'ja-JP', 'pt-BR', 'de-DE', 'zh-CN']  # 可以添加其他语言代码

thisyear = datetime.now().year + (datetime.now().month == 12 and datetime.now().day == 31)
# thisyear = 2055
directories = ['./bing', f'./bing/{thisyear}']
# 确保所有目标文件夹存在
for directory in directories:
    if not os.path.exists(directory):
        os.makedirs(directory)

def merge_images(existing_images, new_images, date_field, unique_field=None):
    existing_dates = {image[date_field] for image in existing_images if date_field in image}
    if unique_field:
        existing_ids = {image[unique_field] for image in existing_images if unique_field in image}
    else:
        existing_ids = set()

    for image_info in new_images:
        # 只处理包含 fullstartdate 的数据
        if unique_field and unique_field in image_info:
            if image_info[unique_field] not in existing_ids:
                existing_images.append(image_info)
                existing_ids.add(image_info[unique_field])
        # 处理不包含 fullstartdate 的数据，仍然使用 date 进行判断
        elif image_info[date_field] not in existing_dates:
            existing_images.append(image_info)
            existing_dates.add(image_info[date_field])

    # 按日期倒序排序
    existing_images.sort(key=lambda x: datetime.strptime(x[date_field], '%Y%m%d'), reverse=True)

    return existing_images


# 遍历每种语言
for lang in languages:
    # 定义API URL，使用不同的语言代码
    api_url = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt={lang}"
    api_description = f"https://www.bing.com/hp/api/model?toWww=1&mkt={lang}"
    # api_url = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=8&n=8&mkt={lang}" # old
    # 语言不支持，会使用通用 ROW 数据
    if (lang == "hu-HU"): lang = "ROW"

    # 发起请求获取数据
    response = requests.get(api_url)
    response_description = requests.get(api_description)

    data = response.json()
    data_description = response_description.json()

    # 提取所需数据并格式化
    images_info = []
    for image in data['images']:
        urlbase = f"https://www.bing.com{image['urlbase']}"
        # parts = urlbase.split("OHR.")
        # name, id = parts[1].split("_")
        tempkey = image['copyrightlink'].replace("https://www.bing.com/search?q=", "")
        tempkey = tempkey.split('&')[0]
        copyrightlink = tempkey.replace('+', ' ')
        image_info = {
            'fullstartdate': image['fullstartdate'],
            'date': datetime.strptime(image['enddate'], '%Y%m%d').strftime('%Y%m%d'),
            'url': f"https://www.bing.com{image['urlbase']}_1920x1080.jpg",
            'urlbase': urlbase,
            'copyright': image['copyright'],
            'copyrightKeyword': urllib.parse.unquote(copyrightlink),
            'hsh': image['hsh']
            # 'tag': [name, id] # such as "tag": ["DugiOtokCroatia","EN-CA6561432536"]
        }
        images_info.append(image_info)
    
    for image2 in data_description['MediaContents']:
        fullstartdate = image2['Ssd'].replace('_', '')
        description = image2['ImageContent']['Description']
        # 找到对应 fullstartdate 的 image_info，并添加 description
        for image_info in images_info:
            if image_info['fullstartdate'] == fullstartdate:
                image_info['description'] = description
                break  # 找到匹配项后跳出循环


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

    # 过滤并合并新数据
    existing_images_info_current = merge_images(existing_images_info_current, images_info, date_field='date', unique_field='fullstartdate')
    existing_images_info_yearly = merge_images(existing_images_info_yearly, images_info, date_field='date', unique_field='fullstartdate')

    # 将更新后的数据写回到本地JSON文件
    write_json(file_path_current, existing_images_info_current)
    write_json(file_path_yearly, existing_images_info_yearly)

    # 将数据写入以语言代码命名的每周JSON文件
    weekly_file_path = f'./bing/bing_weekly_{lang}.json'
    # 按日期倒序排序每周数据
    images_info.sort(key=lambda x: datetime.strptime(x['date'], '%Y%m%d'), reverse=True)
    with open(weekly_file_path, 'w', encoding='utf-8') as file:
        json.dump(images_info, file, ensure_ascii=False, indent=4)

    print(f"Bing Daily Image data has been saved to '{weekly_file_path}'")

print("Bing Image of the Day data is saved for all languages.")
print("Ends time: ", datetime.now(timezone.utc))
