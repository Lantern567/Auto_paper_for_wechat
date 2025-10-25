/**
 * mdnice DOM 分析脚本
 * 深入分析 DOM 结构和事件监听
 */

import { chromium, Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';
const OUTPUT_DIR = path.join(__dirname, 'output');

async function analyzeDOM() {
  let browser: Browser | null = null;

  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('🚀 启动 DOM 分析...');
    browser = await chromium.launch({
      headless: false,
    });

    const page = await browser.newPage();
    await page.goto(MDNICE_URL, { waitUntil: 'networkidle', timeout: 60000 });

    // 关闭弹窗
    try {
      await page.getByRole('button', { name: 'Close' }).click({ timeout: 2000 });
    } catch (e) {}
    try {
      await page.keyboard.press('Escape');
    } catch (e) {}

    await page.waitForTimeout(2000);

    console.log('\n🔍 分析 DOM 结构...');

    const domAnalysis = await page.evaluate(() => {
      const results: any = {
        editorInfo: {},
        previewInfo: {},
        copyButtonInfo: {},
        eventListeners: [],
      };

      // 分析编辑器
      const cmElement = document.querySelector('.CodeMirror');
      if (cmElement) {
        results.editorInfo = {
          selector: '.CodeMirror',
          id: cmElement.id,
          className: cmElement.className,
          attributes: Array.from(cmElement.attributes).map(attr => ({
            name: attr.name,
            value: attr.value,
          })),
        };
      }

      // 分析预览区
      const previewSelectors = [
        '#nice-md-box',
        '.preview',
        '[class*="preview"]',
        '#preview',
      ];

      for (const selector of previewSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          results.previewInfo = {
            selector,
            id: elem.id,
            className: elem.className,
            tagName: elem.tagName,
            childCount: elem.children.length,
            attributes: Array.from(elem.attributes).map(attr => ({
              name: attr.name,
              value: attr.value,
            })),
          };
          break;
        }
      }

      // 分析复制按钮
      const copyButton = document.querySelector('#nice-sidebar-wechat') ||
                        document.querySelector('[title*="微信"]') ||
                        document.querySelector('[title*="公众号"]');

      if (copyButton) {
        results.copyButtonInfo = {
          selector: copyButton.id ? `#${copyButton.id}` : `.${copyButton.className}`,
          id: copyButton.id,
          className: copyButton.className,
          title: copyButton.getAttribute('title'),
          tagName: copyButton.tagName,
        };
      }

      // 查找所有可能的转换相关元素
      const suspiciousElements = document.querySelectorAll('[class*="render"], [class*="convert"], [id*="render"], [id*="convert"]');
      results.suspiciousElements = Array.from(suspiciousElements).map(elem => ({
        tagName: elem.tagName,
        id: elem.id,
        className: elem.className,
      }));

      return results;
    });

    console.log('\n📊 DOM 结构分析:');
    console.log(JSON.stringify(domAnalysis, null, 2));

    // 保存 DOM 分析
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'dom-analysis.json'),
      JSON.stringify(domAnalysis, null, 2)
    );

    // 监听 DOM 变化
    console.log('\n👀 监听 DOM 变化...');

    await page.evaluate(() => {
      const preview = document.querySelector('#nice-md-box') ||
                     document.querySelector('.preview');

      if (preview) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            console.log('DOM 变化:', mutation.type, mutation.target);
          });
        });

        observer.observe(preview, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
        });

        (window as any).__domObserver = observer;
      }
    });

    console.log('✅ DOM 监听器已设置');

    // 测试输入并观察变化
    console.log('\n📝 测试输入 Markdown...');

    await page.evaluate(() => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue('# Test\n\nHello **world**!');
      }
    });

    await page.waitForTimeout(2000);

    // 分析"复制到公众号"按钮的实现
    console.log('\n🔍 分析复制功能...');

    const copyMechanism = await page.evaluate(() => {
      const copyButton = document.querySelector('#nice-sidebar-wechat');

      if (!copyButton) {
        return { found: false };
      }

      // 获取按钮的所有事件监听器（通过 getEventListeners，仅在 DevTools 中可用）
      // 这里我们尝试通过点击来触发并观察
      return {
        found: true,
        buttonExists: true,
        buttonText: copyButton.textContent,
        buttonTitle: copyButton.getAttribute('title'),
      };
    });

    console.log('📋 复制机制分析:');
    console.log(JSON.stringify(copyMechanism, null, 2));

    // 尝试直接从预览区获取 HTML（这是关键！）
    console.log('\n🎯 直接从预览区提取 HTML...');

    const directHTML = await page.evaluate(() => {
      const preview = document.querySelector('#nice-md-box') ||
                     document.querySelector('.preview');

      if (!preview) {
        return { success: false, message: '未找到预览区' };
      }

      // 方法1: 直接获取 innerHTML
      const innerHTML = preview.innerHTML;

      // 方法2: 获取包含样式的 outerHTML
      const outerHTML = preview.outerHTML;

      // 方法3: 克隆节点并获取其 HTML
      const cloned = preview.cloneNode(true) as HTMLElement;
      const clonedHTML = cloned.outerHTML;

      return {
        success: true,
        method1_innerHTML: innerHTML,
        method2_outerHTML: outerHTML,
        method3_clonedHTML: clonedHTML,
        areEqual: innerHTML === outerHTML,
      };
    });

    if (directHTML.success && directHTML.method1_innerHTML && directHTML.method2_outerHTML) {
      console.log('✅ 成功直接提取 HTML!');
      console.log(`   innerHTML 长度: ${directHTML.method1_innerHTML.length}`);
      console.log(`   outerHTML 长度: ${directHTML.method2_outerHTML.length}`);

      // 保存提取的 HTML
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'direct-extracted.html'),
        directHTML.method2_outerHTML
      );

      console.log('✅ 已保存直接提取的 HTML');
    } else {
      console.log('❌ 提取失败:', directHTML.message);
    }

    console.log('\n✅ DOM 分析完成!');
    console.log('📁 输出文件:');
    console.log('   - dom-analysis.json');
    console.log('   - direct-extracted.html');

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    if (browser) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
    }
  }
}

analyzeDOM().catch(console.error);
