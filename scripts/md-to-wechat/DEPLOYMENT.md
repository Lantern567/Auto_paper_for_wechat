# Mdnice 转换服务部署文档

## 服务状态

✅ **服务已上线并运行中**

- **端口**: 3456
- **地址**: http://localhost:3456
- **API 端点**: POST /convert

## 快速启动

### Windows
```bash
# 方式1：使用启动脚本
start.bat

# 方式2：手动启动
node server.js
```

### Linux/Mac
```bash
node server.js
```

## API 使用说明

### 请求格式

```bash
POST http://localhost:3456/convert
Content-Type: application/json; charset=utf-8

{
  "markdown": "# 标题\n\n这是**内容**",
  "imagePaths": ["path/to/image1.png", "path/to/image2.jpg"]  // 可选
}
```

### 响应格式

```json
{
  "html": "<h1>...</h1>...",
  "length": 1234
}
```

### 测试示例

```bash
# 使用 curl 测试
curl -X POST http://localhost:3456/convert \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @test-api.json

# 或使用 PowerShell
Invoke-RestMethod -Uri http://localhost:3456/convert `
  -Method POST `
  -ContentType "application/json; charset=utf-8" `
  -Body '{"markdown":"# 测试\n\n内容"}'
```

## 技术细节

### 核心修复

本次修复解决了多次调用时预览区不更新的问题：

1. **问题根源**: mdnice 预览区需要手动触发 DOM 事件才会更新
2. **解决方案**:
   - 手动触发 textarea 的 `input` 和 `change` 事件
   - 两次注入内容以覆盖服务器加载的旧内容
3. **关键代码**:
   ```javascript
   cm.CodeMirror.execCommand('selectAll');
   cm.CodeMirror.replaceSelection(markdown);

   const textarea = document.querySelector('.CodeMirror textarea');
   textarea.dispatchEvent(new Event('input', { bubbles: true }));
   textarea.dispatchEvent(new Event('change', { bubbles: true }));
   ```

### 性能

- 单次转换时间: 约 20-25 秒
- 支持并发请求
- 无头模式运行，节省资源

## 监控和维护

### 查看日志

服务会输出详细的请求日志：
```
[2025-10-24T02:21:47.967Z] 收到转换请求，markdown长度: 48
[2025-10-24T02:22:11.917Z] 转换成功，HTML长度: 166
```

### 停止服务

按 `Ctrl+C` 停止服务

### 重启服务

1. 停止当前服务 (Ctrl+C)
2. 重新运行 `node server.js` 或 `start.bat`

## 故障排查

### 服务无法启动
- 检查端口 3456 是否被占用
- 检查 Node.js 是否已安装
- 检查依赖是否已安装 (`npm install`)

### 转换失败
- 检查 markdown 内容是否为空
- 检查浏览器是否能正常启动
- 查看 stderr 日志获取详细错误信息

### 中文乱码
- 确保请求头包含 `Content-Type: application/json; charset=utf-8`
- 使用 `--data-binary` 而不是 `-d` 传输数据

## 生产环境部署

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name md-to-wechat

# 查看状态
pm2 status

# 查看日志
pm2 logs md-to-wechat

# 设置开机自启
pm2 startup
pm2 save
```

### 使用 systemd (Linux)

创建文件 `/etc/systemd/system/md-to-wechat.service`:

```ini
[Unit]
Description=Mdnice 转换服务
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/md-to-wechat
ExecStart=/usr/bin/node server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl enable md-to-wechat
sudo systemctl start md-to-wechat
sudo systemctl status md-to-wechat
```

## 更新日志

### 2025-10-24
- ✅ 修复多次调用时预览区不更新的问题
- ✅ 实现手动触发 DOM 事件机制
- ✅ 添加两次注入策略确保内容正确
- ✅ 测试通过（有头模式 + 无头模式）
- ✅ 服务成功上线运行

## 联系方式

如有问题，请查看服务日志或联系开发团队。
