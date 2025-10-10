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
 * 在Markdown中插入图片链接
 * @param markdown 原始Markdown文本
 * @param imagePaths 图片路径数组
 * @returns 插入图片后的Markdown
 */
function insertImagesIntoMarkdown(markdown: string, imagePaths: string[]): string {
  if (!imagePaths || imagePaths.length === 0) {
    return markdown;
  }

  let result = markdown;

  // 查找所有图注: **图N. xxx**
  const figurePattern = /\*\*图(\d+)\.\s+([^*]+)\*\*/g;
  let match;
  const figures: Array<{ index: number; fullMatch: string; position: number }> = [];

  while ((match = figurePattern.exec(markdown)) !== null) {
    const figureNum = parseInt(match[1]);
    figures.push({
      index: figureNum,
      fullMatch: match[0],
      position: match.index
    });
  }

  console.error(`找到 ${figures.length} 个图注`);

  // 从后往前替换，避免位置偏移
  for (let i = figures.length - 1; i >= 0; i--) {
    const figure = figures[i];
    const imageIndex = figure.index - 1; // 数组从0开始

    if (imageIndex >= 0 && imageIndex < imagePaths.length) {
      const imagePath = imagePaths[imageIndex];
      // 在图注前插入图片markdown语法
      const imageMarkdown = `![图${figure.index}](${imagePath})\n\n`;
      result = result.slice(0, figure.position) + imageMarkdown + result.slice(figure.position);
      console.error(`插入图${figure.index}: ${imagePath}`);
    }
  }

  return result;
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
async function convertMarkdownToWechatHTML(markdown: string, imagePaths?: string[]): Promise<string> {
  let browser: Browser | null = null;

  try {
    // 如果提供了图片路径，先在Markdown中插入图片
    let processedMarkdown = markdown;
    if (imagePaths && imagePaths.length > 0) {
      console.error(`收到 ${imagePaths.length} 张图片，开始插入到Markdown中`);
      processedMarkdown = insertImagesIntoMarkdown(markdown, imagePaths);
    }

    // 加载 cookies（日志输出到stderr）
    const cookies = loadCookies();

    // 启动浏览器
    browser = await chromium.launch({
      headless: true // 使用无头浏览器
    });
    const context = await browser.newContext({
      permissions: ['clipboard-read', 'clipboard-write']
    });

    if (cookies.length > 0) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();

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

    // 清空并注入 Markdown 内容
    console.error('等待CodeMirror编辑器加载...');
    await page.waitForSelector('.CodeMirror', { timeout: TIMEOUT });

    console.error('清空并设置新内容...');
    await page.evaluate((md) => {
      const cm = document.querySelector('.CodeMirror') as any;
      if (cm && cm.CodeMirror) {
        // 先清空
        cm.CodeMirror.setValue('');
        // 等待一下
        setTimeout(() => {
          // 再设置新内容
          cm.CodeMirror.setValue(md);
        }, 100);
      }
    }, markdown);
    await page.waitForTimeout(500);

    // 点击编辑器并按回车键以触发渲染
    console.error('触发编辑器渲染...');
    await page.click('.CodeMirror');
    await page.waitForTimeout(200);
    await page.keyboard.press('End'); // 移动到末尾
    await page.keyboard.press('Enter'); // 按回车触发渲染
    await page.waitForTimeout(3000); // 等待渲染完成
    console.error('Markdown内容注入完成');

    // 点击复制按钮
    console.error('查找微信复制按钮...');
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

    // 检查是否有图片路径参数
    let imagePaths: string[] | undefined;
    const imagesIndex = args.indexOf('--images');
    if (imagesIndex !== -1 && imagesIndex + 1 < args.length) {
      try {
        imagePaths = JSON.parse(args[imagesIndex + 1]);
        console.error(`收到 ${imagePaths?.length || 0} 张图片路径`);
      } catch (e) {
        console.error('警告: 解析图片路径失败:', e);
      }
    }

    try {
      const html = await convertMarkdownToWechatHTML(markdown, imagePaths);
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
