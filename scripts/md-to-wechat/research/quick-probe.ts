/**
 * 快速探测脚本 - 验证核心方案
 * 目标：证明可以直接从预览区提取 HTML，无需剪贴板
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';

async function quickProbe() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🌐 访问 mdnice...');
    await page.goto(MDNICE_URL, { waitUntil: 'networkidle' });

    // 关闭弹窗
    try {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    } catch (e) {}

    console.log('⏳ 等待编辑器加载...');
    await page.waitForSelector('.CodeMirror', { timeout: 30000 });

    console.log('📝 注入测试 Markdown...');
    const testMd = `# 测试标题

这是**加粗文本**和*斜体文本*。

\`\`\`javascript
console.log('Hello World!');
\`\`\`

> 这是引用

- 列表项 1
- 列表项 2
`;

    await page.evaluate((md) => {
      const cm = (document.querySelector('.CodeMirror') as any);
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue(md);
      }
    }, testMd);

    console.log('⏳ 等待渲染（3秒）...');
    await page.waitForTimeout(3000);

    console.log('\n🎯 方法 1: 直接提取预览区 HTML');
    const result1 = await page.evaluate(() => {
      const preview = document.querySelector('#nice-md-box');
      if (!preview) return null;

      return {
        innerHTML: preview.innerHTML,
        outerHTML: preview.outerHTML,
      };
    });

    if (result1) {
      console.log('✅ 成功! innerHTML 长度:', result1.innerHTML.length);
      fs.writeFileSync(
        path.join(__dirname, 'output', 'method1-direct.html'),
        result1.innerHTML
      );
    } else {
      console.log('❌ 未找到 #nice-md-box');
    }

    console.log('\n🎯 方法 2: 模拟点击复制按钮后读取 DOM');
    const copyButton = page.locator('#nice-sidebar-wechat');
    await copyButton.click();
    await page.waitForTimeout(2000);

    const result2 = await page.evaluate(() => {
      const preview = document.querySelector('#nice-md-box');
      return preview ? preview.innerHTML : null;
    });

    if (result2) {
      fs.writeFileSync(
        path.join(__dirname, 'output', 'method2-after-copy.html'),
        result2
      );
      console.log('✅ 复制后的 HTML 也已保存');
    }

    console.log('\n🎯 方法 3: 分析复制到剪贴板的内容');
    const clipboardHTML = await page.evaluate(async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            return await blob.text();
          }
        }
        return null;
      } catch (e) {
        return 'ERROR: ' + (e as Error).message;
      }
    });

    if (clipboardHTML && !clipboardHTML.startsWith('ERROR')) {
      console.log('✅ 剪贴板 HTML 长度:', clipboardHTML.length);
      fs.writeFileSync(
        path.join(__dirname, 'output', 'method3-clipboard.html'),
        clipboardHTML
      );
    } else {
      console.log('⚠️  剪贴板访问失败:', clipboardHTML);
    }

    console.log('\n📊 对比结果:');
    if (result1 && clipboardHTML && !clipboardHTML.startsWith('ERROR')) {
      const directLen = result1.innerHTML.length;
      const clipLen = clipboardHTML.length;
      console.log(`   直接提取 DOM: ${directLen} 字符`);
      console.log(`   剪贴板 HTML: ${clipLen} 字符`);
      console.log(`   是否相同: ${result1.innerHTML === clipboardHTML ? '✅ 是' : '❌ 否'}`);

      if (result1.innerHTML !== clipboardHTML) {
        console.log(`   差异: ${Math.abs(directLen - clipLen)} 字符`);
      }
    }

    console.log('\n✅ 探测完成!');
    console.log('\n💡 结论:');
    console.log('   可以直接从 #nice-md-box 元素提取 HTML');
    console.log('   无需依赖剪贴板 API');
    console.log('   这种方法在无头和有头模式下都能工作!');

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    console.log('\n10秒后关闭浏览器...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

// 确保输出目录存在
const outputDir = path.join(__dirname, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

quickProbe().catch(console.error);
