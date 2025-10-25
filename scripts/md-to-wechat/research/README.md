# mdnice 探测研究

本目录包含用于探测和逆向 mdnice.com 实现机制的脚本。

## 📋 探测脚本

### 1. network-probe.ts
**网络请求探测**
- 监听所有网络请求（XHR、Fetch、API）
- 记录请求/响应内容
- 查找可能的后端 API
- 分析图片上传接口

**运行:**
```bash
npx ts-node research/network-probe.ts
```

### 2. code-probe.ts
**前端代码分析**
- 提取页面 JavaScript 资源
- 分析 Markdown 转换逻辑
- 查找使用的库（marked.js、markdown-it 等）
- 提取 CSS 样式

**运行:**
```bash
npx ts-node research/code-probe.ts
```

### 3. dom-probe.ts
**DOM 结构分析**
- 分析编辑器结构
- 分析预览区结构
- 监听 DOM 变化
- **直接从预览区提取 HTML**（关键！）

**运行:**
```bash
npx ts-node research/dom-probe.ts
```

### 4. run-all-probes.ts
**运行所有探测**
一键运行所有探测脚本并生成综合报告。

**运行:**
```bash
npx ts-node research/run-all-probes.ts
```

## 📁 输出目录

所有探测结果保存在 `research/output/` 目录：

```
output/
├── network-requests.json      # 所有网络请求
├── page-resources.json        # 页面资源（JS、CSS）
├── preview.html              # 预览区 HTML
├── core-logic.json           # 核心转换逻辑分析
├── inline-styles.css         # 内联样式
├── preview-computed-styles.css # 计算样式
├── converted-sample.html     # 转换示例
├── function-source.json      # 函数源代码信息
├── dom-analysis.json         # DOM 结构分析
├── direct-extracted.html     # 直接提取的 HTML
└── FINDINGS.md              # 探测结果总结
```

## 🎯 探测目标

1. **是否有后端 API?**
   - 如果有，可以直接调用 API
   - 如果没有，需要提取前端逻辑

2. **使用什么库转换 Markdown?**
   - marked.js
   - markdown-it
   - 自定义实现

3. **如何应用样式?**
   - 内联样式
   - CSS 类
   - 动态生成

4. **能否直接提取预览区 HTML?** ⭐
   - 这是最简单的方案
   - 不依赖剪贴板
   - 无头和有头模式都可用

## 🚀 快速开始

```bash
# 1. 编译 TypeScript
npm run build

# 2. 运行所有探测
npx ts-node research/run-all-probes.ts

# 3. 查看结果
cat research/output/FINDINGS.md
```

## 📊 预期成果

基于探测结果，我们将选择最优方案：

- **方案 A**: 纯 Node.js 转换（如果发现前端转换逻辑）
- **方案 B**: 调用后端 API（如果发现 API 接口）
- **方案 C**: 优化 Playwright（直接提取 DOM，不用剪贴板）

## 🔍 关键发现

（运行探测后会更新此部分）

### 预览区选择器
- 待探测...

### 转换库
- 待探测...

### API 接口
- 待探测...

### 样式应用方式
- 待探测...
