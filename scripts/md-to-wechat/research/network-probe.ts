/**
 * mdnice 网络请求探测脚本
 * 用于分析 mdnice.com 的网络请求，查找可能的 API 接口
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';
const OUTPUT_DIR = path.join(__dirname, 'output');

interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  requestHeaders: any;
  requestBody?: any;
  responseStatus?: number;
  responseHeaders?: any;
  responseBody?: any;
  timing?: any;
}

const networkRequests: NetworkRequest[] = [];

async function probe() {
  let browser: Browser | null = null;

  try {
    // 确保输出目录存在
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    console.log('🚀 启动浏览器...');
    browser = await chromium.launch({
      headless: false, // 使用有头模式方便观察
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // 监听所有网络请求
    page.on('request', (request) => {
      const req: NetworkRequest = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
        requestHeaders: request.headers(),
      };

      // 记录 POST 请求的 body
      if (request.method() === 'POST') {
        req.requestBody = request.postData();
      }

      networkRequests.push(req);

      // 实时输出重要请求
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        console.log(`📡 [${request.method()}] ${request.url()}`);
      }
    });

    // 监听响应
    page.on('response', async (response) => {
      const url = response.url();
      const req = networkRequests.find(r => r.url === url && !r.responseStatus);

      if (req) {
        req.responseStatus = response.status();
        req.responseHeaders = response.headers();
        // req.timing = response.timing(); // timing() 方法不存在

        // 尝试获取响应体（仅对 API 请求）
        if (response.request().resourceType() === 'xhr' ||
            response.request().resourceType() === 'fetch') {
          try {
            const body = await response.text();
            req.responseBody = body;
            console.log(`✅ [${response.status()}] ${url}`);
            if (body && body.length < 500) {
              console.log(`   Response: ${body.substring(0, 200)}`);
            }
          } catch (e) {
            // 某些响应无法读取，忽略
          }
        }
      }
    });

    console.log('🌐 访问 mdnice 编辑器...');
    await page.goto(MDNICE_URL, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // 关闭可能的弹窗
    try {
      const closeButton = page.getByRole('button', { name: 'Close' });
      if (await closeButton.isVisible({ timeout: 3000 })) {
        await closeButton.click();
      }
    } catch (e) {}

    try {
      const driverOverlay = page.locator('.driver-overlay');
      if (await driverOverlay.isVisible({ timeout: 2000 })) {
        await page.keyboard.press('Escape');
      }
    } catch (e) {}

    console.log('⏳ 等待编辑器加载...');
    await page.waitForSelector('.CodeMirror', { timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('📝 注入测试 Markdown...');
    const testMarkdown = `# 测试标题

这是一段**测试文本**，包含：

- 列表项 1
- 列表项 2

\`\`\`javascript
console.log('Hello mdnice!');
\`\`\`

> 这是一段引用

![测试图片](https://via.placeholder.com/150)
`;

    // 清空并注入内容
    await page.evaluate((md) => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue('');
        cm.CodeMirror.setValue(md);
        cm.CodeMirror.refresh();
      }
    }, testMarkdown);

    console.log('⏳ 等待渲染完成...');
    await page.waitForTimeout(3000);

    console.log('🔍 分析预览区 HTML...');
    const previewHTML = await page.evaluate(() => {
      // 查找预览区域
      const preview = document.querySelector('#nice-md-box') ||
                     document.querySelector('.preview') ||
                     document.querySelector('[class*="preview"]');

      if (preview) {
        return {
          found: true,
          innerHTML: preview.innerHTML,
          outerHTML: preview.outerHTML,
          selector: preview.className,
        };
      }
      return { found: false };
    });

    if (previewHTML.found) {
      console.log('✅ 找到预览区域!');
      console.log(`   Selector: ${previewHTML.selector}`);

      // 保存预览 HTML
      const htmlPath = path.join(OUTPUT_DIR, 'preview.html');
      fs.writeFileSync(htmlPath, previewHTML.outerHTML);
      console.log(`   已保存到: ${htmlPath}`);
    }

    console.log('🔍 提取页面脚本和资源...');
    const pageInfo = await page.evaluate(() => {
      const scripts: string[] = [];
      const styles: string[] = [];

      // 获取所有脚本标签
      document.querySelectorAll('script[src]').forEach(script => {
        scripts.push((script as HTMLScriptElement).src);
      });

      // 获取所有样式标签
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        styles.push((link as HTMLLinkElement).href);
      });

      // 查找关键的全局变量或函数
      const globals = Object.keys(window).filter(key =>
        key.toLowerCase().includes('md') ||
        key.toLowerCase().includes('markdown') ||
        key.toLowerCase().includes('nice')
      );

      return { scripts, styles, globals };
    });

    console.log(`\n📦 页面资源分析:`);
    console.log(`   脚本文件数: ${pageInfo.scripts.length}`);
    console.log(`   样式文件数: ${pageInfo.styles.length}`);
    console.log(`   可能相关的全局变量: ${pageInfo.globals.join(', ')}`);

    // 保存页面资源信息
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'page-resources.json'),
      JSON.stringify(pageInfo, null, 2)
    );

    console.log('\n⏳ 保持页面打开 10 秒，观察更多网络请求...');
    await page.waitForTimeout(10000);

    // 保存所有网络请求
    const requestsPath = path.join(OUTPUT_DIR, 'network-requests.json');
    fs.writeFileSync(requestsPath, JSON.stringify(networkRequests, null, 2));
    console.log(`\n💾 已保存 ${networkRequests.length} 个网络请求到: ${requestsPath}`);

    // 分析请求类型
    const apiRequests = networkRequests.filter(r =>
      r.resourceType === 'xhr' || r.resourceType === 'fetch'
    );
    const postRequests = networkRequests.filter(r => r.method === 'POST');

    console.log(`\n📊 网络请求统计:`);
    console.log(`   总请求数: ${networkRequests.length}`);
    console.log(`   API 请求: ${apiRequests.length}`);
    console.log(`   POST 请求: ${postRequests.length}`);

    if (apiRequests.length > 0) {
      console.log(`\n🔍 API 请求列表:`);
      apiRequests.forEach(req => {
        console.log(`   [${req.method}] ${req.url}`);
      });
    }

    console.log('\n✅ 探测完成! 请查看 research/output/ 目录的结果文件');
    console.log('   - network-requests.json: 所有网络请求');
    console.log('   - preview.html: 预览区 HTML');
    console.log('   - page-resources.json: 页面资源信息');

  } catch (error) {
    console.error('❌ 探测失败:', error);
  } finally {
    if (browser) {
      console.log('\n⏳ 10 秒后关闭浏览器...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

// 运行探测
probe().catch(console.error);
