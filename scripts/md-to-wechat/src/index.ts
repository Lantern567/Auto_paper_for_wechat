import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Markdown 转微信公众号格式自动化工具
 * 使用 mdnice.com 编辑器进行格式转换
 */

const MDNICE_URL = 'https://editor.mdnice.com/?outId=69946bf6aba34f4685748cbc1c4867a7';
const TIMEOUT = 60000; // 60秒超时

/**
 * 读取 Markdown 文件内容
 */
function readMarkdownFile(filePath: string): string {
  try {
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`文件不存在: ${resolvedPath}`);
    }

    const content = fs.readFileSync(resolvedPath, 'utf-8');

    if (!content || content.trim().length === 0) {
      throw new Error('文件内容为空');
    }

    console.log(`✓ 成功读取文件: ${resolvedPath}`);
    console.log(`  文件大小: ${content.length} 字符\n`);

    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`读取文件失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 创建mdnice文章
 * @param page Playwright页面对象
 * @param title 文章标题
 */
async function createArticle(page: Page, title: string): Promise<void> {
  try {
    console.error(`创建文章: ${title}`);

    // 检查是否已经在文章页面（URL包含outId）
    const url = page.url();
    if (url.includes('outId=')) {
      console.error('✓ 已在文章页面，跳过创建');
      return;
    }

    // 等待并点击"新增文件夹"按钮旁边的plus按钮或直接点击菜单
    // 通常首次使用会自动弹出新增文章对话框
    try {
      await page.waitForSelector('dialog:has-text("新增文章")', { timeout: 5000 });
      console.error('✓ 检测到新增文章对话框');
    } catch (e) {
      // 没有弹出对话框，尝试点击plus按钮
      console.error('未检测到对话框，尝试点击新增按钮...');
      const plusButton = page.locator('button:has-text("plus")').first();
      await plusButton.click();
      await page.waitForTimeout(1000);
    }

    // 填写文章标题
    const titleInput = page.locator('textbox:has-text("请输入标题")').or(page.locator('input[placeholder*="标题"]')).first();
    await titleInput.fill(title);
    console.error('✓ 已填写标题');

    // 点击"新增"按钮
    const createButton = page.locator('button:has-text("新 增")').first();
    await createButton.click();
    console.error('✓ 点击新增按钮');

    // 等待文章创建成功（URL变化或成功提示）
    await page.waitForFunction(() => {
      return window.location.href.includes('outId=');
    }, { timeout: 10000 });

    console.error('✓ 文章创建成功');
    await page.waitForTimeout(2000); // 等待页面稳定

  } catch (error) {
    console.error(`✗ 创建文章失败: ${error}`);
    throw error;
  }
}

/**
 * 注入 Markdown 内容到 mdnice 编辑器
 */
async function injectMarkdown(page: Page, markdown: string): Promise<void> {
  try {
    console.log('注入 Markdown 内容到编辑器...');

    // 等待 CodeMirror 编辑器加载完成
    await page.waitForSelector('.CodeMirror', { timeout: TIMEOUT });

    // 注入内容
    const result = await page.evaluate((md) => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (!cm || !cm.CodeMirror) {
        return { success: false, message: 'CodeMirror 编辑器未找到' };
      }

      cm.CodeMirror.setValue(md);
      return { success: true, message: '内容已注入' };
    }, markdown);

    if (!result.success) {
      throw new Error(result.message);
    }

    console.log('✓ Markdown 内容已成功注入\n');

    // 等待内容渲染
    await page.waitForTimeout(2000);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`注入内容失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 点击复制到公众号按钮并保存复制的内容
 */
async function copyToWechat(page: Page, outputPath: string): Promise<void> {
  try {
    console.log('点击"复制到公众号"按钮...');

    // 点击右侧第一个图标(复制到公众号)
    await page.locator('#nice-sidebar-wechat').click();

    // 等待复制成功提示
    await page.waitForSelector('text=已复制，请到微信公众平台粘贴', {
      timeout: TIMEOUT
    });

    console.log('✓ 内容已成功复制到剪贴板\n');

    // 等待一下确保复制完成
    await page.waitForTimeout(1000);

    // 从剪贴板读取 HTML 内容
    console.log('读取剪贴板中的 HTML 内容...');
    const htmlContent = await page.evaluate(async () => {
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
      } catch (e) {
        return '读取剪贴板失败: ' + (e as Error).message;
      }
    });

    if (!htmlContent || htmlContent.includes('读取剪贴板失败')) {
      throw new Error(htmlContent || '获取剪贴板内容失败');
    }

    if (htmlContent.length < 100) {
      throw new Error('获取的内容异常短,可能不完整');
    }

    // 保存到文件
    fs.writeFileSync(outputPath, htmlContent, 'utf-8');
    console.log(`✓ 已保存HTML内容到: ${outputPath}`);
    console.log(`  文件大小: ${htmlContent.length} 字符\n`);

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`复制失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 加载 cookies
 */
function loadCookies(): any[] {
  try {
    const cookiesPath = path.join(__dirname, '..', 'cookies.json');

    if (!fs.existsSync(cookiesPath)) {
      console.error('⚠ 未找到 cookies.json 文件，将以未登录状态运行');
      console.error('  如需登录，请创建 cookies.json 文件\n');
      return [];
    }

    const cookiesData = fs.readFileSync(cookiesPath, 'utf-8');
    const cookies = JSON.parse(cookiesData);
    console.error('✓ 成功加载 cookies 数据\n');
    return cookies;
  } catch (error) {
    console.error('⚠ 读取 cookies 失败，将以未登录状态运行');
    if (error instanceof Error) {
      console.error(`  ${error.message}\n`);
    }
    return [];
  }
}

/**
 * 核心转换函数:将Markdown转换为微信公众号HTML
 */
async function convertMarkdownToWechatHTML(markdown: string): Promise<string> {
  let browser: Browser | null = null;

  try {
    // 加载 cookies（日志输出到stderr）
    const cookies = loadCookies();

    // 启动浏览器
    browser = await chromium.launch({
      headless: false, // 启用有头模式以支持mdnice对话框
      args: ['--disable-blink-features=AutomationControlled'] // 禁用自动化检测标识
    });
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' // 使用真实user-agent
    });

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

    // 覆盖navigator.webdriver属性来隐藏自动化标识
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false
      });
    });

    // 导航到 mdnice 编辑器
    await page.goto(MDNICE_URL, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT
    });

    // 关闭可能出现的对话框和引导层
    try {
      const closeButton = page.getByRole('button', { name: 'Close' });
      if (await closeButton.isVisible({ timeout: 3000 })) {
        await closeButton.click();
      }
    } catch (e) {
      // 忽略
    }

    try {
      const driverOverlay = page.locator('.driver-overlay');
      if (await driverOverlay.isVisible({ timeout: 2000 })) {
        await page.keyboard.press('Escape');
      }
    } catch (e) {
      // 忽略
    }

    // 步骤1：创建文章（使用时间戳作为标题）
    const articleTitle = `临时文章_${Date.now()}`;
    await createArticle(page, articleTitle);

    // 步骤2：等待CodeMirror编辑器加载
    console.error('等待CodeMirror编辑器加载...');
    await page.waitForSelector('.CodeMirror', { timeout: TIMEOUT });

    // 步骤3：注入纯文本Markdown（不包含图片）
    console.error('注入Markdown内容...');
    await page.evaluate((md) => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (cm && cm.CodeMirror) {
        cm.CodeMirror.setValue(md);
      }
    }, markdown);
    await page.waitForTimeout(1000);
    console.error('✓ Markdown内容注入完成');

    // 不再处理图片上传，图片由后续workflow节点处理
    console.error('\n跳过图片上传，由后续workflow节点处理');

    // 等待渲染完成
    await page.waitForTimeout(3000);
    console.error('✓ 等待页面渲染完成');

    // 点击复制按钮
    console.error('\n查找微信复制按钮...');
    const wechatButton = page.locator('#nice-sidebar-wechat');
    await wechatButton.waitFor({ state: 'visible', timeout: TIMEOUT });
    console.error('点击复制按钮...');
    await wechatButton.click();
    console.error('按钮已点击，等待3秒让复制完成...');
    await page.waitForTimeout(3000);

    // 检查是否有提示出现
    const hasNotification = await page.locator('text=已复制').isVisible().catch(() => false);
    if (hasNotification) {
      console.error('✓ 检测到复制成功提示');
    } else {
      console.error('⚠ 未检测到提示，但继续尝试读取剪贴板');
    }
    await page.waitForTimeout(1000);

    // 从剪贴板读取 HTML
    const htmlContent = await page.evaluate(async () => {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            return await blob.text();
          }
        }
        return await navigator.clipboard.readText();
      } catch (e) {
        throw new Error('读取剪贴板失败: ' + (e as Error).message);
      }
    });

    if (!htmlContent || htmlContent.length < 100) {
      throw new Error('获取的HTML内容异常');
    }

    return htmlContent;

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 主函数
 */
async function main() {
  // 检查命令行参数
  const args = process.argv.slice(2);

  // 检查是否使用 stdin 模式
  if (args.includes('--stdin')) {
    // stdin 模式: 从标准输入读取 Markdown, 输出 HTML 到标准输出
    let markdown = '';

    // 读取 stdin
    process.stdin.setEncoding('utf-8');
    for await (const chunk of process.stdin) {
      markdown += chunk;
    }

    if (!markdown || markdown.trim().length === 0) {
      console.error('错误: 未从stdin接收到Markdown内容');
      process.exit(1);
    }

    try {
      const html = await convertMarkdownToWechatHTML(markdown);
      // 输出HTML到stdout
      process.stdout.write(html);
      process.exit(0);
    } catch (error) {
      console.error('转换失败:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  // 文件模式(原有功能)
  if (args.length === 0) {
    console.error('错误: 请提供 Markdown 文件路径或使用 --stdin 模式\n');
    console.log('用法:');
    console.log('  文件模式:');
    console.log('    npm run convert <markdown-file-path>');
    console.log('  或');
    console.log('    node dist/index.js <markdown-file-path>\n');
    console.log('  stdin模式:');
    console.log('    echo "# 标题" | node dist/index.js --stdin\n');
    console.log('示例:');
    console.log('  npm run convert ../../output.md');
    process.exit(1);
  }

  const markdownPath = args[0];
  let browser: Browser | null = null;

  try {
    console.log('=== Markdown 转微信公众号格式 ===\n');

    // 1. 读取 Markdown 文件
    const markdown = readMarkdownFile(markdownPath);

    // 2. 加载 cookies
    const cookies = loadCookies();

    // 3. 启动浏览器
    console.log('启动浏览器...');
    browser = await chromium.launch({
      headless: false // 显示浏览器界面,方便调试
    });
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write'] // 授予剪贴板权限
    });

    // 添加 cookies
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      console.log('✓ 已注入登录 cookies');
    }

    const page = await context.newPage();
    console.log('✓ 浏览器已启动\n');

    // 4. 导航到 mdnice 编辑器
    console.log(`导航到 mdnice 编辑器: ${MDNICE_URL}`);
    await page.goto(MDNICE_URL, {
      waitUntil: 'networkidle',
      timeout: TIMEOUT
    });
    console.log('✓ 页面加载完成\n');

    // 5. 关闭可能出现的对话框和引导层
    try {
      // 关闭版本更新对话框
      const closeButton = page.getByRole('button', { name: 'Close' });
      if (await closeButton.isVisible({ timeout: 3000 })) {
        await closeButton.click();
        console.log('✓ 已关闭版本更新对话框');
      }
    } catch (e) {
      // 对话框可能不存在，忽略错误
    }

    try {
      // 关闭新手引导遮罩层
      const driverOverlay = page.locator('.driver-overlay');
      if (await driverOverlay.isVisible({ timeout: 2000 })) {
        // 按 ESC 键关闭引导
        await page.keyboard.press('Escape');
        console.log('✓ 已关闭新手引导');
      }
    } catch (e) {
      // 引导层可能不存在，忽略错误
    }

    console.log();

    // 6. 注入 Markdown 内容
    await injectMarkdown(page, markdown);

    // 7. 生成输出文件路径
    const parsedPath = path.parse(markdownPath);
    const outputPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}_wechat.html`
    );

    // 8. 复制到公众号并保存
    await copyToWechat(page, outputPath);

    // 9. 成功提示
    console.log('========================================');
    console.log('✓ 转换完成!');
    console.log('内容已复制到剪贴板');
    console.log(`输出文件: ${outputPath}`);
    console.log('请打开微信公众平台粘贴内容');
    console.log('========================================\n');

    // 等待几秒钟让用户查看结果
    await page.waitForTimeout(3000);

  } catch (error) {
    console.error('\n❌ 转换失败:');
    if (error instanceof Error) {
      console.error(`  ${error.message}\n`);
    } else {
      console.error(`  ${String(error)}\n`);
    }
    process.exit(1);
  } finally {
    // 关闭浏览器
    if (browser) {
      await browser.close();
      console.log('浏览器已关闭');
    }
  }
}

// 运行主函数
main().catch(console.error);
