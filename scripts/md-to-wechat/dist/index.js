"use strict";
/**
 * Markdown 转微信公众号格式自动化工具
 * 使用 mdnice.com 编辑器进行格式转换
 * 通过剪贴板 API 获取复制的 HTML 内容
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertMarkdownToWechatHTML = convertMarkdownToWechatHTML;
exports.injectMarkdownWithUpdate = injectMarkdownWithUpdate;
exports.extractPreviewHTML = extractPreviewHTML;
const playwright_1 = require("playwright");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';
const TIMEOUT = 60000; // 60秒超时
// 配置项
const CONFIG = {
    HEADLESS: process.env.HEADLESS !== 'false', // 默认无头模式
    TIMEOUT: parseInt(process.env.TIMEOUT || '60000'),
    RENDER_WAIT: parseInt(process.env.RENDER_WAIT || '5000'), // 渲染等待时间
};
/**
 * 关闭 mdnice 的弹窗和引导
 */
async function closeMdniceDialogs(page) {
    try {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
    }
    catch (e) {
        // 忽略错误
    }
}
/**
 * 🔑 关键函数：注入 Markdown 并触发预览区更新
 *
 * 核心技巧：手动触发 textarea 的 input 和 change 事件
 */
async function injectMarkdownWithUpdate(page, markdown) {
    console.error('注入 Markdown 内容并触发更新...');
    await page.evaluate((md) => {
        const cm = document.querySelector('.CodeMirror');
        if (!cm || !cm.CodeMirror) {
            throw new Error('CodeMirror 编辑器未找到');
        }
        console.log('步骤1: 选中全部内容');
        cm.CodeMirror.execCommand('selectAll');
        console.log('步骤2: 替换为新内容');
        cm.CodeMirror.replaceSelection(md);
        console.log('步骤3: 🔑 手动触发 input 和 change 事件（关键！）');
        const textarea = document.querySelector('.CodeMirror textarea');
        if (textarea) {
            console.log('  找到 textarea，触发事件...');
            // 触发 input 事件
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            // 触发 change 事件
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('  事件已触发');
        }
        else {
            console.log('  ❌ 未找到 textarea！');
        }
        console.log('步骤4: 刷新、移动光标到末尾、聚焦');
        cm.CodeMirror.refresh();
        cm.CodeMirror.execCommand('goDocEnd');
        cm.CodeMirror.focus();
        console.log('✓ 内容已替换，事件已触发');
    }, markdown);
    console.error('✓ Markdown 注入完成');
}
/**
 * 🎯 核心方法：点击复制按钮并从剪贴板读取 HTML
 *
 * 恢复原来的剪贴板读取方式
 */
async function extractPreviewHTML(page) {
    console.error('点击复制按钮并从剪贴板读取 HTML...');
    // 点击右侧第一个图标(复制到公众号)
    await page.locator('#nice-sidebar-wechat').click();
    console.error('✓ 已点击复制按钮');
    // 等待复制成功提示
    try {
        await page.waitForSelector('text=已复制，请到微信公众平台粘贴', {
            timeout: 5000
        });
        console.error('✓ 检测到复制成功提示');
    }
    catch (e) {
        console.error('⚠ 未检测到提示，但继续尝试读取剪贴板');
    }
    // 等待一下确保复制完成
    await page.waitForTimeout(1000);
    // 从剪贴板读取 HTML 内容
    const html = await page.evaluate(async () => {
        try {
            // 读取剪贴板中的 HTML 格式内容
            const clipboardItems = await navigator.clipboard.read();
            for (const item of clipboardItems) {
                // 查找 text/html 类型
                if (item.types.includes('text/html')) {
                    const blob = await item.getType('text/html');
                    const text = await blob.text();
                    return text;
                }
            }
            // 如果没有 HTML,尝试读取纯文本
            return await navigator.clipboard.readText();
        }
        catch (e) {
            throw new Error('读取剪贴板失败: ' + e.message);
        }
    });
    console.error(`✓ 从剪贴板提取到 HTML (${html.length} 字符)`);
    // 验证内容
    if (!html || html.trim().length === 0) {
        throw new Error('剪贴板内容为空');
    }
    if (html.length < 100) {
        throw new Error('获取的内容异常短,可能不完整');
    }
    return html;
}
/**
 * 核心转换函数：Markdown -> 微信公众号 HTML
 */
async function convertMarkdownToWechatHTML(markdown) {
    let browser = null;
    try {
        // 启动浏览器
        console.error('启动浏览器...');
        browser = await playwright_1.chromium.launch({
            headless: CONFIG.HEADLESS,
            args: ['--disable-blink-features=AutomationControlled'],
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            permissions: ['clipboard-read', 'clipboard-write'], // 添加剪贴板权限
        });
        // 加载 cookies（如果存在）
        const cookiesPath = path.join(__dirname, '..', 'cookies.json');
        if (fs.existsSync(cookiesPath)) {
            const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf-8'));
            await context.addCookies(cookies);
            console.error('✓ 已加载 cookies');
        }
        const page = await context.newPage();
        // 隐藏自动化标识
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });
        // 导航到 mdnice
        console.error('访问 mdnice 编辑器...');
        await page.goto(MDNICE_URL, {
            waitUntil: 'networkidle',
            timeout: CONFIG.TIMEOUT,
        });
        // 关闭弹窗
        await closeMdniceDialogs(page);
        // 等待编辑器完全加载
        console.error('等待编辑器加载...');
        await page.waitForSelector('.CodeMirror', { timeout: CONFIG.TIMEOUT });
        // 等待一段时间让 mdnice 完成初始化和旧内容加载
        console.error('等待 mdnice 完成初始化（包括加载旧内容）...');
        await page.waitForTimeout(5000);
        // 🔑 注入 Markdown 并立即触发更新（覆盖任何加载的内容）
        console.error('第一次注入...');
        await injectMarkdownWithUpdate(page, markdown);
        // 等待一下
        await page.waitForTimeout(2000);
        // 🔑 再次注入，确保内容正确（防止 mdnice 重新加载）
        console.error('第二次注入（确保覆盖）...');
        await injectMarkdownWithUpdate(page, markdown);
        // 等待预览区更新
        console.error('等待预览区渲染...');
        await page.waitForTimeout(3000);
        // 等待最终渲染
        console.error(`等待最终渲染 (${CONFIG.RENDER_WAIT}ms)...`);
        await page.waitForTimeout(CONFIG.RENDER_WAIT);
        // 🎯 直接从预览区提取 HTML
        const html = await extractPreviewHTML(page);
        return html;
    }
    finally {
        if (browser) {
            await browser.close();
            console.error('浏览器已关闭');
        }
    }
}
/**
 * 主函数
 */
async function main() {
    const args = process.argv.slice(2);
    // stdin 模式
    if (args.includes('--stdin')) {
        let markdown = '';
        process.stdin.setEncoding('utf-8');
        for await (const chunk of process.stdin) {
            markdown += chunk;
        }
        if (!markdown || markdown.trim().length === 0) {
            console.error('错误: 未从 stdin 接收到 Markdown 内容');
            process.exit(1);
        }
        try {
            const html = await convertMarkdownToWechatHTML(markdown);
            process.stdout.write(html);
            process.exit(0);
        }
        catch (error) {
            console.error('转换失败:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
    // 文件模式
    if (args.length === 0) {
        console.error('错误: 请提供 Markdown 文件路径或使用 --stdin 模式\n');
        console.log('用法:');
        console.log('  stdin 模式:');
        console.log('    echo "# 标题" | node dist/index-fixed.js --stdin\n');
        console.log('  文件模式:');
        console.log('    node dist/index-fixed.js <markdown-file>\n');
        console.log('环境变量:');
        console.log('  HEADLESS=false         # 有头模式（调试用，默认 true）');
        console.log('  TIMEOUT=60000          # 超时时间（默认 60000ms）');
        console.log('  RENDER_WAIT=3000       # 渲染等待时间（默认 3000ms）');
        process.exit(1);
    }
    const markdownPath = args[0];
    try {
        // 读取文件
        const markdown = fs.readFileSync(path.resolve(markdownPath), 'utf-8');
        if (!markdown || markdown.trim().length === 0) {
            throw new Error('文件内容为空');
        }
        console.error(`读取文件: ${markdownPath} (${markdown.length} 字符)`);
        // 转换
        const html = await convertMarkdownToWechatHTML(markdown);
        // 保存输出
        const outputPath = markdownPath.replace(/\.md$/, '_wechat.html');
        fs.writeFileSync(outputPath, html, 'utf-8');
        console.error(`\n✅ 转换完成!`);
        console.error(`输出文件: ${outputPath}`);
    }
    catch (error) {
        console.error('\n❌ 转换失败:');
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}
// 运行
if (require.main === module) {
    main().catch(console.error);
}
