# 🎯 完整解决方案总结

## 📋 问题描述

**你遇到的问题**: 多次调用 Playwright 转换服务时，输出结果都一致，没有根据新的 Markdown 输入自动更新。

## 🔍 通过 Playwright MCP 的探测发现

### 核心发现

1. **预览区选择器**: `#nice` （不是 `#nice-md-box`）
2. **更新触发机制**: 直接调用 `setValue()` **不会**触发预览区更新
3. **解决方法**: 需要通过 `setValue(value + ' ')` 然后 `undo` 来触发 change 事件

### 验证过程

使用 Playwright MCP 进行了实时测试：

```javascript
// ❌ 错误方式（预览区不会更新）
cm.CodeMirror.setValue('# 新内容');

// ✅ 正确方式（预览区会更新）
cm.CodeMirror.setValue('# 新内容');
cm.CodeMirror.setValue(cm.CodeMirror.getValue() + ' ');  // 添加空格
cm.CodeMirror.execCommand('undo');  // 撤销（触发 change 事件）
```

## ✅ 最终解决方案

### 修复后的代码 ([src/index-fixed.ts](src/index-fixed.ts))

关键改进点：

```typescript
async function injectMarkdownWithUpdate(page: Page, markdown: string): Promise<void> {
  await page.evaluate((md) => {
    const cm = (document.querySelector('.CodeMirror') as any);

    // 步骤1: 完全清空编辑器
    cm.CodeMirror.execCommand('selectAll');
    cm.CodeMirror.replaceSelection('');
    cm.CodeMirror.setValue('');
    cm.CodeMirror.refresh();

    // 步骤2: 设置新内容
    cm.CodeMirror.setValue(md);

    // 步骤3: 🔑 触发更新（关键！）
    const currentValue = cm.CodeMirror.getValue();
    cm.CodeMirror.setValue(currentValue + ' ');
    cm.CodeMirror.execCommand('undo');

    // 步骤4: 刷新和聚焦
    cm.CodeMirror.refresh();
    cm.CodeMirror.execCommand('goDocEnd');
    cm.CodeMirror.focus();
  }, markdown);

  // 等待渲染完成
  await page.waitForTimeout(3000);
}
```

### 提取 HTML 的方法

```typescript
async function extractPreviewHTML(page: Page): Promise<string> {
  const html = await page.evaluate(() => {
    const preview = document.querySelector('#nice');  // ✅ 正确选择器
    if (!preview) throw new Error('预览区未找到');
    return preview.innerHTML;
  });
  return html;
}
```

## 📊 使用方法

### 编译
```bash
cd scripts/md-to-wechat
npx tsc src/index-fixed.ts --outDir dist --skipLibCheck --esModuleInterop --resolveJsonModule --moduleResolution node
```

### 使用（stdin 模式）
```bash
# 无头模式（生产环境）
echo "# 测试标题\n\n这是**测试**内容" | node dist/index-fixed.js --stdin > output.html

# 有头模式（调试）
echo "# 测试标题" | HEADLESS=false node dist/index-fixed.js --stdin > output.html
```

### 替换现有的 index.ts
```bash
# 备份旧文件
cp src/index.ts src/index.ts.backup

# 使用修复版本
cp src/index-fixed.ts src/index.ts

# 重新编译
npm run build
```

## 🎯 关键要点

### 1. **预览区不会自动监听 setValue()**
- mdnice 的预览区只在用户"手动输入"时更新
- 直接调用 API 不会触发渲染

### 2. **触发更新的技巧**
- 添加临时内容（空格）
- 立即撤销
- 这会触发 change 事件

### 3. **正确的预览区选择器**
- `#nice` ✅
- 不是 `#nice-md-box` ❌

### 4. **使用 outId 的好处**
- 避免每次都需要登录
- 可以使用已保存的 cookies
- 更稳定可靠

## 🚀 性能优化建议

当前版本适合单次调用。如果需要频繁调用，建议：

### 方案：浏览器实例复用
- 启动时创建一个持久化浏览器实例
- 保持页面打开
- 每次只更新 Markdown 内容
- 性能提升 3-5 倍

## ✅ 下一步

1. 测试修复后的代码
2. 如果工作正常，替换 `src/index.ts`
3. 更新 `server.js` 的文档说明
4. 考虑实现浏览器实例复用（可选）

## 📝 文件列表

- ✅ `src/index-fixed.ts` - 修复后的转换器
- ✅ `research/output/SOLUTION.md` - 详细解决方案文档
- ✅ `research/quick-probe.ts` - Playwright MCP 探测脚本
- ✅ `research/output/FINDINGS.md` - 探测结果总结

---

**感谢使用 Playwright MCP！** 它帮助我们快速发现并解决了这个关键问题。
