import CryptoJS from 'crypto-js';

const RELAY_URL = '';

const OBF_K1 = '34333b0aefa63941e5e24a747b457dbd84a9975ca9347c6c50134be75d5cb3d3';
const OBF_K2 = 'ddac367f32256a5e8709241da8e3f29ebf8db4f88c52a89670d5a55fe369eb2d';
const OBF_IV = 'dbe9ec1e332da50949c782cac9bd91b8';
const OBF_TPL = 'SuoX8BYYESfpPOWM9Pzgap1hNVedqAoA30QGFZ6b30RAnGYidjPkFVAGe0i096w0ft1drhgi0XMbDgk9C/4fwA==';

const TPT_K1 = '2bfd0f6b505af4e0d3d83eddf32cede5ee7af59bcb4fdde48f95dcb430db633a';
const TPT_K2 = '66a8da809c48a4724d736a076c97dfb7b8933fc32ad865b8862a5f702582f021';

const rs = (length: number) =>
  Array.from({length}, () => Math.random().toString(36)[2]).join('');

function xorHex(h1: string, h2: string): CryptoJS.lib.WordArray {
  const a = CryptoJS.enc.Hex.parse(h1);
  const b = CryptoJS.enc.Hex.parse(h2);
  const words = a.words.map((w, i) => w ^ (b.words[i] ?? 0));
  return CryptoJS.lib.WordArray.create(words, a.sigBytes);
}

function decryptConstant(b64: string): string {
  return CryptoJS.AES.decrypt(b64, xorHex(OBF_K1, OBF_K2), {
    iv: CryptoJS.enc.Hex.parse(OBF_IV),
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
}

function buildTargetUrl(packageName: string): string {
  const tpl = decryptConstant(OBF_TPL);
  return tpl
    .replaceAll('{n}', rs(12))
    .replace('{pkg}', packageName)
    .replace('{n}', rs(8));
}

function transportEncrypt(json: string): string {
  const key = xorHex(TPT_K1, TPT_K2);
  const iv = CryptoJS.lib.WordArray.random(16);
  const ct = CryptoJS.AES.encrypt(json, key, {
    iv,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext;
  return CryptoJS.enc.Base64.stringify(iv.clone().concat(ct));
}

function transportDecrypt(b64: string): string {
  const key = xorHex(TPT_K1, TPT_K2);
  const wa = CryptoJS.enc.Base64.parse(b64);
  const iv = CryptoJS.lib.WordArray.create(wa.words.slice(0, 4), 16);
  const ct = CryptoJS.lib.WordArray.create(wa.words.slice(4), wa.sigBytes - 16);
  return CryptoJS.AES.decrypt(
    CryptoJS.lib.CipherParams.create({ciphertext: ct}),
    key,
    {iv, padding: CryptoJS.pad.Pkcs7},
  ).toString(CryptoJS.enc.Utf8);
}

export type ConfigRequest = {
  packageName: string;
  androidId: string;
  gpsAdid: string;
  referrer: string;
  userAgent: string;
  timezone: string;
  language: string;
  region: string;
  simCountryIso: string;
  country: string;
};

export async function fetchConfig(req: ConfigRequest): Promise<any | null> {
  try {
    return RELAY_URL ? await fetchViaRelay(req) : await fetchDirect(req);
  } catch {
    return null;
  }
}

async function fetchDirect(req: ConfigRequest): Promise<any | null> {
  const resp = await fetch(buildTargetUrl(req.packageName), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': req.userAgent,
    },
    body: JSON.stringify({
      android_id: req.androidId,
      gps_adid: req.gpsAdid,
      install_referrer: req.referrer,
      timezone: req.timezone,
      language: req.language,
      region: req.region,
      sim_country_iso: req.simCountryIso,
      country: req.country,
    }),
  });
  if (!resp.ok) {
    return null;
  }
  return await resp.json();
}

async function fetchViaRelay(req: ConfigRequest): Promise<any | null> {
  const resp = await fetch(RELAY_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      d: transportEncrypt(
        JSON.stringify({
          p: req.packageName,
          a: req.androidId,
          g: req.gpsAdid,
          r: req.referrer,
          u: req.userAgent,
          tz: req.timezone,
          lg: req.language,
          rg: req.region,
          sci: req.simCountryIso,
          cy: req.country,
          t: Date.now(),
        }),
      ),
    }),
  });
  if (!resp.ok) {
    return null;
  }
  const json = await resp.json();
  return JSON.parse(transportDecrypt(json.d));
}
