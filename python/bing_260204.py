import requests
import json
import os
from datetime import datetime, timezone, timedelta
import urllib.parse
import time
import re

print("Starts time: ", datetime.now(timezone.utc))

# --- NEW: Helper function for retrying failed requests ---
def fetch_with_retry(url, retries=3, delay=5, timeout=10):
    """Tries to fetch a URL with a specified number of retries."""
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status() # Will raise an error for bad status codes
            return response.json() # Return JSON data on success
        except (requests.exceptions.RequestException, json.JSONDecodeError) as e:
            print(f"  Attempt {attempt + 1}/{retries} failed for {url}: {e}")
            if attempt < retries - 1:
                print(f"  Retrying in {delay} seconds...")
                time.sleep(delay)
            else:
                print(f"  Failed to fetch {url} after {retries} attempts.")
                return None # Return None on final failure

# --- NEW: Extract coordinates from MapLink URL ---
def extract_maplink_coordinates(url_string):
    """从MapLink URL中提取pp参数的坐标值"""
    if not url_string:
        return None
    # 使用正则表达式匹配 pp=坐标 的模式
    match = re.search(r'[&?]pp=([0-9.-]+,[0-9.-]+)', url_string)
    if match:
        return match.group(1)
    return None

# --- NEW: Date adjustment function ---
def adjust_date(date_str, subtract_day=False):
    """
    调整日期，如果需要则减去一天
    date_str: 格式为 'YYYYMMDD'
    subtract_day: 是否减去一天
    返回调整后的日期字符串
    """
    if not subtract_day:
        return date_str
    
    try:
        date_obj = datetime.strptime(date_str, '%Y%m%d')
        adjusted_date = date_obj - timedelta(days=1)
        return adjusted_date.strftime('%Y%m%d')
    except Exception as e:
        print(f"  Error adjusting date {date_str}: {e}")
        return date_str

# --- NEW: Updated merge function to fill missing descriptions ---
def update_and_merge_images(existing_images, new_images, date_field='date', unique_field='fullstartdate'):
    """
    Merges new images into an existing list,
    updating missing 'description' for existing images if found in the new data.
    """
    # Create a lookup for new images, keyed by the unique field (e.g., 'fullstartdate')
    # We store the whole image_info object to access its 'description'
    new_images_map = {}
    if unique_field:
        for img in new_images:
            if unique_field in img:
                new_images_map[img[unique_field]] = img
    
    # Create a set of existing unique IDs for quick lookup
    existing_ids = {img[unique_field] for img in existing_images if unique_field in img}

    # 1. Update existing images
    update_count = 0
    for existing_img in existing_images:
        if unique_field and unique_field in existing_img:
            unique_id = existing_img[unique_field]
            
            # Check if this existing image is in our new fetch
            if unique_id in new_images_map:
                new_img = new_images_map[unique_id]
                
                # This is the core logic: fill missing description
                if 'description' not in existing_img and 'description' in new_img:
                    print(f"  Updating missing description for {unique_id} ({existing_img.get(date_field)})")
                    existing_img['description'] = new_img['description']
                    update_count += 1
                
                # 同时更新 MapLink 坐标
                if 'maplink' not in existing_img and 'maplink' in new_img:
                    print(f"  Updating missing maplink for {unique_id} ({existing_img.get(date_field)})")
                    existing_img['maplink'] = new_img['maplink']
                    update_count += 1

    if update_count > 0:
        print(f"  Updated {update_count} existing image(s) with missing descriptions/maplinks.")

    # 2. Add new images
    add_count = 0
    for new_img in new_images:
        # Check by unique_field if available
        if unique_field and unique_field in new_img:
            if new_img[unique_field] not in existing_ids:
                existing_images.append(new_img)
                existing_ids.add(new_img[unique_field])
                add_count += 1
        # Fallback for old data that might not have unique_field
        elif date_field in new_img:
            existing_dates = {img[date_field] for img in existing_images if date_field in img}
            if new_img[date_field] not in existing_dates:
                 existing_images.append(new_img)
                 add_count += 1
    
    if add_count > 0:
        print(f"  Added {add_count} new image(s).")


    # 按日期倒序排序
    existing_images.sort(key=lambda x: datetime.strptime(x[date_field], '%Y%m%d'), reverse=True)
    return existing_images
# --- END of NEW functions ---


# 定义语言代码列表
languages = ['en-ROW', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'es-ES', 'fr-FR', 'fr-CA', 'it-IT', 'ja-JP', 'pt-BR', 'de-DE', 'zh-CN']

# 定义需要使用 startdate 的语言
USE_STARTDATE_LANGUAGES = ['en-CA', 'en-GB', 'en-US', 'fr-CA', 'pt-BR', 'en-ROW']

# 获取当前年份（用于清理逻辑）
current_year = datetime.now().year

# 基础目录
base_directories = ['./bing', './bing/weekly']
for directory in base_directories:
    if not os.path.exists(directory):
        os.makedirs(directory)

# 辅助函数：根据 date 字段获取年份
def get_year_from_date(date_str):
    """从日期字符串中提取年份，格式为 YYYYMMDD"""
    if date_str and len(date_str) >= 4:
        return date_str[:4]
    return str(current_year)

# REMOVED old merge_images function. It's replaced by the new one above.

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
    
    # 语言不支持,会使用通用 ROW 数据(仅用于文件命名)
    original_lang = lang
    file_lang = lang
    if (lang == "en-ROW"): 
        file_lang = "ROW"
    
    # 检查是否使用 startdate
    use_startdate = lang in USE_STARTDATE_LANGUAGES
    if use_startdate:
        print(f"Note: Will use startdate instead of enddate for {lang}")

    try:
        # --- MODIFIED: Use fetch_with_retry ---
        print(f"Fetching main API: {api_url}")
        data = fetch_with_retry(api_url)
        
        # 添加短暂延迟
        time.sleep(0.5)
        
        print(f"Fetching description API: {api_description}")
        data_description = fetch_with_retry(api_description)

        # 如果任一请求失败,则跳过此语言
        if data is None or data_description is None:
            print(f"Skipping {original_lang} due to fetch failure.")
            continue
        # --- END of MODIFIED block ---
        
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

    # --- REMOVED old request/json error handling, fetch_with_retry does it ---
    except Exception as e: # Catch any other unexpected error
        print(f"An unexpected error occurred for {original_lang}: {e}")
        continue

    # 提取所需数据并格式化
    images_info = []
    for image in data.get('images', []):
        urlbase = f"https://www.bing.com{image['urlbase']}"
        tempkey = image['copyrightlink'].replace("https://www.bing.com/search?q=", "")
        tempkey = tempkey.split('&')[0]
        copyrightlink = tempkey.replace('+', ' ')
        
        # ====== 关键修改:提取图片ID用于匹配 ======
        image_id = get_image_id_from_url(image['urlbase'])
        
        # ====== 日期选择:根据语言使用 startdate 或 enddate ======
        if use_startdate:
            date_value = datetime.strptime(image['startdate'], '%Y%m%d').strftime('%Y%m%d')
            print(f"  Using startdate: {date_value} for image {image_id}")
        else:
            date_value = datetime.strptime(image['enddate'], '%Y%m%d').strftime('%Y%m%d')
        
        image_info = {
            'fullstartdate': image['fullstartdate'],
            'date': date_value,  # 使用选定的日期
            'url': f"https://www.bing.com{image['urlbase']}_1920x1080.jpg",
            'urlbase': urlbase,
            'copyright': image['copyright'],
            'copyrightKeyword': urllib.parse.unquote(copyrightlink),
            'hsh': image['hsh'],
            '_image_id': image_id  # 添加图片ID用于匹配
        }
        images_info.append(image_info)
    
    print(f"\nMain API image IDs: {[img['_image_id'] for img in images_info if img.get('_image_id')]}")
    
    # ====== 改进的描述匹配逻辑 ======
    # 创建一个函数来处理描述数据
    def process_media_contents(media_list, source_name):
        matched_count = 0
        available_ids = []
        
        if not isinstance(media_list, list): # Safety check
            return 0, []

        for media_item in media_list:
            try:
                # 检查必要字段
                if 'ImageContent' not in media_item or \
                   'Description' not in media_item['ImageContent'] or \
                   'Image' not in media_item['ImageContent'] or \
                   'Url' not in media_item['ImageContent']['Image']:
                    continue

                # ====== 关键修改:从 model API 提取图片 ID ======
                model_image_url = media_item['ImageContent']['Image']['Url']
                model_image_id = get_image_id_from_url(model_image_url)
                
                if not model_image_id:
                    continue
                    
                available_ids.append(model_image_id)
                description = media_item['ImageContent']['Description']
                
                # ====== 新增:提取 MapLink 坐标 ======
                maplink_coordinates = None
                if 'MapLink' in media_item['ImageContent'] and 'Url' in media_item['ImageContent']['MapLink']:
                    maplink_url = media_item['ImageContent']['MapLink']['Url']
                    maplink_coordinates = extract_maplink_coordinates(maplink_url)
                    if maplink_coordinates:
                        print(f"  Found MapLink coordinates: {maplink_coordinates} for {model_image_id}")
                
                # 匹配并添加描述
                for image_info in images_info:
                    # ====== 关键修改:使用图片ID进行匹配 ======
                    if image_info.get('_image_id') == model_image_id:
                        # 只在还没有描述时添加(优先使用 MediaContents)
                        if 'description' not in image_info:
                            image_info['description'] = description
                            
                            # 如果有 MapLink 坐标,也添加进去
                            if maplink_coordinates:
                                image_info['maplink'] = maplink_coordinates
                            
                            # 根据你的要求,注释掉 title 和 headline
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
    
    if 'MediaContents' in data_description:
        count, ids = process_media_contents(data_description['MediaContents'], "MediaContents")
        description_count += count
        all_available_ids.extend(ids)
        print(f"\nMediaContents IDs: {ids}")
    
    # 然后处理 PreloadMediaContents
    if 'PreloadMediaContents' in data_description:
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
        missing_ids = [img['_image_id'] for img in images_info if 'description' not in img and '_image_id' in img]
        print(f"Missing descriptions for IDs: {missing_ids}")
        print(f"Available IDs in description API: {list(set(all_available_ids))}")
    
    # ====== 清理临时字段 ======
    # 移除用于匹配的临时 _image_id 字段
    for img in images_info:
        if '_image_id' in img:
            del img['_image_id']

    # 定义与语言代码相关的文件路径
    file_path_current = f'./bing/bing_{file_lang}.json'

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

    # ====== 收集所有涉及的年份 ======
    years_involved = set()
    for img in images_info:
        year = get_year_from_date(img.get('date', ''))
        years_involved.add(year)
    
    print(f"\nYears involved in this batch: {sorted(years_involved)}")
    
    # 确保所有涉及年份的目录存在
    for year in years_involved:
        year_dir = f'./bing/{year}'
        if not os.path.exists(year_dir):
            os.makedirs(year_dir)
            print(f"Created directory: {year_dir}")

    # 读取并更新主目录数据
    print(f"\nReading existing data...")
    existing_images_info_current = read_json(file_path_current)
    
    print(f"Updating {file_path_current}...")
    existing_images_info_current = update_and_merge_images(existing_images_info_current, images_info, date_field='date', unique_field='fullstartdate')
    
    print(f"Writing updates back to {file_path_current}...")
    write_json(file_path_current, existing_images_info_current)

    # ====== 按年份分组写入对应年份文件夹 ======
    for year in years_involved:
        file_path_yearly = f'./bing/{year}/bing_{file_lang}.json'
        
        # 筛选出属于该年份的数据
        year_images = [img for img in images_info if get_year_from_date(img.get('date', '')) == year]
        
        if year_images:
            existing_yearly = read_json(file_path_yearly)
            print(f"Updating {file_path_yearly} with {len(year_images)} image(s)...")
            existing_yearly = update_and_merge_images(existing_yearly, year_images, date_field='date', unique_field='fullstartdate')
            write_json(file_path_yearly, existing_yearly)

    # 将数据写入以语言代码命名的每周JSON文件
    weekly_file_path = f'./bing/weekly/bing_{file_lang}.json'
    # 按日期倒序排序每周数据
    images_info.sort(key=lambda x: datetime.strptime(x['date'], '%Y%m%d'), reverse=True)
    write_json(weekly_file_path, images_info)

    print(f"✓ Data saved to '{weekly_file_path}'")

# ====== 新增：在 1 月 7 日或 8 日清理年份文件夹中的上一年数据 ======
def cleanup_previous_year_data():
    """
    在 1 月 7 日或 8 日清理年份文件夹中 date 字段为上一年的记录。
    只影响 /bing/{year}/ 文件夹，不影响主目录 /bing/*.json
    """
    today = datetime.now()
    current_year = today.year
    
    # 只在 1 月 7 日或 8 日执行清理
    if today.month != 1 or today.day not in [7, 8]:
        print(f"\nCleanup: Not cleanup day (current: {today.month}/{today.day}), skipping...")
        return
    
    previous_year = str(current_year - 1)
    yearly_dir = f'./bing/{current_year}'
    
    if not os.path.exists(yearly_dir):
        print(f"\nCleanup: Directory {yearly_dir} not found, skipping...")
        return
    
    print(f"\n========== Cleanup: Removing {previous_year} data from {yearly_dir} ==========")
    
    for filename in os.listdir(yearly_dir):
        if filename.endswith('.json'):
            filepath = os.path.join(yearly_dir, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                original_count = len(data)
                # 过滤掉 date 字段以上一年开头的记录
                cleaned_data = [item for item in data if not item.get('date', '').startswith(previous_year)]
                removed_count = original_count - len(cleaned_data)
                
                if removed_count > 0:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(cleaned_data, f, ensure_ascii=False, indent=4)
                    print(f"  ✓ {filename}: removed {removed_count} items from {previous_year}")
                else:
                    print(f"  ○ {filename}: no {previous_year} data to remove")
            except Exception as e:
                print(f"  ✗ Error processing {filename}: {e}")
    
    print("========== Cleanup completed ==========")

# 执行清理
cleanup_previous_year_data()

# ====== 新增：自动生成 data_index.json ======
def generate_data_index():
    """
    扫描 bing/ 下所有年份目录，统计每个区域的 JSON 文件记录数，
    生成 data_index.json 供 archive.html 使用。
    """
    print("\n========== Generating data_index.json ==========")
    base_dir = './bing'
    result = {}
    
    for y in sorted(os.listdir(base_dir)):
        year_dir = os.path.join(base_dir, y)
        if not (y.isdigit() and os.path.isdir(year_dir)):
            continue
        json_files = [f for f in os.listdir(year_dir) if f.endswith('.json')]
        if not json_files:
            continue
        
        regions = {}
        for f in sorted(json_files):
            region_code = f.replace('.json', '')
            try:
                with open(os.path.join(year_dir, f), 'r', encoding='utf-8') as fp:
                    data = json.load(fp)
                regions[region_code] = len(data)
            except Exception as e:
                print(f"  Warning: Failed to read {year_dir}/{f}: {e}")
                continue
        
        result[y] = {"regions": regions}
        print(f"  {y}: {regions}")
    
    index = {"years": result, "currentYear": current_year}
    out_path = os.path.join(base_dir, 'data_index.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, indent=2, ensure_ascii=False)
    print(f"✓ Wrote {out_path}")

# 执行生成索引
generate_data_index()

print("\n========== All languages processed ==========")
print("Ends time: ", datetime.now(timezone.utc))