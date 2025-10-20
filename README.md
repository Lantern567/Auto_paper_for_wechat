# n8n 工作流开发指南

## 项目说明

本项目采用 **混合模式**（VS Code 编辑 + n8n 网页端调试）进行 n8n 工作流开发。

当前工作流：`wechat_auto_paragraph.json` - 微信公众号自动分段工作流

---

## 混合模式开发流程（强烈推荐）

### 核心思想

将 VS Code 和本地文件作为 **"代码源"**，通过命令行一键同步到 n8n 服务，然后在网页端进行可视化调试。

### 为什么选择混合模式？

✅ **VS Code 的强大编辑能力**：代码高亮、搜索替换、版本对比
✅ **Git 版本控制**：每次修改都可以提交，随时回滚
✅ **n8n 网页端的强大调试能力**：可视化查看数据流、Pin Data、实时测试
✅ **一键同步**：无需手动上传 JSON 文件

---

## 标准开发循环

### 1️⃣ 在 VS Code 中编辑工作流

打开 `wechat_auto_paragraph.json`，进行修改：
- 添加新节点
- 修改参数配置
- 调整节点连接关系

### 2️⃣ 保存并提交到 Git（可选但推荐）

```bash
git add wechat_auto_paragraph.json
git commit -m "添加新的处理节点"
```

### 3️⃣ 一键同步到 n8n 服务

在终端运行以下命令：

```bash
n8n import:workflow --input="e:\code\n8n_workflow\wechat_auto_paragraph.json"
```

**`n8n import` 命令会做什么？**
- 读取你的本地 `.json` 文件
- 如果 n8n 服务中不存在这个工作流（根据文件内的 ID 判断），它会创建一个新的工作流
- 如果已存在，它会用你的本地文件**覆盖更新**服务器上的版本

这完美替代了手动上传！

### 4️⃣ 在 n8n 网页端进行可视化调试

1. 打开浏览器，访问你的 n8n 服务（通常是 `http://localhost:5678`）
2. 刷新工作流页面，会看到最新版本
3. 点击 **"Test workflow"** 进行调试：
   - 查看每个节点的输入输出
   - 使用 **Pin Data** 固定测试数据
   - 查看执行日志和错误信息

### 5️⃣ 重复循环

修改 → 同步 → 调试 → 修改 → ...

---

## 🚀 服务启动指南

### 服务概览

本项目包含 3 个在线服务，协同完成论文解读到微信推文的自动化流程：

| 服务名称 | 端口 | 用途 | 技术栈 |
|---------|------|------|--------|
| **n8n 工作流服务** | 5678 | 工作流编排和执行 | Docker / Node.js |
| **Markdown 转微信服务** | 3456 | 将 Markdown 转为微信格式 | Node.js + Playwright |
| **PDF 图片提取服务** | 3457 | 从 PDF 提取图片 | Python + PyMuPDF |

### 首次安装依赖

#### 1. n8n 服务依赖
```bash
# 使用 Docker（推荐）
docker pull n8nio/n8n

# 或者使用 npm 全局安装
npm install -g n8n
```

#### 2. Markdown 转微信服务依赖
```bash
cd scripts/md-to-wechat
npm install
npx playwright install chromium
```

#### 3. PDF 图片提取服务依赖
```bash
pip install PyMuPDF
```

### ⚡ 快速启动所有服务

#### Windows PowerShell 一键启动
```powershell
# 1. 启动 PDF 图片提取服务（后台运行）
Start-Process python -ArgumentList "scripts\image_extract_service.py" -NoNewWindow

# 2. 启动 Markdown 转微信服务（后台运行）
Start-Process powershell -ArgumentList "-Command", "cd scripts\md-to-wechat; node server.js" -NoNewWindow

# 3. 启动 n8n 服务（Docker）
docker start n8n

# 4. 等待服务启动并打开浏览器
Start-Sleep -Seconds 3
Start-Process "http://localhost:5678"
```

#### Linux / macOS 一键启动
```bash
# 1. 启动 PDF 图片提取服务
python3 scripts/image_extract_service.py &

# 2. 启动 Markdown 转微信服务
cd scripts/md-to-wechat && node server.js &

# 3. 启动 n8n 服务
docker start n8n

# 4. 打开浏览器
sleep 3 && xdg-open http://localhost:5678  # Linux
# sleep 3 && open http://localhost:5678     # macOS
```

### 📝 单独启动各服务

#### 服务 1：n8n 工作流服务

**首次启动（创建容器并挂载卷）**：
```bash
docker run -d --restart unless-stopped \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -v e:/code/n8n_workflow:/files \
  n8nio/n8n
```

**后续启动**：
```bash
docker start n8n
```

**访问地址**：`http://localhost:5678`

**验证服务**：
```bash
curl http://localhost:5678/healthz
# 或浏览器访问 http://localhost:5678
```

---

#### 服务 2：Markdown 转微信服务

**启动命令**：
```bash
cd scripts/md-to-wechat
node server.js
```

**访问地址**：`http://localhost:3456`

**API 测试**：
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3456/convert" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"markdown":"# 测试标题\n这是测试内容"}'

# Linux / macOS
curl -X POST http://localhost:3456/convert \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# 测试标题\n这是测试内容"}'
```

**API 参数说明**：
- `POST /convert`
- 请求体：`{ "markdown": "...", "imagePaths": ["..."] }`
- 响应：`{ "html": "...", "length": 123 }`

---

#### 服务 3：PDF 图片提取服务

**启动命令**：
```bash
python scripts/image_extract_service.py
# 或 Windows
python scripts\image_extract_service.py
```

**访问地址**：`http://localhost:3457`

**API 测试**：
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3457/extract" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"pdfPath":"E:\\code\\n8n_workflow\\test.pdf","outputDir":"./temp"}'

# Linux / macOS
curl -X POST http://localhost:3457/extract \
  -H "Content-Type: application/json" \
  -d '{"pdfPath":"/path/to/file.pdf","outputDir":"./temp"}'
```

**API 参数说明**：
- `POST /extract`
- 请求体：`{ "pdfPath": "绝对路径", "outputDir": "./temp" }`
- 响应：`{ "success": true, "imagePaths": [...], "count": 2 }`

### ✅ 验证服务状态

**检查端口占用**：
```bash
# Windows
netstat -ano | findstr "5678 3456 3457"

# PowerShell（推荐）
Get-NetTCPConnection -LocalPort 5678,3456,3457 | Select-Object LocalPort,State,OwningProcess

# Linux / macOS
lsof -i :5678,3456,3457
```

**检查 Docker 服务**：
```bash
docker ps | grep n8n
docker logs n8n --tail 50
```

### 🛑 停止所有服务

**Windows PowerShell**：
```powershell
# 停止 n8n
docker stop n8n

# 停止 Node.js 服务（Markdown 转换）
Get-Process -Name node | Where-Object {$_.Path -like "*md-to-wechat*"} | Stop-Process -Force

# 停止 Python 服务（PDF 提取）
Get-Process -Name python | Where-Object {$_.CommandLine -like "*image_extract*"} | Stop-Process -Force
```

**Linux / macOS**：
```bash
# 停止 n8n
docker stop n8n

# 停止 Node.js 和 Python 后台进程
pkill -f "node.*server.js"
pkill -f "python.*image_extract_service"
```

### 🔧 服务启动常见问题

#### Q: 端口被占用怎么办？

**Windows**：
```powershell
# 查看占用端口的进程
netstat -ano | findstr "3456"
# 记下 PID，然后结束进程
taskkill /PID <PID> /F
```

**Linux / macOS**：
```bash
# 查看并结束占用进程
lsof -ti:3456 | xargs kill -9
```

#### Q: n8n Docker 容器启动失败？

```bash
# 查看错误日志
docker logs n8n

# 删除旧容器重新创建
docker rm -f n8n

# 重新运行启动命令
docker run -d --restart unless-stopped \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -v e:/code/n8n_workflow:/files \
  n8nio/n8n
```

#### Q: Python 服务提示 PyMuPDF 未安装？

```bash
pip install PyMuPDF
# 或使用国内源
pip install PyMuPDF -i https://pypi.tuna.tsinghua.edu.cn/simple
```

#### Q: Markdown 服务提示 Playwright 浏览器未安装？

```bash
cd scripts/md-to-wechat
npx playwright install chromium
```

---

## 快捷命令

### 导入/更新工作流到 n8n

```bash
n8n import:workflow --input="e:\code\n8n_workflow\wechat_auto_paragraph.json"
```

### 从 n8n 导出工作流到本地（如需要）

```bash
n8n export:workflow --id=e1aSb0wo844W55KM --output="e:\code\n8n_workflow\wechat_auto_paragraph.json"
```

> 注意：工作流 ID 可以在 JSON 文件的 `id` 字段中找到，或在 n8n 网页端的 URL 中查看

---

## Git 版本控制最佳实践

### 提交频率建议

- ✅ 添加新节点后提交
- ✅ 修改关键逻辑后提交
- ✅ 调试通过某个功能后提交
- ❌ 不要等所有功能都完成才提交

### 示例提交信息

```bash
git commit -m "添加文本分段处理节点"
git commit -m "修复消息发送参数配置"
git commit -m "完成自动分段逻辑"
```

---

## 常见问题

### Q: `n8n import` 命令提示找不到？

**A:** 需要全局安装 n8n CLI：

```bash
npm install -g n8n
```

### Q: 导入后在网页端看不到更新？

**A:**
1. 确认命令执行成功（无错误提示）
2. 在浏览器中**强制刷新**页面（Ctrl+Shift+R）
3. 检查工作流 ID 是否匹配

### Q: 如何避免覆盖网页端的修改？

**A:**
- 始终以本地文件为准
- 如果在网页端做了修改，记得先导出到本地：
  ```bash
  n8n export:workflow --id=e1aSb0wo844W55KM --output="e:\code\n8n_workflow\wechat_auto_paragraph.json"
  ```
- 然后再在 VS Code 中编辑

### Q: 可以同时在 VS Code 和网页端编辑吗？

**A:**
- 不推荐，会造成版本冲突
- 建议：**VS Code 编辑 → 导入 → 网页端调试**，单向流程更安全

---

## 项目结构

```
n8n_workflow/
├── README.md                           # 本文档
├── TESTING_GUIDE.md                    # 工作流测试指南
├── wechat_auto_paragraph.json          # 微信自动分段工作流
├── wechat_auto_paragraph_fixed.json    # 修复版工作流
├── start-all-services.ps1              # 一键启动所有服务（PowerShell）
├── stop-all-services.ps1               # 一键停止所有服务（PowerShell）
├── .gitignore                          # Git 忽略配置
├── scripts/                            # 服务脚本目录
│   ├── image_extract_service.py        # PDF 图片提取服务（端口 3457）
│   ├── test_extract.py                 # PDF 提取测试脚本
│   └── md-to-wechat/                   # Markdown 转微信服务
│       ├── server.js                   # HTTP 服务（端口 3456）
│       ├── package.json                # Node.js 依赖配置
│       ├── tsconfig.json               # TypeScript 配置
│       ├── cookies.json                # mdnice 登录凭证
│       ├── src/
│       │   └── index.ts                # 转换脚本源码
│       ├── dist/
│       │   └── index.js                # 编译后的 JavaScript
│       └── README.md                   # 服务说明文档
└── temp/                               # 临时文件目录（PDF 提取的图片）
```

---

## 下一步

### 快速开始

**首次使用**：
```powershell
# 1. 安装依赖（详见"服务启动指南"章节）
cd scripts/md-to-wechat && npm install && npx playwright install chromium
pip install PyMuPDF

# 2. 启动所有服务
.\start-all-services.ps1

# 3. 访问 n8n 工作流界面
# 浏览器打开 http://localhost:5678
```

**日常开发**：
1. ✅ 在 VS Code 中继续编辑 `wechat_auto_paragraph.json`
2. ✅ 使用 `n8n import` 同步到服务
3. ✅ 在网页端进行可视化调试
4. ✅ 定期提交到 Git 保存进度

祝开发顺利！🚀
