# 工作流测试指南

本文档提供完整的测试步骤，帮助您逐步验证"论文解读自动生成微信推文"工作流的每个环节。

---

## 📋 测试前准备

### 1. 准备测试 PDF 文件

在工作流目录中准备一个测试用的 PDF 论文文件：

```bash
# 将您的 PDF 文件放在工作流目录下
# 例如：e:\code\n8n_workflow\test_paper.pdf
```

**重要提示**：
- 确保 PDF 文件在 n8n 可以访问的路径
- 如果使用 Docker 运行 n8n，需要挂载卷使 PDF 可访问

### 2. 检查 n8n Docker 卷挂载

检查您的 n8n Docker 容器是否挂载了本地目录：

```bash
docker inspect n8n | grep -A 10 "Mounts"
```

**如果没有挂载，重新启动 n8n 并挂载工作流目录**：

```bash
docker stop n8n
docker rm n8n

# 重新启动并挂载本地目录
docker run -d --restart unless-stopped \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  -v e:/code/n8n_workflow:/files \
  n8nio/n8n
```

挂载后，PDF 文件路径应为：`/files/test_paper.pdf`

---

## 🧪 分步测试流程

### 阶段 1：测试 PDF 读取和提取

#### 步骤 1.1：配置 PDF 读取节点

1. 在 n8n 网页端打开工作流
2. 点击 **"读取PDF文件"** 节点
3. 配置参数：
   - **File Selector**: `/files/*.pdf` (Docker 内部路径)
   - 或者指定具体文件：`/files/test_paper.pdf`

#### 步骤 1.2：测试前 3 个节点

1. 点击 **"手动触发"** 节点
2. 点击右上角的 **"Test workflow"** 按钮
3. 观察执行结果：
   - ✅ **手动触发** 节点应显示绿色勾号
   - ✅ **读取PDF文件** 节点应显示读取到的文件（1 item）
   - ✅ **提取PDF文本** 节点应显示提取出的文本内容

**调试技巧**：
- 点击每个节点查看其输出数据
- 如果 PDF 读取失败，检查文件路径是否正确
- 如果文本提取失败，检查 PDF 是否为扫描版（需要 OCR）

---

### 阶段 2：测试提示词设置

#### 步骤 2.1：验证变量设置

1. 点击 **"设置提示词和PDF内容"** 节点
2. 查看输出数据，应包含两个字段：
   - `promptTemplate`: 完整的提示词模板
   - `pdfContent`: 从 PDF 提取的文本

#### 步骤 2.2：检查数据格式

确保 `pdfContent` 正确引用了上一步的输出：
```
={{ $json.text }}
```

---

### 阶段 3：测试 Gemini API 调用

#### 步骤 3.1：验证 API 配置

1. 点击 **"调用Gemini API"** 节点
2. 检查配置：
   - **URL**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
   - **Method**: POST
   - **Query Parameters**: `key = AIzaSyCcZSlIMx9Rvy89-YQTPtvhq5YdEarjudQ`
   - **Body**: 包含提示词和 PDF 内容的 JSON

#### 步骤 3.2：执行 API 调用

1. 点击 **"Test workflow"** 执行到这一步
2. 观察节点输出：
   - ✅ 应返回 JSON 格式的响应
   - ✅ `candidates[0].content.parts[0].text` 应包含生成的文章

**可能的错误**：

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `401 Unauthorized` | API Key 无效 | 检查 API Key 是否正确 |
| `400 Bad Request` | 请求格式错误 | 检查 Body JSON 格式 |
| `429 Too Many Requests` | 请求频率过高 | 等待几分钟后重试 |
| `timeout` | 内容太长，处理超时 | 减少 PDF 内容或增加超时时间 |

#### 步骤 3.3：调试 API 响应

如果 API 调用失败，可以在节点中添加错误处理：

1. 点击节点的 **"Settings"** 标签
2. 启用 **"Continue On Fail"**
3. 查看详细的错误信息

---

### 阶段 4：测试内容格式化

#### 步骤 4.1：验证格式化逻辑

1. 点击 **"格式化微信推文内容"** 节点
2. 查看 JavaScript 代码，确保：
   - 正确提取 Gemini 响应中的文本
   - Markdown 转 HTML 的正则表达式正确
   - 提取标题和摘要的逻辑正确

#### 步骤 4.2：检查输出数据

执行后，此节点应输出：
```json
{
  "title": "提取的文章标题",
  "summary": "提取的摘要",
  "content": "转换为HTML的文章内容",
  "originalMarkdown": "原始Markdown内容"
}
```

**调试技巧**：
- 在代码中添加 `console.log()` 查看中间变量
- 使用 `return` 前验证数据结构

---

### 阶段 5：测试微信草稿保存

#### 步骤 5.1：配置微信凭证

1. 确保您已在 n8n 中配置了微信公众号凭证
2. 凭证应包含：
   - AppID
   - AppSecret

#### 步骤 5.2：验证节点配置

点击 **"保存为微信草稿"** 节点，检查：
- **Resource**: `draft`
- **Operation**: `draft:addDraft`
- **Title**: `={{ $('格式化微信推文内容').item.json.title }}`
- **Content**: `={{ $('格式化微信推文内容').item.json.content }}`
- **Digest** (摘要): `={{ $('格式化微信推文内容').item.json.summary }}`

#### 步骤 5.3：执行完整工作流

1. 点击 **"Test workflow"** 执行完整流程
2. 观察所有节点执行状态
3. 最后一个节点应返回微信 API 的响应

**预期结果**：
- ✅ 微信草稿创建成功
- ✅ 返回草稿 ID 和相关信息

**可能的错误**：

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `40001` | Access Token 无效 | 检查微信凭证配置 |
| `40003` | AppID 无效 | 检查 AppID 是否正确 |
| `45009` | 接口调用超过限制 | 等待限制解除 |
| `47003` | 参数错误 | 检查 content 格式是否符合微信要求 |

---

## 🎯 完整端到端测试

完成所有分步测试后，执行完整的端到端测试：

### 测试步骤

1. **准备测试数据**：
   - 将一个真实的 PDF 论文放在 `/files/` 目录
   - 确保 PDF 可读且包含文本

2. **执行工作流**：
   - 点击 **"Execute workflow"** 按钮
   - 观察所有节点的执行过程

3. **验证结果**：
   - 打开微信公众平台
   - 进入 **"素材管理"** → **"草稿箱"**
   - 检查是否出现新生成的草稿
   - 预览草稿内容是否符合预期

4. **检查内容质量**：
   - ✅ 标题是否准确提取
   - ✅ 摘要是否简洁明了
   - ✅ 文章结构是否完整
   - ✅ 格式是否正确（标题、粗体、段落等）
   - ✅ 内容是否符合提示词模板风格

---

## 🐛 常见问题排查

### 问题 1：PDF 读取失败

**症状**：`ENOENT: no such file or directory`

**解决方案**：
```bash
# 检查 Docker 卷挂载
docker inspect n8n | grep -A 10 "Mounts"

# 进入容器检查文件
docker exec n8n ls -la /files/
```

### 问题 2：Gemini API 返回空内容

**症状**：格式化节点报错 "无法从 Gemini API 响应中提取文章内容"

**排查步骤**：
1. 检查 API Key 是否有效
2. 查看 Gemini 节点的完整响应
3. 确认 `response.candidates[0].content.parts[0].text` 路径正确
4. 检查 PDF 内容是否太长（超过 token 限制）

### 问题 3：微信草稿创建失败

**症状**：微信节点返回错误代码

**排查步骤**：
1. 验证微信公众号凭证是否正确
2. 检查账号是否有创建草稿的权限
3. 确认内容格式符合微信要求（不含敏感词、格式正确）
4. 查看微信公众平台的接口调用限制

### 问题 4：内容格式不正确

**症状**：生成的文章格式混乱

**解决方案**：
1. 在 "格式化微信推文内容" 节点中调整 Markdown 转 HTML 的正则表达式
2. 检查 Gemini 返回的内容格式
3. 考虑使用专业的 Markdown 转 HTML 库（如 marked）

---

## 📊 测试检查清单

使用此清单确保所有功能正常：

- [ ] PDF 文件可以成功读取
- [ ] PDF 文本可以正确提取
- [ ] 提示词模板正确设置
- [ ] Gemini API 调用成功
- [ ] Gemini 返回完整的文章内容
- [ ] 文章内容正确格式化为 HTML
- [ ] 标题和摘要正确提取
- [ ] 微信草稿创建成功
- [ ] 草稿内容在微信公众平台可见
- [ ] 文章格式符合预期
- [ ] 文章内容符合提示词模板风格

---

## 🎉 测试成功后

如果所有测试通过：

1. **保存工作流**：
   - 在 n8n 网页端点击 **"Save"** 保存工作流
   - 设置工作流为 **Active** (如果需要定时触发)

2. **导出最新版本**：
   ```bash
   # 在 n8n 网页端导出工作流
   # 或使用网页端的 "Export" 功能
   ```

3. **提交到 Git**：
   ```bash
   git add wechat_auto_paragraph.json
   git commit -m "完成工作流测试和优化"
   git push
   ```

4. **更新文档**：
   - 记录任何配置调整
   - 更新 README.md 中的使用说明

---

## 📞 获取帮助

如果遇到问题：

1. 查看 n8n 执行日志（每个节点的输出）
2. 检查 Docker 容器日志：`docker logs n8n`
3. 参考 n8n 官方文档：https://docs.n8n.io
4. 查看 Gemini API 文档：https://ai.google.dev/docs

祝测试顺利！🚀
