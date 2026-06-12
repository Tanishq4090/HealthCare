import dotenv from 'dotenv';
dotenv.config();

const flowId = '1656015858975257';
const token = process.env.META_SYSTEM_TOKEN;

async function check() {
  const res = await fetch(`https://graph.facebook.com/v20.0/${flowId}?fields=name,status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(await res.json());
}
check();
