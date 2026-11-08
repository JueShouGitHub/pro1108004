'use strict';

const http = require('http');
const https = require('https');
const crypto = require('crypto');

const PORT = process.env.PORT || 8787;
const KEY = Buffer.from(
  process.env.RELAY_KEY ||
    '4d55d5ebcc1250929eab54da9fbb325256e9ca58e197b85c09bf83c41559931b',
  'hex',
);
const UPSTREAM = 'https://www.lumivoxlab.com';
const ROUTE_LETTER = 'e';
const MAX_AGE_MS = 5 * 60 * 1000;

function decryptPayload(b64) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 32 || (buf.length - 16) % 16 !== 0) {
    throw new Error('bad payload length');
  }
  const iv = buf.subarray(0, 16);
  const ct = buf.subarray(16);
  const d = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([d.update(ct), d.final()]).toString('utf8');
}

function encryptPayload(json) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  return Buffer.concat([iv, c.update(json, 'utf8'), c.final()]).toString(
    'base64',
  );
}

const rs = (l) =>
  Array.from({length: l}, () => Math.random().toString(36)[2]).join('');

function upstreamPost(path, body, userAgent) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      UPSTREAM + path,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': userAgent || 'Dalvik/2.1.0',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({status: res.statusCode, body: data}));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('upstream timeout')));
    req.write(payload);
    req.end();
  });
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405).end();
    return;
  }
  let raw = '';
  req.on('data', (c) => {
    raw += c;
    if (raw.length > 64 * 1024) req.destroy();
  });
  req.on('end', async () => {
    try {
      const {d} = JSON.parse(raw);
      const payload = JSON.parse(decryptPayload(d));
      if (
        typeof payload.t !== 'number' ||
        Math.abs(Date.now() - payload.t) > MAX_AGE_MS
      ) {
        throw new Error('stale timestamp');
      }
      const upstreamPath = `/${rs(12)}${ROUTE_LETTER}/${encodeURIComponent(
        payload.p,
      )}/${rs(12)}/${rs(12)}/${rs(8)}`;
      const upstream = await upstreamPost(
        upstreamPath,
        {
          android_id: payload.a,
          gps_adid: payload.g,
          install_referrer: payload.r,
          timezone: payload.tz,
          language: payload.lg,
          region: payload.rg,
          sim_country_iso: payload.sci,
          country: payload.cy,
        },
        payload.u,
      );
      if (upstream.status !== 200) {
        res.writeHead(502).end();
        return;
      }
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({d: encryptPayload(upstream.body)}));
    } catch {
      res.writeHead(400).end();
    }
  });
});

server.listen(PORT, () => {
  console.log(`relay listening on :${PORT}`);
});
