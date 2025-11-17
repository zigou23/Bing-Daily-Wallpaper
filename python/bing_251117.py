import requests
import json
import os
from datetime import datetime, timezone
import urllib.parse
import time
import re # <-- 导入正则表达式库

print("Starts time: ", datetime.now(timezone.utc))
# 定义语言代码列表
languages = ['hu-HU', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'es-ES', 'fr-FR', 'fr-CA', 'it-IT', 'ja-JP', 'pt-BR', 'de-DE', 'zh-CN']

thisyear = datetime.now().year + (datetime.now().month == 12 and datetime.now().day == 31)
# thisyear = 2055
directories = ['./bing', f'./bing/{thisyear}', './bing/weekly']
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
        # 处理不包含 fullstartdate 的数据,仍然使用 date 进行判断
        elif image_info[date_field] not in existing_dates:
            existing_images.append(image_info)
            existing_dates.add(image_info[date_field])

    # 按日期倒序排序
    existing_images.sort(key=lambda x: datetime.strptime(x[date_field], '%Y%m%d'), reverse=True)

    return existing_images

# ====== 提取图片ID的辅助函数 ======
def get_image_id_from_url(url_string):
    """从URL中提取唯一的图片ID (例如 'OHR.ShenandoahTrail')"""
    if not url_string:
        return None
    # 正则表达式匹配 'id=' 和 '_' 之间的部分 (例如 OHR.ShenandoahTrail)
    match = re.search(r'id=([A-Za-z0-9\.]+)_', url_string)
    if match:
        return match.group(1)
    return None

# 遍历每种语言
for lang in languages:
    print(f"\n========== Processing language: {lang} ==========")
    
    # 定义API URL,使用不同的语言代码
    api_url = f"https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt={lang}"
    api_description = f"https://www.bing.com/hp/api/model?toWww=1&mkt={lang}"
    
    # 语言不支持,会使用通用 ROW 数据（仅用于文件命名）
    original_lang = lang
    file_lang = lang
    if (lang == "hu-HU"): 
        file_lang = "ROW"

    try:
        # 发起请求获取数据
        print(f"Fetching main API: {api_url}")
        response = requests.get(api_url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # 添加短暂延迟，避免请求过快
        time.sleep(0.5)
        
        print(f"Fetching description API: {api_description}")
        response_description = requests.get(api_description, timeout=10)
        response_description.raise_for_status()
        data_description = response_description.json()
        
        # 调试信息
        main_images_count = len(data.get('images', []))
        print(f"Main API returned {main_images_count} images")
        
        # 检查 MediaContents
        media_contents_count = 0
        preload_contents_count = 0
        
        if 'MediaContents' in data_description:
            media_contents_count = len(data_description['MediaContents'])
            print(f"MediaContents found with {media_contents_count} items")
        else:
            print("WARNING: MediaContents not found!")
            
        if 'PreloadMediaContents' in data_description:
            preload_contents_count = len(data_description['PreloadMediaContents'])
            print(f"PreloadMediaContents found with {preload_contents_count} items")

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data for {original_lang}: {e}")
        continue
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON for {original_lang}: {e}")
        continue

    # 提取所需数据并格式化
    images_info = []
    for image in data.get('images', []):
        urlbase = f"https://www.bing.com{image['urlbase']}"
        tempkey = image['copyrightlink'].replace("https://www.bing.com/search?q=", "")
        tempkey = tempkey.split('&')[0]
        copyrightlink = tempkey.replace('+', ' ')
        
        # ====== 关键修改：提取图片ID用于匹配 ======
        image_id = get_image_id_from_url(image['urlbase'])
        
        image_info = {
            'fullstartdate': image['fullstartdate'],
            'date': datetime.strptime(image['enddate'], '%Y%m%d').strftime('%Y%m%d'),
            'url': f"https://www.bing.com{image['urlbase']}_1920x1080.jpg",
            'urlbase': urlbase,
            'copyright': image['copyright'],
            'copyrightKeyword': urllib.parse.unquote(copyrightlink),
            'hsh': image['hsh'],
            '_image_id': image_id  # 添加图片ID用于匹配
        }
        images_info.append(image_info)
    
    print(f"\nMain API image IDs: {[img['_image_id'] for img in images_info if img['_image_id']]}")
    
    # ====== 改进的描述匹配逻辑 ======
    # 创建一个函数来处理描述数据
    def process_media_contents(media_list, source_name):
        matched_count = 0
        available_ids = []
        
        for media_item in media_list:
            try:
                # 检查必要字段
                if 'ImageContent' not in media_item or \
                   'Description' not in media_item['ImageContent'] or \
                   'Image' not in media_item['ImageContent'] or \
                   'Url' not in media_item['ImageContent']['Image']:
                    continue

                # ====== 关键修改：从 model API 提取图片 ID ======
                model_image_url = media_item['ImageContent']['Image']['Url']
                model_image_id = get_image_id_from_url(model_image_url)
                
                if not model_image_id:
                    continue
                    
                available_ids.append(model_image_id)
                description = media_item['ImageContent']['Description']
                
                # 匹配并添加描述
                for image_info in images_info:
                    # ====== 关键修改：使用图片ID进行匹配 ======
                    if image_info['_image_id'] == model_image_id:
                        # 只在还没有描述时添加（优先使用 MediaContents）
                        if 'description' not in image_info:
                            image_info['description'] = description
                            
                            # 根据你的要求，注释掉 title 和 headline
                            # if 'Title' in media_item['ImageContent']:
                            #     image_info['title'] = media_item['ImageContent']['Title']
                            # if 'Headline' in media_item['ImageContent']:
                            #     image_info['headline'] = media_item['ImageContent']['Headline']
                            
                            matched_count += 1
                            print(f"  ✓ [{source_name}] Matched: {model_image_id}")
                        break
                        
            except Exception as e:
                print(f"  Error processing item from {source_name}: {e}")
                continue
        
        return matched_count, available_ids
    
    # 首先处理 MediaContents
    description_count = 0
    all_available_ids = []
    
    if 'MediaContents' in data_description and isinstance(data_description['MediaContents'], list):
        count, ids = process_media_contents(data_description['MediaContents'], "MediaContents")
        description_count += count
        all_available_ids.extend(ids)
        print(f"\nMediaContents IDs: {ids}")
    
    # 然后处理 PreloadMediaContents
    if 'PreloadMediaContents' in data_description and isinstance(data_description['PreloadMediaContents'], list):
        count, ids = process_media_contents(data_description['PreloadMediaContents'], "PreloadMediaContents")
        description_count += count
        all_available_ids.extend(ids)
        print(f"PreloadMediaContents IDs: {ids}")
    
    # ====== 诊断信息 ======
    print(f"\n--- Summary for {original_lang} ---")
    print(f"Total images from main API: {len(images_info)}")
    print(f"Total descriptions matched: {description_count}")
    print(f"Images without description: {len(images_info) - description_count}")
    
    if description_count < len(images_info):
        missing_ids = [img['_image_id'] for img in images_info if 'description' not in img]
        print(f"Missing descriptions for IDs: {missing_ids}")
        print(f"Available IDs in description API: {list(set(all_available_ids))}")
    
    # ====== 清理临时字段 ======
    # 移除用于匹配的临时 _image_id 字段
    for img in images_info:
        if '_image_id' in img:
            del img['_image_id']

    # 定义与语言代码相关的文件路径
    file_path_current = f'./bing/bing_{file_lang}.json'
    file_path_yearly = f'./bing/{thisyear}/bing_{file_lang}.json'

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
    weekly_file_path = f'./bing/weekly/bing_{file_lang}.json'
    # 按日期倒序排序每周数据
    images_info.sort(key=lambda x: datetime.strptime(x['date'], '%Y%m%d'), reverse=True)
    write_json(weekly_file_path, images_info)

    print(f"✓ Data saved to '{weekly_file_path}'")

print("\n========== All languages processed ==========")
print("Ends time: ", datetime.now(timezone.utc))