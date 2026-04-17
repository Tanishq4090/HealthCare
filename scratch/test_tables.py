import urllib.request
import json

with open('.env', 'r') as f:
    env = f.read()
    url = [line.split('=')[1] for line in env.split('\n') if line.startswith('VITE_SUPABASE_URL')][0]
    key = [line.split('=')[1] for line in env.split('\n') if line.startswith('VITE_SUPABASE_ANON_KEY')][0]

def get_table(name):
    req = urllib.request.Request(f"{url}/rest/v1/{name}?select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        urllib.request.urlopen(req)
        print(f"Table {name} EXISTS.")
    except urllib.error.HTTPError as e:
        print(f"Table {name} ERROR: {e.read().decode()}")

# test payroll, attendance, and workers_legacy
get_table('payroll')
get_table('attendance')
get_table('workers_legacy')
