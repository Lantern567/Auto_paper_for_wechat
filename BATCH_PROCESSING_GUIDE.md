# 批量处理PDF功能使用指南

> 自动批量处理多个学术论文PDF，生成微信公众号推文

---

## 🎯 功能概述

本工作流支持批量处理多个PDF文件，为每篇论文独立生成微信公众号推文，并自动保存到对应目录。

### 核心特性

- ✅ **批量处理**：一次处理文件夹中的所有PDF
- ✅ **独立输出**：每篇论文输出到独立目录
- ✅ **自动保存**：Markdown、HTML、图片自动保存
- ✅ **批次汇总**：生成批次处理报告

---

## 📁 目录结构

```
n8n_workflow/
├── pdfs/                                   # 待处理的PDF文件夹
│   ├── 论文1.pdf
│   ├── 论文2.pdf
│   └── 论文3.pdf
├── temp/
│   └── batch_1729584420000/                 # 批次文件夹（时间戳）
│       ├── 论文1/
│       │   ├── page_1.png                   # 第一页截图
│       │   ├── fig_1.png                    # 图表1
│       │   ├── fig_2.png                    # 图表2
│       │   ├── article.md                   # Markdown文章
│       │   ├── wechat.html                  # 微信HTML格式
│       │   └── meta.json                    # 元数据信息
│       ├── 论文2/
│       │   └── ...
│       └── summary.json                     # 批次汇总报告
└── 论文解读自动生成微信推文_modified.json    # 批量处理workflow
```

---

## 🚀 使用步骤

### 步骤1：准备PDF文件

将所有待处理的PDF文件放入 `pdfs/` 目录：

```bash
# 复制PDF文件到pdfs目录
cp /path/to/your/paper.pdf pdfs/

# 或者批量复制
cp /path/to/papers/*.pdf pdfs/
```

**支持的文件名格式：**
- ✅ 中文文件名：`航空净零排放的途径.pdf`
- ✅ 英文文件名：`research_paper_2025.pdf`
- ✅ 带空格文件名：`My Research Paper.pdf`

**注意事项：**
- 文件名将用作输出目录名（去除.pdf扩展名）
- 避免使用特殊字符（如`/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`）

---

### 步骤2：启动n8n服务

确保所有服务已启动：

```bash
# 1. 启动n8n（如未启动）
docker start n8n

# 2. 启动PDF图片提取服务
python scripts/image_extract_service.py &

# 3. 启动Markdown转换服务
cd scripts/md-to-wechat && node server.js &
```

---

### 步骤3：导入并执行workflow

#### 方法一：命令行导入（推荐）

```bash
# 导入或更新workflow到n8n
n8n import:workflow --input="E:\code\n8n_workflow\论文解读自动生成微信推文_modified.json"
```

#### 方法二：网页端上传

1. 访问 http://localhost:5678
2. 点击左上角菜单 → Import from File
3. 选择 `论文解读自动生成微信推文_modified.json`
4. 点击 Import

---

### 步骤4：执行工作流

1. 在n8n界面打开导入的workflow
2. 点击右上角 **"Test workflow"** 或 **"Execute workflow"**
3. 等待处理完成

**处理过程：**
```
[开始] → 读取pdfs/*.pdf
       → 提取文件信息
       → 逐个处理每个PDF
         ├─ 提取PDF文本
         ├─ 提取图片和第一页
         ├─ AI生成Markdown
         ├─ 转换微信格式
         ├─ 上传图片到微信
         ├─ 创建草稿
         └─ 保存到独立目录
       → 生成批次汇总报告
[完成]
```

---

## 📊 输出文件说明

### 单篇论文输出

每篇论文的输出目录包含：

```
temp/batch_1729584420000/论文名称/
├── page_1.png          # 论文第一页截图（用于插入文章开头）
├── fig_1.png           # 提取的图表1
├── fig_2.png           # 提取的图表2
├── article.md          # AI生成的Markdown文章
├── wechat.html         # 微信公众号HTML格式
└── meta.json           # 元数据（包含路径、草稿ID等）
```

### meta.json 示例

```json
{
  "articleName": "航空净零排放的途径",
  "outputDir": "E:/code/n8n_workflow/temp/batch_1729584420000/航空净零排放的途径",
  "mdPath": "E:/code/n8n_workflow/temp/batch_1729584420000/航空净零排放的途径/article.md",
  "htmlPath": "E:/code/n8n_workflow/temp/batch_1729584420000/航空净零排放的途径/wechat.html",
  "draftId": "media_id_12345",
  "processedAt": "2025-10-22T06:27:00.000Z",
  "success": true
}
```

---

### 批次汇总报告

`summary.json` 包含本次批处理的汇总信息：

```json
{
  "batchId": 1729584420000,
  "totalCount": 3,
  "successCount": 3,
  "failedCount": 0,
  "results": [
    {
      "articleName": "论文1",
      "status": "success",
      "outputDir": "E:/code/n8n_workflow/temp/batch_1729584420000/论文1",
      "mdPath": "...",
      "htmlPath": "...",
      "error": null,
      "processedAt": "2025-10-22T06:27:00.000Z"
    },
    ...
  ],
  "timestamp": "2025-10-22T06:30:00.000Z"
}
```

---

## 🔧 workflow关键节点说明

### 1. 读取所有PDF文件
- **类型**：Read Binary Files
- **参数**：`fileSelector: "/files/pdfs/*.pdf"`
- **功能**：读取pdfs目录下所有PDF文件

### 2. 提取文件信息
- **类型**：Code节点
- **功能**：
  - 提取文件名
  - 生成动态路径
  - 创建批次ID

### 3. 逐个处理PDF
- **类型**：Split In Batches节点
- **参数**：`batchSize: 1`
- **功能**：
  - 一次处理1个PDF
  - 自动循环直到所有PDF处理完成

### 4. 提取PDF图片
- **类型**：HTTP Request
- **URL**：`http://host.docker.internal:3457/extract`
- **参数**：动态路径 `$json.pdfPath`, `$json.outputDir`

### 5. 保存Markdown和HTML
- **类型**：Code节点
- **功能**：
  - 保存AI生成的Markdown
  - 保存微信HTML格式
  - 保存元数据meta.json

### 6. 批次汇总
- **类型**：Code节点
- **功能**：
  - 汇总所有处理结果
  - 生成summary.json报告

---

## ✅ 验证处理结果

### 快速检查

```bash
# 查看批次目录
ls -la temp/

# 查看某个批次的内容
ls -la temp/batch_1729584420000/

# 查看某篇论文的输出
ls -la temp/batch_1729584420000/论文名称/

# 查看批次汇总报告
cat temp/batch_1729584420000/summary.json | python -m json.tool
```

### 检查清单

- [ ] 每篇论文有独立的输出目录
- [ ] 每个目录包含 `article.md` 和 `wechat.html`
- [ ] 每个目录包含 `page_1.png` 和 `fig_*.png`
- [ ] 每个目录包含 `meta.json`
- [ ] 批次目录包含 `summary.json`
- [ ] `summary.json` 中 `successCount` 与实际处理数量一致

---

## 🐛 常见问题排查

### 问题1：找不到PDF文件

**症状：**
- workflow执行后立即完成，没有处理任何PDF
- n8n显示"No items to process"

**解决方案：**
```bash
# 检查pdfs目录是否存在
ls -la pdfs/

# 检查PDF文件是否在正确位置
ls -la pdfs/*.pdf

# 确保文件权限正确
chmod 644 pdfs/*.pdf
```

---

### 问题2：图片提取服务无响应

**症状：**
- workflow卡在"提取PDF图片"节点
- 超时错误：`Request timeout after 60000ms`

**解决方案：**
```bash
# 检查服务是否运行
netstat -ano | findstr "3457"

# 重启图片提取服务
pkill -f image_extract_service
python scripts/image_extract_service.py &

# 测试服务
curl -X POST http://localhost:3457/extract \
  -H "Content-Type: application/json" \
  -d '{"pdfPath":"E:/code/n8n_workflow/pdfs/test.pdf","outputDir":"./temp"}'
```

---

### 问题3：循环处理未完成

**症状：**
- 只处理了第一个PDF就停止
- Split In Batches节点没有继续循环

**原因：**
- "保存Markdown和HTML"节点未正确连接回"逐个处理PDF"节点

**解决方案：**
1. 在n8n编辑器中检查连接
2. 确保"保存Markdown和HTML" → "逐个处理PDF"连接存在
3. 重新导入workflow

---

### 问题4：保存文件失败

**症状：**
- workflow执行成功，但输出目录为空
- 错误：`ENOENT: no such file or directory`

**解决方案：**
```bash
# 确保temp目录存在
mkdir -p temp

# 检查权限
chmod 755 temp

# 手动创建测试目录
mkdir -p temp/batch_test/test_paper
```

---

## 💡 高级用法

### 自定义输出目录格式

编辑"提取文件信息"节点的代码：

```javascript
// 按日期分组
outputDir: `E:/code/n8n_workflow/temp/${new Date().toISOString().split('T')[0]}/${fileNameWithoutExt}`

// 按类别分组（需要在文件名中包含类别）
const category = fileName.includes('ML') ? 'MachineLearning' : 'Other';
outputDir: `E:/code/n8n_workflow/temp/${category}/${fileNameWithoutExt}`
```

---

### 并发处理多个PDF

修改"逐个处理PDF"节点的`batchSize`：

```json
{
  "parameters": {
    "batchSize": 3,  // 同时处理3个PDF
    "options": {}
  }
}
```

⚠️ **注意**：并发处理会增加AI API的负载，建议根据API限额调整。

---

### 添加错误处理

在关键节点后添加IF节点检查成功状态：

```
[提取PDF图片] → [IF: success=true]
                   ├─ true → 继续处理
                   └─ false → 记录错误 → 跳过此PDF
```

---

## 📚 相关文档

- [README.md](./README.md) - 项目整体说明
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - 测试指南
- [论文解读自动生成微信推文_modified.json](./论文解读自动生成微信推文_modified.json) - 批量处理workflow

---

## 🎉 开始使用

```bash
# 1. 将PDF放入pdfs目录
cp your_papers/*.pdf pdfs/

# 2. 启动所有服务
docker start n8n
python scripts/image_extract_service.py &
cd scripts/md-to-wechat && node server.js &

# 3. 导入workflow
n8n import:workflow --input="E:\code\n8n_workflow\论文解读自动生成微信推文_modified.json"

# 4. 访问n8n并执行workflow
# http://localhost:5678

# 5. 检查结果
ls -la temp/batch_*/
```

祝你批量处理顺利！🚀
