import urllib.request
import json

with open('.env', 'r') as f:
    env = f.read()
    url = [line.split('=')[1] for line in env.split('\n') if line.startswith('VITE_SUPABASE_URL')][0]
    key = [line.split('=')[1] for line in env.split('\n') if line.startswith('VITE_SUPABASE_ANON_KEY')][0]

req = urllib.request.Request(f"{url}/rest/v1/workers?select=*", headers={"apikey": key, "Authorization": f"Bearer {key}"})
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(e.read().decode())
