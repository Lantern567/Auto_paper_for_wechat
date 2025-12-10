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
npm run build
npx playwright install chromium

# 3. 安装 GPU 版 MinerU 依赖（Python 3.10+，CUDA 12.1）
cd e:/code/n8n_workflow
# 克隆 MinerU 源码（必须存在于 ./MinerU 目录，因 requirements.txt 使用 -e ./MinerU[core]）
git clone https://github.com/opendatalab/MinerU.git
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 部署 MinerU 图片提取服务（GPU 模式）

```bash
# 进入项目并激活环境
cd e:/code/n8n_workflow
.venv\Scripts\activate

# 环境变量（按需调整）
set HF_ENDPOINT=https://hf-mirror.com
set MINERU_DEVICE=cuda
set MINERU_BACKEND=pipeline
set MINERU_LANG=en
set PORT=5678

# 启动服务
cd scripts
python image_extract_service_mineru.py

# 健康测试
curl -X POST http://localhost:5678/extract ^
  -H "Content-Type: application/json" ^
  -d "{\"pdfPath\": \"e:/code/n8n_workflow/pdfs/demo.pdf\", \"outputDir\": \"e:/code/n8n_workflow/output\"}"
```

说明：
- 必须克隆 MinerU 仓库到 `./MinerU`，因为 `requirements.txt` 通过 `-e ./MinerU[core]` 安装核心组件。
- 如需 CPU 模式，将 `MINERU_DEVICE=cpu`；VLM 模式可设 `MINERU_BACKEND=vlm-transformers`（更慢但更强）。
- 首次运行会自动下载模型，国内建议保留 `HF_ENDPOINT=https://hf-mirror.com`。

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

> **重要**：`-e N8N_COMMUNITY_PACKAGES_ENABLED=true` 参数用于启用社区节点支持，这是安装微信公众号节点的必要条件。https://github.com/other-blowsnow/n8n-nodes-wechat-offiaccount

访问 http://localhost:5678 即可看到 n8n 工作界面。

---

## 🎬 快速开始流程

完整的使用流程如下：

1. **安装依赖** → 安装 Docker、Node.js、Python 和相关包
2. **安装社区节点** → 在 n8n 中安装 `n8n-nodes-wechat-offiaccount`
3. **启动服务** → 启动 n8n、Markdown 转换、PDF 提取三个服务
4. **配置凭证** → 配置 mdnice Cookie、微信公众号 AppID/AppSecret、AI 模型密钥
5. **准备 PDF** → 将论文 PDF 放入 `pdfs/` 文件夹
6. **执行工作流** → 在 n8n 中点击"Execute workflow"
7. **查看结果** → 在微信公众平台查看生成的草稿

---

## ✅ 配置检查清单

在运行工作流之前，请确保完成以下配置：

- [ ] **基础依赖已安装**
  - [ ] Docker 已安装并运行
  - [ ] Node.js 18+ 已安装
  - [ ] Python 3.8+ 已安装

- [ ] **项目文件夹已创建**
  - [ ] `pdfs/` 文件夹已创建（用于放置待处理的 PDF）
  - [ ] 已将至少一个 PDF 文件放入 `pdfs/` 文件夹

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

## 📖 使用指南

### 输入：准备 PDF 文档

1. **创建 pdfs 文件夹**（如果不存在）
   ```bash
   mkdir pdfs
   ```

2. **将论文 PDF 放入 pdfs 文件夹**
   - 支持单个或多个 PDF 文件
   - 文件路径：`项目根目录/pdfs/*.pdf`
   - 例如：`E:/code/n8n_workflow/pdfs/paper1.pdf`

3. **文件命名建议**
   - 使用有意义的英文名称，如 `robotics_wheel_2024.pdf`
   - 避免使用中文文件名或特殊字符
   - 文件名将作为文章标识符

> **提示**：工作流会自动读取 `pdfs` 文件夹中的所有 PDF 文件并逐个处理。

### 执行：运行工作流

1. **访问 n8n 界面**
   - 打开浏览器访问 http://localhost:5678
   - 登录你的 n8n 账号

2. **打开工作流**
   - 在左侧工作流列表中找到 **"论文解读自动生成微信推文"**
   - 点击打开工作流

3. **执行工作流**
   - 点击右上角的 **"Execute workflow"** 按钮
   - 工作流将自动执行以下步骤：
     1. 读取 `pdfs` 文件夹中的所有 PDF
     2. 提取 PDF 文本内容和图片
     3. 使用 AI 生成推文内容（Markdown 格式）
     4. 将 Markdown 转换为微信富文本格式
     5. 上传图片到微信公众号素材库
     6. 生成并保存微信公众号草稿

4. **监控执行进度**
   - 每个节点执行后会显示绿色对勾
   - 点击节点可查看输入输出数据
   - 如果出现红色错误标记，点击查看错误详情

### 输出：查看结果

#### 1. 临时文件输出

提取的图片和中间文件保存在 `temp` 文件夹：

```
temp/
└── batch_{时间戳}/          # 每次执行创建一个批次文件夹
    └── {论文名称}/           # 每篇论文一个子文件夹
        ├── figure_1.png     # 提取的图片
        ├── figure_2.png
        └── ...
```

例如：`E:/code/n8n_workflow/temp/batch_1234567890/paper1/figure_1.png`

#### 2. 微信公众号草稿

工作流执行成功后，文章会自动保存到微信公众号草稿箱：

1. **登录微信公众平台**
   - 访问 [https://mp.weixin.qq.com](https://mp.weixin.qq.com)

2. **查看草稿**
   - 进入 **素材管理 → 草稿**
   - 找到新生成的文章草稿

3. **编辑和发布**
   - 点击草稿进行预览
   - 可以进一步编辑标题、摘要、正文
   - 满意后点击 **发表** 或 **群发**

#### 3. n8n 执行记录

在 n8n 中可以查看详细的执行记录：

- 点击左侧的 **Executions**（执行历史）
- 查看每次执行的详细数据
- 可以下载执行结果或重新执行

### 批量处理

工作流支持批量处理多个 PDF：

1. 将多个 PDF 文件放入 `pdfs` 文件夹
2. 执行一次工作流
3. 工作流会逐个处理每个 PDF，生成对应的草稿

> **注意**：批量处理时间较长，建议先测试单个 PDF，确认配置无误后再批量处理。

---

## ⚙️ 配置说明

### 1. Cookie 配置（mdnice 登录）

Markdown 转微信服务需要 mdnice 登录凭证才能使用样式。

#### 获取 Cookie 步骤：

1. **打开浏览器**并访问 [https://mdnice.com](https://mdnice.com)
2. **登录你的账号**（可以使用微信、GitHub 等方式登录）
3. **跳转至文章编辑页面并选定合适的主题**（选定后拷贝该网页网址https://editor.mdnice.com/?outId=...，用新链接替换scripts/md-to-wechat/src/index.ts文件的原始MDNICE_URL ）
4. **编译index.ts文件** 1. 进入项目目录cd scripts/md-to-wechat  2. 首次使用需要先安装依赖 npm install  3. 编译 TypeScript 代码 npm run build
5. **打开浏览器开发者工具**（F12）
6. **切换到 Application（应用）或 Storage（存储）标签页**
7. **在左侧找到 Cookies → https://mdnice.com**
8. **复制以下关键 Cookie 项**：
   - `token`（最重要）
   - `username`
   - `userOutId`
   - `avatar`

9. **编辑 `scripts/md-to-wechat/cookies.json`**，按以下格式填入：

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
├── pdfs/                                   # PDF 输入文件夹（需手动创建）
│   ├── paper1.pdf                          # 待处理的论文 PDF
│   ├── paper2.pdf
│   └── ...
├── temp/                                   # 临时文件输出文件夹（自动创建）
│   └── batch_{时间戳}/                     # 每次执行创建批次文件夹
│       └── {论文名称}/                     # 每篇论文的临时文件
│           ├── figure_1.png                # 提取的图片
│           └── ...
├── scripts/
│   ├── image_extract_service.py            # PDF 图片提取服务（端口 3457）
│   └── md-to-wechat/                       # Markdown 转微信服务
│       ├── src/                            # TypeScript 源码
│       │   └── index.ts                    # 转换脚本源码
│       ├── dist/                           # 编译产物（不提交到 Git）
│       │   └── index.js                    # 由 TypeScript 编译生成
│       ├── server.js                       # HTTP 服务（端口 3456）
│       ├── cookies.json                    # mdnice 登录凭证（需配置）
│       ├── package.json                    # 依赖配置
│       └── tsconfig.json                   # TypeScript 配置
```

### 核心文件夹说明

| 文件夹 | 用途 | 说明 |
|--------|------|------|
| `pdfs/` | **输入**：存放待处理的论文 PDF | 需手动创建并放入 PDF 文件 |
| `temp/` | **输出**：存放提取的图片和中间文件 | 自动创建，可定期清理 |
| `scripts/` | **服务**：PDF 提取和 Markdown 转换服务 | 需要保持运行 |

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

### Q: 克隆项目后找不到 `scripts/md-to-wechat/dist` 文件夹？

**这是正常的！** `dist` 文件夹是 TypeScript 编译产物，不会提交到 Git 仓库。

**解决方法**：
```bash
cd scripts/md-to-wechat
npm install          # 安装依赖
npm run build        # 编译生成 dist 文件夹
```

编译成功后会自动生成 `dist/index.js` 文件。

**原理说明**：
- 源码在 `src/index.ts`（TypeScript）
- 通过 `tsc` 编译器编译为 `dist/index.js`（JavaScript）
- `dist` 文件夹被 `.gitignore` 忽略，因为它可以随时从源码重新生成

### Q: 找不到微信公众号节点？

确保已正确安装社区节点：
1. 检查 n8n 是否启用了社区节点支持（环境变量 `N8N_COMMUNITY_PACKAGES_ENABLED=true`）
2. 在 n8n 设置中安装 `n8n-nodes-wechat-offiaccount`
3. 安装后重启 n8n 服务：`docker restart n8n`

### Q: 工作流找不到 PDF 文件？

1. 确保已创建 `pdfs` 文件夹：`mkdir pdfs`
2. 确保 PDF 文件已放入 `pdfs` 文件夹
3. 检查 Docker 卷挂载是否正确：`-v $(pwd):/files`
4. 在 n8n 中检查"读取所有PDF文件"节点的路径配置：`/files/pdfs/*.pdf`

### Q: 生成的草稿中图片没有显示？

1. 检查微信公众号凭证是否正确配置
2. 确认 IP 白名单已正确设置
3. 查看"上传正文图片到微信"节点的执行结果，确认图片上传成功
4. 检查 PDF 中是否有可提取的图片

### Q: Markdown 转换失败？

检查 `cookies.json` 是否正确配置，token 是否过期（有效期约30天）。

### Q: AI 生成内容质量不理想？

1. 检查 AI 模型配置，尝试使用更强大的模型（如 GPT-4、Claude）
2. 调整提示词模板，在"准备AI提示词"节点中修改
3. 确保 PDF 文本提取完整，检查"提取PDF文本"节点输出

### Q: 批量处理时某个 PDF 失败了怎么办？

1. 工作流会继续处理后续 PDF
2. 在 n8n 执行历史中查看具体失败原因
3. 修复问题后，可以单独处理失败的 PDF

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
- [n8n-nodes-wechat-offiaccount](https://github.com/other-blowsnow/n8n-nodes-wechat-offiaccount) - 微信公众号n8n接口

