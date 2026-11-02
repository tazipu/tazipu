/* =====================================================================
 * 好记帐 手机版 (PWA) · 零依赖本地静态服务器（Node.js 内置模块）
 * 启动后在控制台显示本机访问地址与手机访问地址；关闭窗口即停止。
 * ===================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 8765;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// 收集本机非回环 IPv4 地址（用于手机同 Wi-Fi 访问提示）
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) out.push(iface.address);
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // 防止目录穿越
  let filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) filePath = path.join(ROOT, 'index.html');

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) { res.writeHead(404); res.end('Not Found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanAddresses();
  console.log('============================================');
  console.log('   好记帐 手机版 (PWA) 本地服务已启动');
  console.log('============================================');
  console.log('');
  console.log('  电脑本机访问 : http://127.0.0.1:' + PORT + '/index.html');
  if (ips.length) {
    ips.forEach(ip => console.log('  手机访问(同一Wi-Fi): http://' + ip + ':' + PORT + '/index.html'));
  } else {
    console.log('  未取到局域网 IP，请用网卡实际地址访问 ' + PORT + ' 端口');
  }
  console.log('');
  console.log('  关闭本窗口即停止服务。');
  console.log('============================================');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用，请先关闭占用程序后重试。');
  } else {
    console.error('服务启动失败：' + e.message);
  }
  process.exit(1);
});
