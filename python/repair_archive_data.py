import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path


BASE_DIR = Path("bing")
REPORT_PATH = Path("python/archive_data_repair_report.json")
REQUIRED_FIELDS = [
    "fullstartdate",
    "date",
    "url",
    "urlbase",
    "copyright",
    "copyrightKeyword",
    "hsh",
]
OPTIONAL_FIELDS = {"description", "maplink"}
POST_2408_CUTOFF = "20240801"


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=4) + "\n",
        encoding="utf-8",
    )


def archive_paths():
    paths = []
    paths.extend(sorted(BASE_DIR.glob("bing_*.json")))
    for child in sorted(BASE_DIR.iterdir()):
        if child.is_dir() and child.name.isdigit():
            paths.extend(sorted(child.glob("bing_*.json")))
    weekly = BASE_DIR / "weekly"
    if weekly.exists():
        paths.extend(sorted(weekly.glob("bing_*.json")))
    return paths


def region_from_path(path):
    return path.stem


def image_id(item):
    urlbase = item.get("urlbase") or item.get("url") or ""
    marker = "OHR."
    if marker not in urlbase:
        return None
    tail = urlbase.split(marker, 1)[1]
    return "OHR." + tail.split("_", 1)[0].split(".", 1)[0]


def corrected_en_gb_date(item):
    fullstartdate = item.get("fullstartdate")
    if not fullstartdate or len(fullstartdate) < 12:
        return None
    base_date = datetime.strptime(fullstartdate[:8], "%Y%m%d")
    if fullstartdate[8:12] != "0000":
        base_date += timedelta(days=1)
    return base_date.strftime("%Y%m%d")


def sort_items(items):
    items.sort(key=lambda x: (x.get("date") or "", x.get("fullstartdate") or ""), reverse=True)


def build_sources(files):
    by_region_fullstart = defaultdict(list)
    by_region_date_image = defaultdict(list)
    by_region_date_urlbase = defaultdict(list)

    for path, data in files.items():
        region = region_from_path(path)
        for item in data:
            fullstartdate = item.get("fullstartdate")
            date = item.get("date")
            img_id = image_id(item)
            urlbase = item.get("urlbase")
            if fullstartdate:
                by_region_fullstart[(region, fullstartdate)].append(item)
            if date and img_id:
                by_region_date_image[(region, date, img_id)].append(item)
            if date and urlbase:
                by_region_date_urlbase[(region, date, urlbase)].append(item)

    return by_region_fullstart, by_region_date_image, by_region_date_urlbase


def fill_required_fields(files, changed_paths):
    by_region_fullstart, by_region_date_image, by_region_date_urlbase = build_sources(files)
    fills = []

    for path, data in files.items():
        region = region_from_path(path)
        for index, item in enumerate(data):
            if (item.get("date") or "") < POST_2408_CUTOFF:
                continue

            sources = []
            fullstartdate = item.get("fullstartdate")
            date = item.get("date")
            img_id = image_id(item)
            urlbase = item.get("urlbase")
            if fullstartdate:
                sources.extend(by_region_fullstart.get((region, fullstartdate), []))
            if date and img_id:
                sources.extend(by_region_date_image.get((region, date, img_id), []))
            if date and urlbase:
                sources.extend(by_region_date_urlbase.get((region, date, urlbase), []))

            for field in REQUIRED_FIELDS:
                if item.get(field):
                    continue
                for source in sources:
                    if source is item or not source.get(field):
                        continue
                    item[field] = source[field]
                    changed_paths.add(path)
                    fills.append(
                        {
                            "file": str(path),
                            "index": index,
                            "date": item.get("date"),
                            "region": region,
                            "field": field,
                            "value": source[field],
                        }
                    )
                    break

    return fills


def fix_en_gb_dates(files, changed_paths):
    changes = []
    for path, data in files.items():
        if region_from_path(path) != "bing_en-GB":
            continue

        changed = False
        for index, item in enumerate(data):
            new_date = corrected_en_gb_date(item)
            old_date = item.get("date")
            if new_date and old_date != new_date:
                item["date"] = new_date
                changed_paths.add(path)
                changed = True
                changes.append(
                    {
                        "file": str(path),
                        "index": index,
                        "old_date": old_date,
                        "new_date": new_date,
                        "fullstartdate": item.get("fullstartdate"),
                        "copyrightKeyword": item.get("copyrightKeyword"),
                    }
                )
        if changed:
            sort_items(data)
    return changes


def item_identity(item):
    if item.get("fullstartdate"):
        return ("fullstartdate", item["fullstartdate"])
    img_id = image_id(item)
    if item.get("date") and img_id:
        return ("date_image", item["date"], img_id)
    if item.get("date") and item.get("urlbase"):
        return ("date_urlbase", item["date"], item["urlbase"])
    return None


def relocate_wrong_year_records(files, changed_paths):
    moves = []
    additions = defaultdict(list)
    removals = defaultdict(list)

    for path, data in files.items():
        parent = path.parent.name
        if not parent.isdigit():
            continue

        region = path.stem
        for index, item in enumerate(data):
            date = item.get("date") or ""
            if not date or date.startswith(parent):
                continue

            target_path = BASE_DIR / date[:4] / f"{region}.json"
            if target_path not in files:
                continue

            additions[target_path].append(item)
            removals[path].append(item)
            moves.append(
                {
                    "from": str(path),
                    "to": str(target_path),
                    "index": index,
                    "date": date,
                    "region": region,
                    "copyrightKeyword": item.get("copyrightKeyword"),
                }
            )

    for path, items in removals.items():
        remove_ids = {id(item) for item in items}
        files[path] = [item for item in files[path] if id(item) not in remove_ids]
        changed_paths.add(path)

    for path, items in additions.items():
        existing = {item_identity(item) for item in files[path]}
        for item in items:
            identity = item_identity(item)
            if identity and identity in existing:
                continue
            files[path].append(item)
            if identity:
                existing.add(identity)
        sort_items(files[path])
        changed_paths.add(path)

    return moves


def sync_root_records_to_years(files, changed_paths):
    additions = []

    for path, data in list(files.items()):
        if path.parent != BASE_DIR or not path.name.startswith("bing_"):
            continue

        region = path.stem
        for item in data:
            date = item.get("date") or ""
            if date < POST_2408_CUTOFF:
                continue

            target_path = BASE_DIR / date[:4] / f"{region}.json"
            if target_path not in files:
                continue

            identity = item_identity(item)
            if not identity:
                continue

            existing = {item_identity(existing_item) for existing_item in files[target_path]}
            if identity in existing:
                continue

            files[target_path].append(dict(item))
            changed_paths.add(target_path)
            additions.append(
                {
                    "from": str(path),
                    "to": str(target_path),
                    "date": date,
                    "region": region,
                    "copyrightKeyword": item.get("copyrightKeyword"),
                }
            )

    for path in changed_paths:
        if path in files:
            sort_items(files[path])

    return additions


def validate(files):
    missing_required = []
    duplicate_dates = []
    wrong_year = []

    for path, data in files.items():
        region = region_from_path(path)
        dates = []
        for index, item in enumerate(data):
            date = item.get("date") or ""
            if date:
                dates.append(date)

            if date >= POST_2408_CUTOFF:
                missing = [field for field in REQUIRED_FIELDS if not item.get(field)]
                if missing:
                    missing_required.append(
                        {
                            "file": str(path),
                            "index": index,
                            "date": date,
                            "region": region,
                            "missing": missing,
                            "copyright": item.get("copyright"),
                            "urlbase": item.get("urlbase"),
                        }
                    )

            parent = path.parent.name
            if parent.isdigit() and date and not date.startswith(parent):
                wrong_year.append(
                    {
                        "file": str(path),
                        "index": index,
                        "date": date,
                        "region": region,
                    }
                )

        for date, count in Counter(dates).items():
            if date >= POST_2408_CUTOFF and count > 1:
                duplicate_dates.append(
                    {
                        "file": str(path),
                        "region": region,
                        "date": date,
                        "count": count,
                    }
                )

    return {
        "missing_required": missing_required,
        "duplicate_dates": duplicate_dates,
        "wrong_year": wrong_year,
    }


def regenerate_data_index(files):
    years = {}
    for path, data in files.items():
        parent = path.parent.name
        if not parent.isdigit():
            continue
        years.setdefault(parent, {"regions": {}})
        years[parent]["regions"][path.stem] = len(data)

    current_year = max((int(year) for year in years), default=datetime.now().year)
    index = {
        "years": {year: years[year] for year in sorted(years)},
        "currentYear": current_year,
    }
    out_path = BASE_DIR / "data_index.json"
    out_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return str(out_path)


def main():
    paths = archive_paths()
    files = {path: load_json(path) for path in paths}
    changed_paths = set()

    en_gb_date_changes = fix_en_gb_dates(files, changed_paths)
    relocated_records = relocate_wrong_year_records(files, changed_paths)
    root_to_year_additions = sync_root_records_to_years(files, changed_paths)
    required_field_fills = fill_required_fields(files, changed_paths)

    for path in sorted(changed_paths):
        data = files[path]
        sort_items(data)
        write_json(path, data)

    index_path = regenerate_data_index(files)
    validation = validate(files)

    report = {
        "en_gb_date_changes": en_gb_date_changes,
        "relocated_records": relocated_records,
        "root_to_year_additions": root_to_year_additions,
        "required_field_fills": required_field_fills,
        "not_filled": {
            "description": "left unchanged by design",
            "maplink": "left unchanged by design",
        },
        "remaining": validation,
        "data_index": index_path,
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"en-GB date changes: {len(en_gb_date_changes)}")
    print(f"relocated records: {len(relocated_records)}")
    print(f"root-to-year additions: {len(root_to_year_additions)}")
    print(f"required field fills: {len(required_field_fills)}")
    print(f"remaining missing required: {len(validation['missing_required'])}")
    print(f"remaining duplicate dates: {len(validation['duplicate_dates'])}")
    print(f"wrong-year records: {len(validation['wrong_year'])}")
    print(f"report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
