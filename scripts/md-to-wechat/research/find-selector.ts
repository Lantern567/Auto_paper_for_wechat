/**
 * 查找预览区选择器的详细探测脚本
 */

import { chromium } from 'playwright';

const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';

async function findPreviewSelector() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🌐 访问 mdnice...');
    await page.goto(MDNICE_URL, { waitUntil: 'networkidle' });

    // 关闭弹窗
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2000);

    // 等待编辑器
    await page.waitForSelector('.CodeMirror', { timeout: 30000 });

    console.log('\n🔍 查找所有可能的预览区元素...');

    const candidates = await page.evaluate(() => {
      const results: Array<{
        selector: string;
        tagName: string;
        id: string;
        classes: string;
        textLength: number;
        htmlLength: number;
        sample: string;
      }> = [];

      // 方法1: 查找包含特定文本的元素
      const allDivs = document.querySelectorAll('div, section, article');

      allDivs.forEach(elem => {
        const id = elem.id || '';
        const classes = elem.className || '';

        // 排除明显不相关的元素
        if (classes.includes('toolbar') || classes.includes('sidebar') || classes.includes('menu')) {
          return;
        }

        const textContent = elem.textContent || '';
        const innerHTML = elem.innerHTML || '';

        // 查找可能是预览区的元素
        if (innerHTML.length > 100 && innerHTML.length < 100000) {
          let selector = '';
          if (id) {
            selector = `#${id}`;
          } else if (classes) {
            selector = `.${classes.split(' ')[0]}`;
          }

          if (selector && !selector.includes('\\')) {
            results.push({
              selector,
              tagName: elem.tagName,
              id,
              classes,
              textLength: textContent.length,
              htmlLength: innerHTML.length,
              sample: innerHTML.substring(0, 200),
            });
          }
        }
      });

      return results.slice(0, 20); // 只返回前20个候选
    });

    console.log(`\n找到 ${candidates.length} 个候选元素:\n`);
    candidates.forEach((cand, idx) => {
      console.log(`${idx + 1}. 选择器: ${cand.selector}`);
      console.log(`   标签: ${cand.tagName}`);
      console.log(`   ID: ${cand.id || '(无)'}`);
      console.log(`   Class: ${cand.classes || '(无)'}`);
      console.log(`   文本长度: ${cand.textLength}`);
      console.log(`   HTML长度: ${cand.htmlLength}`);
      console.log(`   示例: ${cand.sample}...`);
      console.log('');
    });

    // 注入测试 Markdown
    console.log('📝 注入测试 Markdown 并观察变化...');
    const testMd = '# Hello Test\n\nThis is **bold** text.';

    await page.evaluate((md) => {
      const cm = (document.querySelector('.CodeMirror') as any);
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue(md);
      }
    }, testMd);

    await page.waitForTimeout(2000);

    // 再次检查，看哪个元素变化了
    console.log('\n🔍 检查哪些元素的内容发生了变化...');
    const changedElements = await page.evaluate((prevCandidates) => {
      const results: Array<{
        selector: string;
        newHTMLLength: number;
        containsTestText: boolean;
      }> = [];

      prevCandidates.forEach((cand: any) => {
        const elem = document.querySelector(cand.selector);
        if (!elem) return;

        const innerHTML = elem.innerHTML || '';
        const containsTest = innerHTML.includes('Hello Test') || innerHTML.includes('bold');

        results.push({
          selector: cand.selector,
          newHTMLLength: innerHTML.length,
          containsTestText,
        });
      });

      return results;
    }, candidates);

    console.log('\n可能的预览区元素（包含测试文本）:');
    changedElements.forEach((elem) => {
      if (elem.containsTestText) {
        console.log(`✅ ${elem.selector} - HTML长度: ${elem.newHTMLLength}`);
      }
    });

    console.log('\n\n按任意键继续...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('❌ 错误:', error);
  } finally {
    await browser.close();
  }
}

findPreviewSelector().catch(console.error);
