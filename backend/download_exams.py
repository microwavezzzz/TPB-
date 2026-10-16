import subprocess
import os
import time

tabs = [
    ("home", "1609636685"),
    ("sabtu", "2008073238"),
    ("non_sabtu", "1846459079"),
    ("biologi", "1788823362"),
    ("bahasa_indonesia", "1693598429"),
    ("fisika", "1655440009"),
    ("kimia", "419953202"),
    ("dtd_pk", "11151583"),
]

os.makedirs("data/exams", exist_ok=True)

for name, gid in tabs:
    target_path = f"data/exams/{name}.csv"
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
        print(f"Already exists: {name} ({os.path.getsize(target_path)} bytes)")
        continue
    
    url = f"https://docs.google.com/spreadsheets/d/1LWvvQzJ28fH4Crgq18B3Kp6Hn9EqmxTC2YT-NFcghIo/export?format=csv&gid={gid}"
    print(f"Downloading {name} (gid={gid})...")
    t0 = time.time()
    cmd = [
        "curl.exe", "-4", "-s", "-L", "--max-time", "60",
        url, "-o", target_path
    ]
    res = subprocess.run(cmd)
    if os.path.exists(target_path):
        size = os.path.getsize(target_path)
        print(f"Done {name}: {size} bytes in {time.time()-t0:.2f}s")
    else:
        print(f"Failed {name}")
