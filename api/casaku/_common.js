const CASAKU_API = "https://api.casaku.id";
const BIN_ID = process.env.JSONBIN_BIN_ID;
const MASTER_KEY = process.env.JSONBIN_MASTER_KEY;
const LICENSE_KEY = process.env.CASAKU_LICENSE_KEY;
const QRIS_ID = process.env.CASAKU_QRIS_ID;

async function jsonbin() {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
    headers: { "X-Master-Key": MASTER_KEY, "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`JSONBin GET ${r.status}`);
  return (await r.json()).record || {};
}
async function save(db) {
  const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Master-Key": MASTER_KEY },
    body: JSON.stringify(db)
  });
  if (!r.ok) throw new Error(`JSONBin PUT ${r.status}: ${await r.text()}`);
}
function clean(s, max=200) {
  return String(s ?? "").trim().slice(0,max);
}
module.exports = { CASAKU_API, BIN_ID, MASTER_KEY, LICENSE_KEY, QRIS_ID, jsonbin, save, clean };
