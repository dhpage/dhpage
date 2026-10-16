"""Join official public GBIS workbooks to the city's administrative-dong stop CSV.
Read-only extraction of spreadsheets; generated JSON contains public metadata only.
Usage: python scripts/build_catalog.py SOURCE_DIRECTORY CITY_CSV OUTPUT_DIRECTORY
Requires openpyxl for reading the source workbooks. The application itself uses Node.
"""
import collections
import csv
import datetime
import hashlib
import json
import math
import pathlib
import re
import sys
import warnings
import zipfile
import xml.etree.ElementTree as ET
import openpyxl

warnings.filterwarnings('ignore', message='Workbook contains no default style')
source, city_csv, out = map(pathlib.Path, sys.argv[1:4])
out.mkdir(parents=True, exist_ok=True)
dong_names = {'분당동', '수내1동', '수내2동', '수내3동', '정자동', '정자1동', '정자2동', '정자3동', '서현1동', '서현2동', '이매1동', '이매2동', '야탑1동', '야탑2동', '야탑3동', '판교동', '삼평동', '백현동', '금곡동', '구미동', '구미1동', '운중동'}

def rows(filename):
    workbook = openpyxl.load_workbook(source / filename, read_only=True, data_only=True)
    try:
        for sheet in workbook.worksheets:
            if sheet.title == '좌표계안내':
                continue
            # GBIS exports have A1 dimensions even when a sheet contains 65,001 rows.
            sheet.reset_dimensions()
            iterator = sheet.values
            header = next(iterator)
            for row in iterator:
                yield {str(key).strip(): ('' if value is None else str(value).strip()) for key, value in zip(header, row)}
    finally:
        workbook.close()

def mobile(value):
    value = str(value).strip()
    return value.zfill(5) if value.isdigit() else None

def meters(x, y, row):
    return math.hypot((float(row['X']) - x) * 111195 * math.cos(y * math.pi / 180), (float(row['Y']) - y) * 111195)

city = list(csv.DictReader(city_csv.open(encoding='utf-8-sig')))
bundang = [row for row in city if row['행정동'].strip() in dong_names]
stations = collections.defaultdict(list)
station_rows = 0
for row in rows('GGD_StationInfo_M.xlsx'):
    station_rows += 1
    code = mobile(row['MOBILE_NO'])
    if code and row['X'] and row['Y']:
        stations[code].append(row)

matched_stations, unmatched, distances = {}, [], []
for row in bundang:
    code = mobile(row['정류장번호(ID)'])
    try:
        x, y = float(row['경도']), float(row['위도'])
    except ValueError:
        unmatched.append({'mobileNo': code, 'name': row['정류장명'], 'reason': 'missing_city_coordinates'})
        continue
    candidates = [(meters(x, y, station), station) for station in stations.get(code, [])]
    good = [(distance, station) for distance, station in candidates if distance <= 250]
    if not good:
        unmatched.append({'mobileNo': code, 'name': row['정류장명'], 'dong': row['행정동'], 'reason': 'no_mobile_match' if not candidates else 'coordinate_mismatch', 'nearestMeters': round(min((d for d, _ in candidates), default=0), 1) if candidates else None})
    for distance, station in good:
        matched_stations[station['STATION_ID']] = {'id': station['STATION_ID'], 'mobileNo': code, 'name': station['STATION_NM'], 'dong': row['행정동'], 'coordinates': [float(station['X']), float(station['Y'])], 'crossCheckMeters': round(distance, 1)}
        distances.append(distance)

route_info = {row['노선ID']: row for row in rows('GGD_RouteInfo_M.xlsx')}
base_route_count = len(route_info)
extra_path = pathlib.Path(sys.argv[4]) if len(sys.argv) > 4 else None
extras = json.loads(extra_path.read_text(encoding='utf-8'))['rows'] if extra_path and extra_path.exists() else []
for item in extras:
    route_info[str(item['routeId'])] = {'노선ID': str(item['routeId']), '노선번호': str(item['routeName']), '기점': item['startStationName'], '종점': item['endStationName'], '관할관청': item.get('adminName', ''), '운행업체': item.get('companyName', ''), '노선유형': item.get('routeTypeName', '')}
route_stops, route_names = collections.defaultdict(set), {}
relation_rows = 0
for row in rows('GGD_RouteStationInfo_M.xlsx'):
    relation_rows += 1
    if row['STATION_ID'] in matched_stations:
        route_stops[row['ROUTE_ID']].add(row['STATION_ID'])
        route_names[row['ROUTE_ID']] = row['ROUTE_NM']

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
catalog, missing_info = [], []
for route_id, stop_ids in route_stops.items():
    info = route_info.get(route_id)
    if not info:
        missing_info.append({'id': route_id, 'name': route_names[route_id], 'bundangStopCount': len(stop_ids)})
        continue
    catalog.append({'id': route_id, 'name': info['노선번호'], 'label': info['기점'] + ' ↔ ' + info['종점'], 'startStationName': info['기점'], 'endStationName': info['종점'], 'adminName': info['관할관청'], 'companyName': info['운행업체'], 'routeTypeName': info.get('노선유형', ''), 'bundangStopCount': len(stop_ids), 'verifiedAt': now[:10]})

catalog.sort(key=lambda route: ([int(part) if part.isdigit() else part for part in re.split(r'(\d+)', route['name'])], route['id']))
files = ['GGD_RouteInfo_M.xlsx', 'GGD_RouteStationInfo_M.xlsx', 'GGD_StationInfo_M.xlsx']
coverage = {'generatedAt': now, 'method': '성남시 행정동으로 분당구 정류장 선정 → 5자리 정류장번호와 좌표(250m 이내)로 GBIS 정류소 대조 → GBIS 노선경유정보·노선정보 조인', 'gbisCreatedDate': '2026-10-16', 'cityStopDataDate': '2026-04-08', 'cityStopRows': len(city), 'bundangCityStopRows': len(bundang), 'matchedGbisStopCount': len(matched_stations), 'unmatchedCityStopRows': len(unmatched), 'gbisStationRows': station_rows, 'gbisRouteRows': len(route_info), 'gbisRouteStationRows': relation_rows, 'routeCount': len(catalog), 'routesMissingMetadata': len(missing_info), 'maxMatchedStopDistanceMeters': round(max(distances, default=0), 1), 'scope': '공식 자료에서 분당구 정류소 경유를 확인한 GBIS 노선. 무정차 통과 및 성남시 정류장 자료에 없는 신설 정류소 경유 노선은 포함을 보장하지 않음.', 'sources': [{'url': 'https://www.data.go.kr/data/15077307/fileData.do', 'date': '2026-04-08'}, {'url': 'https://www.seongnam.go.kr/cn040104', 'purpose': '분당구 행정동 구분'}] + [{'url': 'https://www.gbis.go.kr/service/adm/banner/download.action?cmd=download&fName=' + name, 'sha256': hashlib.sha256((source / name).read_bytes()).hexdigest()} for name in files]}
for name, value in [('routes.json', catalog), ('catalog-coverage.json', coverage), ('bundang-stops.json', list(matched_stations.values())), ('catalog-unmatched.json', {'cityStops': unmatched, 'routesMissingMetadata': missing_info})]:
    (out / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in coverage.items() if key != 'sources'}, ensure_ascii=False))
