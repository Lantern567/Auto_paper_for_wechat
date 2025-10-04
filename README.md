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
├── README.md                       # 本文档
├── wechat_auto_paragraph.json      # 微信自动分段工作流
└── .gitignore                      # Git 忽略配置
```

---

## 下一步

1. ✅ 在 VS Code 中继续编辑 `wechat_auto_paragraph.json`
2. ✅ 使用 `n8n import` 同步到服务
3. ✅ 在网页端进行可视化调试
4. ✅ 定期提交到 Git 保存进度

祝开发顺利！🚀
