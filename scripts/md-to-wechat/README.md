# Markdown 转微信公众号格式自动化工具

这是一个基于 Playwright 的自动化工具,可以将 Markdown 文件自动转换为微信公众号格式并复制到剪贴板。

## 功能特性

- ✅ 自动读取 Markdown 文件
- ✅ 使用 mdnice.com 编辑器进行专业排版
- ✅ 支持 Cookie 登录状态保持
- ✅ 自动复制到剪贴板
- ✅ 支持代码高亮、表格、引用等丰富格式
- ✅ 完整的错误处理和日志输出

## 安装依赖

首次使用需要安装依赖:

```bash
cd scripts/md-to-wechat
npm install
npx playwright install chromium
```

## 配置登录信息(可选)

如果需要使用登录状态(推荐),需要配置 `cookies.json` 文件。

### 获取 Cookie 的方法

1. 在浏览器中访问 https://editor.mdnice.com 并登录
2. 打开浏览器开发者工具(F12)
3. 在控制台(Console)中执行: `console.log(document.cookie)`
4. 复制输出的 cookie 字符串

### 配置文件格式

`cookies.json` 文件已经为你创建好了,包含以下关键 cookie:

```json
[
  {
    "name": "token",
    "value": "你的token值",
    "domain": ".mdnice.com",
    "path": "/"
  },
  {
    "name": "username",
    "value": "你的用户名",
    "domain": ".mdnice.com",
    "path": "/"
  }
]
```

**注意**: `cookies.json` 文件已经包含了你的登录信息,请勿分享给他人!

## 编译代码

修改代码后需要重新编译:

```bash
npm run build
```

## 使用方法

### 基本用法

```bash
# 转换单个 markdown 文件
npm run convert <markdown文件路径>

# 示例
npm run convert ../../test_article.md
```

### 直接使用 Node.js

```bash
node dist/index.js <markdown文件路径>
```

### 使用绝对路径

```bash
npm run convert "E:\code\n8n_workflow\test_article.md"
```

## 工作流程

1. **读取文件**: 从指定路径读取 Markdown 文件
2. **启动浏览器**: 启动 Chromium 浏览器(显示界面)
3. **注入 Cookies**: 如果存在 cookies.json,自动注入登录状态
4. **导航到编辑器**: 打开 mdnice.com 编辑器
5. **注入内容**: 将 Markdown 内容注入到 CodeMirror 编辑器
6. **复制格式**: 点击"复制到公众号"按钮
7. **完成**: 内容已在剪贴板中,可直接粘贴到微信公众平台

## 输出示例

```
=== Markdown 转微信公众号格式 ===

✓ 成功读取文件: E:\code\n8n_workflow\test_article.md
  文件大小: 1114 字符

✓ 成功加载 cookies 数据

启动浏览器...
✓ 已注入登录 cookies
✓ 浏览器已启动

导航到 mdnice 编辑器: https://editor.mdnice.com/...
✓ 页面加载完成

✓ 已关闭版本更新对话框

注入 Markdown 内容到编辑器...
✓ Markdown 内容已成功注入

点击"复制到公众号"按钮...
✓ 内容已成功复制到剪贴板

========================================
✓ 转换完成!
内容已复制到剪贴板
请打开微信公众平台粘贴内容
========================================
```

## 支持的 Markdown 语法

- 标题 (h1-h6)
- **粗体** 和 *斜体*
- 引用块 (>)
- 代码块 (```)
- 行内代码 (`code`)
- 列表(有序和无序)
- 表格
- 分隔线 (---)
- 链接和图片

## 常见问题

### 1. 登录失败或需要重新登录

**原因**: Cookie 过期

**解决方法**:
1. 重新登录 mdnice.com
2. 获取新的 cookie 字符串
3. 更新 `cookies.json` 文件

### 2. 浏览器启动失败

**原因**: Playwright 浏览器未安装

**解决方法**:
```bash
npx playwright install chromium
```

### 3. 文件读取失败

**原因**: 文件路径错误或文件不存在

**解决方法**:
- 检查文件路径是否正确
- 使用绝对路径
- 确保文件存在且有读取权限

### 4. 复制按钮点击失败

**原因**: 页面加载未完成或元素被遮挡

**解决方法**:
- 等待几秒后重试
- 检查是否有弹窗需要关闭
- 增加 `TIMEOUT` 值(在 index.ts 中修改)

## 高级配置

### 修改超时时间

编辑 `src/index.ts`:

```typescript
const TIMEOUT = 30000; // 改为更大的值,如 60000 (60秒)
```

### 使用无头模式

编辑 `src/index.ts`:

```typescript
browser = await chromium.launch({
  headless: true // 改为 true 则不显示浏览器界面
});
```

### 修改编辑器 URL

如果想使用不同的 mdnice 配置:

```typescript
const MDNICE_URL = 'https://editor.mdnice.com/?outId=你的outId';
```

## 文件结构

```
scripts/md-to-wechat/
├── package.json          # 项目依赖配置
├── tsconfig.json         # TypeScript 配置
├── cookies.json          # 登录 Cookies (不要提交到 git)
├── src/
│   └── index.ts          # 主程序源代码
├── dist/                 # 编译后的 JavaScript 文件
│   └── index.js
└── README.md             # 本文档
```

## 安全提示

⚠️ **重要**: `cookies.json` 包含你的登录凭证,请勿:
- 提交到 Git 仓库
- 分享给他人
- 公开发布

建议将 `cookies.json` 添加到 `.gitignore`:

```bash
echo "scripts/md-to-wechat/cookies.json" >> .gitignore
```

## 集成到 n8n 工作流

未来可以将此工具集成到 n8n 工作流中:

1. 在 n8n 中添加 "Execute Command" 节点
2. 运行命令: `cd scripts/md-to-wechat && npm run convert <file>`
3. 从前一个节点传递 Markdown 文件路径
4. 后续节点可以直接使用剪贴板内容

## 技术栈

- **Node.js**: 运行环境
- **TypeScript**: 类型安全的开发
- **Playwright**: 浏览器自动化
- **mdnice.com**: 专业的微信排版编辑器

## 许可证

MIT

---

**开发者**: Claude Code
**版本**: 1.0.0
**最后更新**: 2025-10-10
