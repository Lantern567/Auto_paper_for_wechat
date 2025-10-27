# 学术论文自动转微信公众号推文

> 基于 n8n 的全自动论文解读与推文生成工作流

## 🎯 功能简介

将学术论文（PDF）自动转换为微信公众号推文：

- **PDF 图片提取** - 自动识别并提取论文图表
- **AI 内容生成** - 使用 LLM 解读论文并生成推文
- **图片上传** - 自动上传图片到微信公众号素材库
- **格式转换** - 使用 mdnice 将 Markdown 转为微信富文本
- **草稿生成** - 自动保存为微信公众号草稿，可直接编辑发布

---

## 🚀 快速开始

### 环境要求

- Docker（用于运行 n8n）
- Node.js 18+（用于 Markdown 转换服务）
- Python 3.8+（用于 PDF 图片提取服务）

### 安装依赖

```bash
# 1. 拉取 n8n Docker 镜像
docker pull n8nio/n8n

# 2. 安装 Markdown 转换服务依赖
cd scripts/md-to-wechat
npm install
npx playwright install chromium

# 3. 安装 PDF 提取服务依赖
pip install PyMuPDF
```

### 安装 n8n 社区节点

本项目使用了微信公众号的社区节点，需要在 n8n 中手动安装：

1. **启动 n8n 服务**（参考下方"启动服务"章节）
2. **访问 n8n 界面** - 打开 http://localhost:5678
3. **进入设置**
   - 点击右上角的设置图标
   - 选择 **Community Nodes**
4. **安装微信公众号节点**
   - 点击 **Install a community node**
   - 在搜索框输入：`n8n-nodes-wechat-offiaccount`
   - 点击 **Install**
   - 等待安装完成（可能需要1-2分钟）
5. **重启 n8n 服务**
   ```bash
   docker restart n8n
   ```

> **注意**：安装社区节点需要 n8n 以非 Docker 内置方式运行，或使用支持社区节点的 Docker 配置。如果遇到问题，可以使用以下命令重新创建容器：
> ```bash
> docker rm -f n8n
> docker run -d --restart unless-stopped \
>   --name n8n \
>   -p 5678:5678 \
>   -e N8N_COMMUNITY_PACKAGES_ENABLED=true \
>   -v ~/.n8n:/home/node/.n8n \
>   -v $(pwd):/files \
>   n8nio/n8n
> ```

### 启动服务

#### Windows PowerShell 一键启动

```powershell
# 启动 PDF 图片提取服务（后台）
Start-Process python -ArgumentList "scripts\image_extract_service.py" -NoNewWindow

# 启动 Markdown 转微信服务（后台）
Start-Process powershell -ArgumentList "-Command", "cd scripts\md-to-wechat; node server.js" -NoNewWindow

# 启动 n8n 服务（首次运行需要先创建容器，见下方说明）
docker start n8n

# 打开浏览器
Start-Sleep -Seconds 3
Start-Process "http://localhost:5678"
```

#### Linux / macOS 一键启动

```bash
# 启动 PDF 图片提取服务
python3 scripts/image_extract_service.py &

# 启动 Markdown 转微信服务
cd scripts/md-to-wechat && node server.js &

# 启动 n8n 服务
docker start n8n

# 打开浏览器
sleep 3 && xdg-open http://localhost:5678  # Linux
# sleep 3 && open http://localhost:5678     # macOS
```

#### 首次创建 n8n 容器

```bash
docker run -d --restart unless-stopped \
  --name n8n \
  -p 5678:5678 \
  -e N8N_COMMUNITY_PACKAGES_ENABLED=true \
  -v ~/.n8n:/home/node/.n8n \
  -v $(pwd):/files \
  n8nio/n8n
```

> **重要**：`-e N8N_COMMUNITY_PACKAGES_ENABLED=true` 参数用于启用社区节点支持，这是安装微信公众号节点的必要条件。

访问 http://localhost:5678 即可看到 n8n 工作界面。

---

## ✅ 配置检查清单

在运行工作流之前，请确保完成以下配置：

- [ ] **基础依赖已安装**
  - [ ] Docker 已安装并运行
  - [ ] Node.js 18+ 已安装
  - [ ] Python 3.8+ 已安装

- [ ] **n8n 社区节点已安装**
  - [ ] 启用了社区节点支持（`N8N_COMMUNITY_PACKAGES_ENABLED=true`）
  - [ ] 已安装 `n8n-nodes-wechat-offiaccount` 节点
  - [ ] 安装后已重启 n8n

- [ ] **服务依赖已安装**
  - [ ] Markdown 转换服务依赖（`npm install`）
  - [ ] Playwright 浏览器（`npx playwright install chromium`）
  - [ ] PyMuPDF 库（`pip install PyMuPDF`）

- [ ] **Cookie 配置完成**
  - [ ] 已获取 mdnice.com 的 token
  - [ ] 已更新 `scripts/md-to-wechat/cookies.json`
  - [ ] Cookie 未过期（有效期约30天）

- [ ] **微信公众号凭证配置完成**
  - [ ] 已获取 AppID 和 AppSecret
  - [ ] 已配置 IP 白名单
  - [ ] 在 n8n 中已创建微信公众号凭证
  - [ ] 工作流中所有微信节点已选择正确的凭证

- [ ] **AI 模型配置完成**
  - [ ] 已配置 AI 模型（如 Gemini、GPT-4 等）
  - [ ] 已填入对应的 API 密钥

- [ ] **服务已启动**
  - [ ] n8n 服务运行中（端口 5678）
  - [ ] Markdown 转换服务运行中（端口 3456）
  - [ ] PDF 提取服务运行中（端口 3457）

---

## ⚙️ 配置说明

### 1. Cookie 配置（mdnice 登录）

Markdown 转微信服务需要 mdnice 登录凭证才能使用样式。

#### 获取 Cookie 步骤：

1. **打开浏览器**并访问 [https://mdnice.com](https://mdnice.com)
2. **登录你的账号**（可以使用微信、GitHub 等方式登录）
3. **打开浏览器开发者工具**（F12）
4. **切换到 Application（应用）或 Storage（存储）标签页**
5. **在左侧找到 Cookies → https://mdnice.com**
6. **复制以下关键 Cookie 项**：
   - `token`（最重要）
   - `username`
   - `userOutId`
   - `avatar`

7. **编辑 `scripts/md-to-wechat/cookies.json`**，按以下格式填入：

```json
[
  {
    "name": "token",
    "value": "你的token值（一串很长的JWT）",
    "domain": ".mdnice.com",
    "path": "/",
    "httpOnly": false,
    "secure": false
  },
  {
    "name": "username",
    "value": "你的用户名",
    "domain": ".mdnice.com",
    "path": "/",
    "httpOnly": false,
    "secure": false
  },
  {
    "name": "userOutId",
    "value": "你的用户ID",
    "domain": ".mdnice.com",
    "path": "/",
    "httpOnly": false,
    "secure": false
  },
  {
    "name": "avatar",
    "value": "",
    "domain": ".mdnice.com",
    "path": "/",
    "httpOnly": false,
    "secure": false
  }
]
```

8. **保存文件后重启 Markdown 转换服务**

> **注意**：token 有效期通常为 30 天，过期后需要重新获取。

---

### 2. 微信公众号配置

本工作流使用 n8n 社区节点 `n8n-nodes-wechat-offiaccount`。

> **前置条件**：确保已按照上面"安装 n8n 社区节点"章节安装了微信公众号节点。

#### 2.1 获取微信公众号凭证

1. **登录微信公众平台**
   - 访问 [https://mp.weixin.qq.com](https://mp.weixin.qq.com)
   - 使用管理员账号登录

2. **获取 AppID 和 AppSecret**
   - 进入 **设置与开发 → 基本配置**
   - 找到 **开发者ID(AppID)** 和 **开发者密码(AppSecret)**
   - 点击"重置"生成新的 AppSecret（需管理员扫码确认）

3. **配置 IP 白名单**
   - 在 **基本配置** 页面找到 **IP白名单**
   - 添加你的服务器公网 IP（或本地开发时的出口 IP）
   - 可以临时添加 `0.0.0.0/0` 用于测试（不推荐生产环境）

#### 2.2 在 n8n 中配置微信公众号凭证

1. **打开 n8n 界面** (http://localhost:5678)
2. **进入凭证管理**
   - 点击右上角的设置图标
   - 选择 **Credentials**
   - 点击 **New Credential**
3. **选择"微信公众号 API"**
   - 填入 **AppID**
   - 填入 **AppSecret**
   - 保存凭证

#### 2.3 配置工作流中的微信节点

工作流中包含以下微信公众号相关节点，需要确保它们都已正确配置凭证：

| 节点名称 | 功能 | 配置说明 |
|---------|------|---------|
| **上传第一页到微信** | 上传论文封面图片 | 选择已保存的微信凭证 |
| **上传正文图片到微信** | 批量上传论文正文图片 | 选择已保存的微信凭证 |
| **上传封面到微信2** | 上传公众号文章封面 | 选择已保存的微信凭证 |
| **保存AI微信草稿** | 将生成的文章保存为草稿 | 选择已保存的微信凭证 |

> **提示**：所有微信节点应使用同一个凭证。配置时点击节点，在右侧面板找到 **Credential** 选项，选择你创建的微信公众号凭证。

---

### 3. AI 模型配置

在 n8n 工作流的 **AI Agent** 节点中配置：

- 选择模型（如 GPT-4、Claude 等）
- 填入对应的 API 密钥
- 根据需要调整提示词模板

---

## 📁 项目结构

```
Auto_paper_for_wechat/
├── README.md                               # 本文档
├── wechat_auto_paragraph.json              # 主工作流文件
├── scripts/
│   ├── image_extract_service.py            # PDF 图片提取服务（端口 3457）
│   └── md-to-wechat/                       # Markdown 转微信服务
│       ├── server.js                       # HTTP 服务（端口 3456）
│       ├── cookies.json                    # mdnice 登录凭证（需配置）
│       └── dist/index-fixed.js             # 核心转换脚本
└── temp/                                   # 临时文件目录
```

---

## 🔧 工作流开发

### 导入工作流到 n8n

```bash
# 将本地 JSON 文件导入/更新到 n8n
n8n import:workflow --input="wechat_auto_paragraph.json"
```

### 从 n8n 导出工作流

```bash
# 从 n8n 导出到本地文件（需要替换工作流 ID）
n8n export:workflow --id=你的工作流ID --output="wechat_auto_paragraph.json"
```

> **推荐开发流程**：在 VS Code 中编辑 JSON → 使用 `import:workflow` 同步 → 在 n8n 网页端调试

---

## 🛑 停止服务

### Windows PowerShell

```powershell
# 停止 n8n
docker stop n8n

# 停止 Node.js 服务
Get-Process -Name node | Where-Object {$_.Path -like "*md-to-wechat*"} | Stop-Process -Force

# 停止 Python 服务
Get-Process -Name python | Where-Object {$_.CommandLine -like "*image_extract*"} | Stop-Process -Force
```

### Linux / macOS

```bash
docker stop n8n
pkill -f "node.*server.js"
pkill -f "python.*image_extract_service"
```

---

## 🚨 常见问题

### Q: 找不到微信公众号节点？

确保已正确安装社区节点：
1. 检查 n8n 是否启用了社区节点支持（环境变量 `N8N_COMMUNITY_PACKAGES_ENABLED=true`）
2. 在 n8n 设置中安装 `n8n-nodes-wechat-offiaccount`
3. 安装后重启 n8n 服务：`docker restart n8n`

### Q: 端口被占用怎么办？

**Windows**：
```powershell
netstat -ano | findstr "3456"  # 查看占用进程
taskkill /PID <PID> /F         # 结束进程
```

**Linux / macOS**：
```bash
lsof -ti:3456 | xargs kill -9
```

### Q: Markdown 转换失败？

检查 `cookies.json` 是否正确配置，token 是否过期。

### Q: PDF 图片提取失败？

确保已安装 PyMuPDF：
```bash
pip install PyMuPDF
```

### Q: n8n 导入命令找不到？

需要全局安装 n8n CLI：
```bash
npm install -g n8n
```

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- [n8n](https://n8n.io/) - 开源工作流自动化平台
- [mdnice](https://mdnice.com/) - Markdown 微信排版工具
- [微信公众平台](https://mp.weixin.qq.com/) - 微信公众号开放接口
