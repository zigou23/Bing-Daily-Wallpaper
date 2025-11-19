import json
import os
import re

# 设置文件夹路径
folder_path = "../bing/"

# 读取所有 JSON 文件
files = [
    "bing_ROW.json",
    "bing_de-DE.json",
    "bing_en-CA.json",
    "bing_en-GB.json",
    "bing_en-IN.json",
    "bing_en-US.json",
    "bing_es-ES.json",
    "bing_fr-CA.json",
    "bing_fr-FR.json",
    "bing_it-IT.json",
    "bing_ja-JP.json",
    "bing_pt-BR.json",
    "bing_zh-CN.json"
]

def extract_image_theme(urlbase):
    """提取 urlbase 中的图片主题部分 (OHR.XXX)"""
    match = re.search(r'OHR\.([^_]+)', urlbase)
    return match.group(0) if match else None

data = {}
for file in files:
    file_path = os.path.join(folder_path, file)
    with open(file_path, 'r', encoding='utf-8') as f:
        locale = file.replace('bing_', '').replace('.json', '')
        data[locale] = json.load(f)

# 提取 ROW 的所有图片主题
row_themes = set()
for item in data['ROW']:
    theme = extract_image_theme(item['urlbase'])
    if theme:
        row_themes.add(theme)

print("=" * 80)
print(f"ROW 总共有 {len(row_themes)} 张不同的图片")
print("=" * 80)
print()

# 分析每个地区
results = {}
for locale in sorted(data.keys()):
    if locale == 'ROW':
        continue
    
    # 提取该地区的所有图片主题
    locale_themes = set()
    for item in data[locale]:
        theme = extract_image_theme(item['urlbase'])
        if theme:
            locale_themes.add(theme)
    
    # 计算缺失的图片（ROW 有但该地区没有的）
    missing = row_themes - locale_themes
    
    # 计算额外的图片（该地区有但 ROW 没有的）
    extra = locale_themes - row_themes
    
    # 计算匹配率
    match_rate = len(locale_themes & row_themes) / len(row_themes) * 100 if row_themes else 0
    
    results[locale] = {
        'total': len(locale_themes),
        'missing': missing,
        'extra': extra,
        'match_rate': match_rate
    }

# 输出结果
for locale in sorted(results.keys()):
    info = results[locale]
    missing_count = len(info['missing'])
    extra_count = len(info['extra'])
    
    print(f"【{locale}】")
    print(f"  总图片数: {info['total']}")
    print(f"  与 ROW 匹配率: {info['match_rate']:.1f}%")
    
    if missing_count == 0 and extra_count == 0:
        print(f"  ✓ 与 ROW 完全一致")
    else:
        if missing_count > 0:
            print(f"  ✗ 缺失 {missing_count} 张 ROW 中的图片")
        if extra_count > 0:
            print(f"  ✓ 独有 {extra_count} 张特色图片")
    print()

print("=" * 80)
print("统计完成")
print()

# 分类地区
identical = []
mostly_same = []
independent = []

for locale, info in results.items():
    if info['match_rate'] == 100:
        identical.append(locale)
    elif info['match_rate'] >= 80:
        mostly_same.append(locale)
    else:
        independent.append(locale)

if identical:
    print(f"✓ 与 ROW 完全一致的地区: {', '.join(identical)}")
if mostly_same:
    print(f"≈ 与 ROW 大部分相同的地区 (80%+): {', '.join(mostly_same)}")
if independent:
    print(f"✗ 使用独立图片库的地区 (<80%): {', '.join(independent)}")