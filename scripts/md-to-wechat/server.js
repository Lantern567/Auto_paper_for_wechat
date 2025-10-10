const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3456;

const server = http.createServer(async (req, res) => {
  // 只处理POST请求
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // 只处理 /convert 路径
  if (req.url !== '/convert') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';

  // 接收请求数据
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const { markdown, imagePaths } = JSON.parse(body);

      if (!markdown) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing markdown field' }));
        return;
      }

      console.log(`[${new Date().toISOString()}] 收到转换请求，markdown长度: ${markdown.length}${imagePaths ? `, 图片数量: ${imagePaths.length}` : ''}`);

      // 调用转换脚本
      const scriptPath = path.join(__dirname, 'dist', 'index.js');
      const args = ['--stdin'];
      if (imagePaths && Array.isArray(imagePaths) && imagePaths.length > 0) {
        args.push('--images', JSON.stringify(imagePaths));
      }
      const child = spawn('node', [scriptPath, ...args], {
        cwd: __dirname,
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      // 发送markdown到stdin
      child.stdin.write(markdown);
      child.stdin.end();

      // 收集输出
      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      // 处理完成
      child.on('close', code => {
        if (code !== 0) {
          console.error(`[${new Date().toISOString()}] 转换失败，退出码: ${code}`);
          console.error('stderr:', stderr);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Conversion failed',
            stderr: stderr,
            code: code
          }));
          return;
        }

        console.log(`[${new Date().toISOString()}] 转换成功，HTML长度: ${stdout.length}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          html: stdout,
          length: stdout.length
        }));
      });

    } catch (error) {
      console.error(`[${new Date().toISOString()}] 请求处理错误:`, error);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mdnice转换服务已启动`);
  console.log(`监听端口: ${PORT}`);
  console.log(`API端点: POST http://localhost:${PORT}/convert`);
  console.log(`请求格式: { "markdown": "..." }`);
  console.log(`响应格式: { "html": "...", "length": 123 }`);
  console.log('');
  console.log('按 Ctrl+C 停止服务');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});
