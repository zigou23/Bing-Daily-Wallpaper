# Bing Daily Wallpaper

[![License](https://img.shields.io/github/license/zigou23/Bing-Daily-Wallpaper)](/LICENSE)

Daily automatic collection and archival of Bing search engine's beautiful wallpapers, stored in JSON format, supporting multiple regional versions.

## 📖 Project Overview

This project uses automated scripts to daily fetch Bing search engine's background wallpapers and convert wallpaper information into structured JSON format for storage. The project contains partial English wallpaper data from 2019 and comprehensive data starting from August 2024, supporting multiple countries and regions. (Due to changes in the Bing API, some "description" parameters are unavailable for the period from August 16, 2025, to November 10, 2025.)

## 📁 Project Structure

```
Bing-Daily-Wallpaper/
├── .github/workflows/      # GitHub Actions automated workflows
├── bing/                   # Wallpaper data storage directory
│   ├── 2019/              # 2019 wallpaper data
│   ├── 2020/              # 2020 wallpaper data
│   ├── 2021/              # 2021 wallpaper data
│   ├── 2022/              # 2022 wallpaper data
│   ├── 2023/              # 2023 wallpaper data
│   ├── 2024/              # 2024 wallpaper data
│   ├── 2025/              # 2025 wallpaper data
│   ├── old-2408/          # Historical archive data
│   ├── weekly/            # Weekly summary data
│   ├── bing_ROW.json      # Rest of World version
│   ├── bing_de-DE.json    # Germany version
│   ├── bing_en-CA.json    # Canada (English) version
│   ├── bing_en-GB.json    # United Kingdom version
│   ├── bing_en-IN.json    # India (English) version
│   ├── bing_en-US.json    # United States version
│   ├── bing_es-ES.json    # Spain version
│   ├── bing_fr-CA.json    # Canada (French) version
│   ├── bing_fr-FR.json    # France version
│   ├── bing_it-IT.json    # Italy version
│   ├── bing_ja-JP.json    # Japan version
│   ├── bing_pt-BR.json    # Brazil version
│   └── Check-date-for-missing-or-duplicates.py  # Data integrity check script
├── python/                # Python scripts directory
├── LICENSE               # Open source license
└── README.md            # Project documentation
```

## 🌍 Supported Regional Versions

The project supports Bing wallpapers from the following 12 regional versions:

| Region Code | Region Name      | JSON File         |
| :---------- | :--------------- | :---------------- |
| ROW         | Rest of World    | `bing_ROW.json`   |
| de-DE       | Germany          | `bing_de-DE.json` |
| en-CA       | Canada (English) | `bing_en-CA.json` |
| en-GB       | United Kingdom   | `bing_en-GB.json` |
| en-IN       | India (English)  | `bing_en-IN.json` |
| en-US       | United States    | `bing_en-US.json` |
| es-ES       | Spain            | `bing_es-ES.json` |
| fr-CA       | Canada (French)  | `bing_fr-CA.json` |
| fr-FR       | France           | `bing_fr-FR.json` |
| it-IT       | Italy            | `bing_it-IT.json` |
| ja-JP       | Japan            | `bing_ja-JP.json` |
| pt-BR       | Brazil           | `bing_pt-BR.json` |

## 📝 JSON Data Structure

Each JSON file contains an array of wallpaper objects, with each object containing the following fields:

```json
[
    {
        "fullstartdate": "202511260800",
        "date": "20251127",
        "url": "https://www.bing.com/th?id=OHR.OliveGrove_EN-US7076835672_1920x1080.jpg",
        "urlbase": "https://www.bing.com/th?id=OHR.OliveGrove_EN-US7076835672",
        "copyright": "Olive orchard in the Serra de Tramuntana, Mallorca, Balearic Islands, Spain (© cinoby/Getty Images)",
        "copyrightKeyword": "World Olive Tree Day",
        "hsh": "b493a772c4568c7789a58fb2bcd85f14",
        "description": "Ancient yet vibrant, twisted yet resilient..."
    }
]
```

### Field Descriptions

| Field Name         | Type   | Description                                                  | Example                                            |
| :----------------- | :----- | :----------------------------------------------------------- | :------------------------------------------------- |
| `fullstartdate`    | String | Complete start date timestamp (Format: YYYYMMDDHHmm)         | `"202511260800"`                                   |
| `date`             | String | Wallpaper date (Format: YYYYMMDD)                            | `"20251127"`                                       |
| `url`              | String | Complete wallpaper image URL, default 1920x1080 resolution   | `"https://www.bing.com/th?id=OHR...1920x1080.jpg"` |
| `urlbase`          | String | Base wallpaper URL (without resolution parameters), can be used to fetch different resolutions | `"https://www.bing.com/th?id=OHR..."`              |
| `copyright`        | String | Copyright information, including location, photographer, etc. | `"Olive orchard...© cinoby/Getty Images"`          |
| `copyrightKeyword` | String | Copyright keyword or theme tag                               | `"World Olive Tree Day"`                           |
| `hsh`              | String | Image hash value for unique identification                   | `"b493a772c4568c7789a58fb2bcd85f14"`               |
| `description`      | String | Detailed wallpaper description text, introducing background story | `"Ancient yet vibrant..."`                         |

## 🖼️ Image Resolution Options

By appending different resolution suffixes to the `urlbase`, you can obtain wallpaper images in various quality levels:

### Available Resolutions

| **Resolution Suffix**   | **Resolution** | **Aspect Ratio** | **Description**                             | **Typical File Size** |
| ----------------------- | -------------- | ---------------- | ------------------------------------------- | --------------------- |
| **Landscape / Desktop** |                |                  |                                             |                       |
| `_UHD.jpg`              | 3840×2160      | 16:9             | **4K Ultra HD** (Highest quality available) | 2 MB - 5 MB           |
| `_1920x1200.jpg`        | 1920×1200      | 16:10            | WUXGA (Standard 16:10 Widescreen)           | 800 KB - 1.5 MB       |
| `_1920x1080.jpg`        | 1920×1080      | 16:9             | **Full HD** (Standard Desktop/Laptop)       | 400 KB - 1.0 MB       |
| `_1366x768.jpg`         | 1366×768       | 16:9             | HD (Entry-level Laptops)                    | 200 KB - 500 KB       |
| `_1280x768.jpg`         | 1280×768       | 5:3              | WXGA (Older Widescreen Monitors)            | 150 KB - 400 KB       |
| `_1280x720.jpg`         | 1280×720       | 16:9             | HD 720p (Standard HD Video/Display)         | 150 KB - 350 KB       |
| `_1024x768.jpg`         | 1024×768       | 4:3              | XGA (Legacy CRT/Old iPads)                  | 150 KB - 350 KB       |
| `_800x600.jpg`          | 800×600        | 4:3              | SVGA (Low Resolution/Thumbnail)             | 100 KB - 250 KB       |
| **Portrait / Mobile**   |                |                  |                                             |                       |
| `_1080x1920.jpg`        | 1080×1920      | 9:16             | **Full HD Mobile** (Most Smartphones)       | 400 KB - 900 KB       |
| `_768x1280.jpg`         | 768×1280       | 3:5              | WXGA Mobile (Older Tablets/Phones)          | 200 KB - 500 KB       |
| `_720x1280.jpg`         | 720×1280       | 9:16             | HD Mobile (Standard Mobile HD)              | 200 KB - 450 KB       |
| `_480x800.jpg`          | 480×800        | 3:5              | WVGA (Legacy Mobile Devices)                | 50 KB - 150 KB        |

## 📊 Data Organization

### Annual Folders

Wallpaper data for each year is stored independently in `bing/YYYY/` directories for easy time-based retrieval.

### Weekly Summaries

The `bing/weekly/` directory stores weekly wallpaper summary data for convenient batch viewing and processing.

### Historical Archives

`bing/old-2408/` contains historical data archives from before August 2024.

## 📅 Update Frequency

- **Automatic Updates**: Daily automatic fetching of latest wallpapers via GitHub Actions
- **Data Timeliness**: Updates daily at UTC time, may vary by region due to time zones

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

If you find:

- Missing or incorrect data (Due to changes in the Bing API, some `"description"` parameters are unavailable for the period from August 16, 2025, to November 10, 2025.)
- Need support for new regional versions
- Script improvement suggestions
- Documentation improvements

Please submit feedback anytime!

## 📄 License

This project is licensed under the terms specified in the [LICENSE](/LICENSE) file.

## ⚠️ Disclaimer

All wallpaper copyrights belong to their respective authors and Microsoft. This project is for educational and research purposes only. Please respect copyright laws and terms of service when using these images.

## ⭐ Star History

If this project helps you, please give it a ⭐ Star!

## 🔗 Related Links

- [GitHub Repository](https://github.com/zigou23/Bing-Daily-Wallpaper)
- [Bing Official Website](https://www.bing.com/)
