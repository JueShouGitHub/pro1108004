# Config 中转(relay)部署说明

App ↔ relay 之间请求/响应全程 **AES-256-CBC**(随机 IV,PKCS7);relay ↔ lumivoxlab 保持与现在完全一致的明文请求,**Panda 后端零改动**。

## 协议

**请求** `POST {RELAY_URL}`

```json
{"d": "<base64(IV[16] || AES-256-CBC(JSON))>"}
```

加密前的 JSON(字段全部短名,不出现明文关键词):

```json
{"p":"<packageName>","a":"<android_id>","g":"<gps_adid>","r":"<install_referrer>","u":"<userAgent>","t":<毫秒时间戳>}
```

- `t` 超过 ±5 分钟窗口 → relay 拒绝(防重放)
- 密钥:32 字节,客户端由 `SecureConfig.ts` 中 `TPT_K1 XOR TPT_K2` 得到;relay 由环境变量 `RELAY_KEY` 注入(两侧一致)

**relay 行为**:解密 → 重建 `https://www.lumivoxlab.com/{rs(12)}e/{pkg}/{rs(12)}/{rs(12)}/{rs(8)}` → 原样转发明文请求(UA 用客户端真实 UA)→ 把返回的 JSON 再加密回给 App。

**响应**:`{"d": "<base64(IV || AES-CBC(上游JSON)>)>"}`

## 部署(任意 VPS)

```bash
# 1. 生成自己的密钥(替换默认值!客户端 SecureConfig.ts 同步更新 TPT_K1/TPT_K2)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. 运行(建议 pm2 或 systemd)
RELAY_KEY=<新密钥> PORT=8787 node relay.js

# 3. 套 TLS(必须,否则加密失去意义),例如 Caddy:
#    your-relay.example.com { reverse_proxy 127.0.0.1:8787 }
```

## 客户端切换

`SecureConfig.ts` 中一行:

```ts
const RELAY_URL = ''; // → 'https://your-relay.example.com/config'
```

- 留空 = 直连模式(现状:域名/路径 AES 混淆防扫描,线上内容仍明文)
- 填上 = 全加密模式(端到端 AES-256-CBC + 防重放)

## 安全边界(如实说明)

- 客户端密钥随包分发,只能提高逆向成本,无法阻止有决心的分析者(hook 运行时可取到)
- 直连模式下 HTTPS 代理(装了 CA 的抓包工具)仍可见明文 JSON
- 换密钥 = 重新打包发版;建议每个 app/每个版本用不同密钥,并在 relay 同时接受新旧两把密钥以平滑过渡(需要时扩展 relay.js 即可)
