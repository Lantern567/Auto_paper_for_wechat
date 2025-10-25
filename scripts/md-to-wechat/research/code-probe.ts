/**
 * mdnice 前端代码分析脚本
 * 提取和分析 mdnice 的前端转换逻辑
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';
const OUTPUT_DIR = path.join(__dirname, 'output');

async function analyzeCode() {
  let browser: Browser | null = null;

  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('🚀 启动浏览器进行代码分析...');
    browser = await chromium.launch({
      headless: false,
    });

    const page = await browser.newPage();

    console.log('🌐 访问 mdnice...');
    await page.goto(MDNICE_URL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // 关闭弹窗
    try {
      await page.getByRole('button', { name: 'Close' }).click({ timeout: 2000 });
    } catch (e) {}
    try {
      await page.keyboard.press('Escape');
    } catch (e) {}

    await page.waitForTimeout(2000);

    console.log('\n🔍 分析转换逻辑...');

    // 分析核心转换函数
    const coreLogic = await page.evaluate(() => {
      const results: any = {
        markdownLibrary: null,
        converterFunction: null,
        cssThemes: [],
        rendererConfig: null,
      };

      // 查找 marked, markdown-it 等库
      if ((window as any).marked) {
        results.markdownLibrary = 'marked';
        results.markedVersion = (window as any).marked.version || 'unknown';
      }

      if ((window as any).markdownit) {
        results.markdownLibrary = 'markdown-it';
      }

      // 查找 CodeMirror 实例
      const cmElement = document.querySelector('.CodeMirror') as any;
      if (cmElement && cmElement.CodeMirror) {
        results.codeMirrorFound = true;
        results.codeMirrorMode = cmElement.CodeMirror.getOption('mode');
      }

      // 查找预览区选择器
      const possiblePreviewSelectors = [
        '#nice-md-box',
        '.preview',
        '[class*="preview"]',
        '[id*="preview"]',
      ];

      for (const selector of possiblePreviewSelectors) {
        const elem = document.querySelector(selector);
        if (elem) {
          results.previewSelector = selector;
          results.previewElement = {
            tagName: elem.tagName,
            className: elem.className,
            id: elem.id,
          };
          break;
        }
      }

      // 尝试查找转换函数
      const windowKeys = Object.keys(window);
      results.suspiciousGlobals = windowKeys.filter(key =>
        key.includes('render') ||
        key.includes('convert') ||
        key.includes('transform') ||
        key.includes('parse')
      );

      return results;
    });

    console.log('\n📦 核心逻辑分析:');
    console.log(JSON.stringify(coreLogic, null, 2));

    // 保存核心逻辑分析
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'core-logic.json'),
      JSON.stringify(coreLogic, null, 2)
    );

    // 提取完整的预览 HTML 及其样式
    console.log('\n🎨 提取样式和 HTML 结构...');
    const styleAnalysis = await page.evaluate(() => {
      // 获取所有内联样式
      const inlineStyles: string[] = [];
      document.querySelectorAll('style').forEach(style => {
        if (style.innerHTML.includes('nice') || style.innerHTML.includes('md')) {
          inlineStyles.push(style.innerHTML);
        }
      });

      // 获取预览区的完整 HTML
      const preview = document.querySelector('#nice-md-box') ||
                     document.querySelector('.preview');

      let previewHTML = '';
      let previewStyles = '';

      if (preview) {
        previewHTML = preview.outerHTML;

        // 获取计算样式
        const computedStyle = window.getComputedStyle(preview);
        previewStyles = Array.from(computedStyle).map(prop =>
          `${prop}: ${computedStyle.getPropertyValue(prop)};`
        ).join('\n');
      }

      return {
        inlineStyles,
        previewHTML,
        previewStyles,
      };
    });

    // 保存样式
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'inline-styles.css'),
      styleAnalysis.inlineStyles.join('\n\n/* ========== */\n\n')
    );

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'preview-computed-styles.css'),
      styleAnalysis.previewStyles
    );

    console.log('\n🔍 测试转换流程...');

    // 输入测试 Markdown 并观察转换
    const testMd = '# Hello\n\nThis is **bold** text.';

    await page.evaluate((md) => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue(md);
      }
    }, testMd);

    await page.waitForTimeout(1000);

    // 获取转换后的 HTML
    const convertedHTML = await page.evaluate(() => {
      const preview = document.querySelector('#nice-md-box') ||
                     document.querySelector('.preview');
      return preview ? preview.innerHTML : null;
    });

    if (convertedHTML) {
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'converted-sample.html'),
        convertedHTML
      );
      console.log('✅ 已保存转换示例');
    }

    // 尝试提取转换函数的源代码
    console.log('\n🔍 尝试提取转换函数源代码...');
    const functionSource = await page.evaluate(() => {
      const results: any = {};

      // 尝试查找 marked 配置
      if ((window as any).marked) {
        try {
          results.markedOptions = JSON.stringify((window as any).marked.options || {});
        } catch (e) {}
      }

      // 查找 React 组件树（如果有）
      const reactRoot = document.querySelector('#root') as any;
      if (reactRoot && reactRoot._reactRootContainer) {
        results.reactDetected = true;
      }

      return results;
    });

    console.log('\n📝 函数源代码信息:');
    console.log(JSON.stringify(functionSource, null, 2));

    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'function-source.json'),
      JSON.stringify(functionSource, null, 2)
    );

    console.log('\n✅ 代码分析完成!');
    console.log('📁 输出文件:');
    console.log('   - core-logic.json');
    console.log('   - inline-styles.css');
    console.log('   - preview-computed-styles.css');
    console.log('   - converted-sample.html');
    console.log('   - function-source.json');

  } catch (error) {
    console.error('❌ 分析失败:', error);
  } finally {
    if (browser) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      await browser.close();
    }
  }
}

analyzeCode().catch(console.error);
