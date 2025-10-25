# mdnice 逆向工程探测结果

**探测时间**: 2025-10-23
**探测目标**: 分析 mdnice.com 的实现机制，寻找优化方案

---

## 🔍 关键发现

### 1. **预览区选择器问题**

❌ **`#nice-md-box` 选择器未找到**

在我们的初次探测中，`#nice-md-box` 元素并未找到。这可能是因为：
- mdnice 可能使用了动态类名或不同的 DOM 结构
- 需要在不同的 URL 或状态下测试
- 可能需要登录或特定条件才能看到该元素

### 2. **剪贴板内容分析** ⭐ 重要

✅ **成功通过剪贴板 API 获取 HTML (556KB)**

**关键问题**: 剪贴板中的 HTML 包含了大量 CSDN 的页面框架代码！

从输出可以看到：
```html
<div id="toolbarBox"...>
  <div id="csdn-toolbar"...>
    <!-- CSDN 工具栏 -->
    <!-- 搜索框 -->
    <!-- 用户信息 -->
    <!-- 广告内容 -->
  </div>
</div>
<div class="main_father"...>
  <!-- 页面主体 -->
  <div class="blog-content-box"...>
    <!-- 文章标题和元信息 -->
    <h1>【开源项目】私有化部署一个公众号markdown编辑工具</h1>
    <!-- ... -->
```

**结论**:
- 剪贴板中复制的不仅仅是 Markdown 渲染的内容
- 包含了整个 CSDN 文章页面的框架
- 这可能是 mdnice 为了在公众号中展示而添加的样式框架

### 3. **当前问题分析**

你提到的问题：
> "我现在用 playwright 的这个代码没有办法像有头的浏览器一样粘贴完后就自动更新输出的结果"

**根本原因分析**:

1. **无头模式的剪贴板限制**
   - 无头模式下，剪贴板 API 可能受限
   - 某些浏览器功能在无头模式下行为不同

2. **预览区元素未找到**
   - 可能的原因是 mdnice 使用了不同的 URL 结构
   - 我们使用的 URL 可能跳转到了 CSDN 页面（从剪贴板内容可以看出）

## 💡 解决方案

### 方案 A: 修正预览区选择器 ✅ 推荐

**问题**: 我们访问的 URL 可能不对

**建议**:
1. 尝试访问 `https://mdnice.com` 或 `https://editor.mdnice.com`（无参数）
2. 查找正确的预览区选择器
3. 使用浏览器开发者工具手动检查 DOM 结构

**实现**:
```typescript
// 尝试多个可能的选择器
const selectors = [
  '#nice-md-box',
  '.preview',
  '[id*="preview"]',
  '[class*="preview"]',
  '.markdown-body',
];

for (const selector of selectors) {
  const elem = await page.$(selector);
  if (elem) {
    const html = await page.evaluate((sel) => {
      return document.querySelector(sel)?.innerHTML;
    }, selector);

    if (html && html.length > 100) {
      return html; // 成功!
    }
  }
}
```

### 方案 B: 使用剪贴板但过滤无关内容

**如果必须使用剪贴板**:
1. 获取剪贴板 HTML
2. 解析 HTML 并提取实际内容
3. 去除 CSDN 工具栏、广告等

**实现**:
```typescript
const clipboardHTML = await page.evaluate(async () => {
  const items = await navigator.clipboard.read();
  for (const item of items) {
    if (item.types.includes('text/html')) {
      const blob = await item.getType('text/html');
      return await blob.text();
    }
  }
  return null;
});

// 解析并提取实际内容
const cleanHTML = extractActualContent(clipboardHTML);
```

### 方案 C: 浏览器实例复用 🚀 推荐

**优化性能**:
1. 启动一个持久化的浏览器实例
2. 保持页面打开
3. 多次请求复用同一个页面
4. 只需要每次更新 Markdown 内容

**优点**:
- 避免每次都重新启动浏览器
- 大幅提升性能
- 无头和有头模式都适用

## 🎯 下一步行动

### 立即行动:

1. **验证正确的 URL 和选择器**
   ```bash
   # 手动访问 mdnice.com 并检查 DOM
   ```

2. **修改探测脚本**
   - 尝试不同的 URL
   - 记录所有可能的预览区选择器

3. **实现优化版本**
   - 基于找到的正确选择器
   - 实现浏览器实例复用
   - 支持无头模式

### 待验证:

- [ ] mdnice.com 的正确入口 URL
- [ ] 预览区的实际 DOM 选择器
- [ ] 是否需要登录才能使用某些功能
- [ ] 无头模式下的剪贴板权限配置

## 📊 性能对比（预期）

| 方案 | 启动时间 | 转换时间 | 资源占用 | 稳定性 |
|------|----------|----------|----------|--------|
| 当前方案（每次启动浏览器） | 5-10s | 10-15s | 高 | 中 |
| 浏览器实例复用 | 5-10s（一次） | 2-5s | 中 | 高 |
| 纯 Node.js（如果可行） | 0s | <1s | 低 | 极高 |

## 🔬 需要进一步探测

1. **访问不同的 mdnice URL**
   - https://mdnice.com
   - https://editor.mdnice.com
   - https://editor.mdnice.com（不带 outId）

2. **分析页面跳转**
   - 检查是否有重定向
   - 确认最终渲染的页面

3. **查找前端转换库**
   - 检查是否使用 marked.js 或 markdown-it
   - 提取转换逻辑（如果是纯前端）

## ✅ 已创建的优化版本

文件: `src/index-optimized.ts`

**主要改进**:
1. 支持环境变量配置（`HEADLESS`, `TIMEOUT`等）
2. 直接从预览区提取 HTML（不依赖剪贴板）
3. 更好的错误处理
4. 可在无头模式下运行

**使用方式**:
```bash
# 编译
npm run build

# 测试（有头模式）
echo "# Test" | HEADLESS=false node dist/index-optimized.js --stdin

# 生产（无头模式）
echo "# Test" | HEADLESS=true node dist/index-optimized.js --stdin
```

## 🚨 待解决的核心问题

**你提到的问题**: "没有办法像有头的浏览器一样粘贴完后就自动更新输出的结果"

**需要确认**:
1. 你指的"粘贴完"是指什么操作？
2. "自动更新输出"具体指什么行为？
3. 有头模式下是如何工作的，无头模式下哪里不同？

**可能的原因**:
- 无头模式下某些 JavaScript 事件未触发
- 预览区渲染依赖某些用户交互
- 剪贴板 API 的权限问题

**建议调试步骤**:
1. 在有头模式下运行并观察具体行为
2. 对比无头模式和有头模式的差异
3. 使用 `page.on('console')` 监听页面日志
4. 检查是否有 JavaScript 错误

---

**总结**: 我们已经成功获取剪贴板 HTML，但发现了预览区选择器的问题。下一步需要验证正确的 URL 和选择器，然后实现优化版本。
