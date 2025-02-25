import json
years = 2024
# langs = ['ROW', 'en-US', 'en-CA', 'en-GB', 'en-IN', 'es-ES', 'fr-FR', 'fr-CA', 'it-IT', 'ja-JP', 'pt-BR', 'de-DE', 'zh-CN']
langs = ['en-US']

for lang in langs:
    file_path = f'./bing/{years}/bing_{lang}.json'
    # 读取原始的 JSON 文件
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)

    # 筛选出 date 以 "2023" 开头的数据
    filtered_data = [item for item in data if item['date'].startswith(f'{years}')]

    # 将筛选后的数据写入新的 JSON 文件
    with open(file_path, 'w', encoding='utf-8') as outfile:
        json.dump(filtered_data, outfile, ensure_ascii=False, indent=4)

    print(f'已保存 bing_{lang}.json')
