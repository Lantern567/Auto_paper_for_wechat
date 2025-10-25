/**
 * 运行所有探测脚本并生成综合报告
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(__dirname, 'output');

function runScript(scriptPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 运行: ${path.basename(scriptPath)}`);
    console.log(`${'='.repeat(60)}\n`);

    const proc = spawn('npx', ['ts-node', scriptPath], {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${path.basename(scriptPath)} 完成`);
        resolve();
      } else {
        console.error(`\n❌ ${path.basename(scriptPath)} 失败 (退出码: ${code})`);
        reject(new Error(`Script failed with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`\n❌ 执行失败:`, err);
      reject(err);
    });
  });
}

async function main() {
  console.log('🔬 mdnice 探测研究');
  console.log('='.repeat(60));

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const scripts = [
    path.join(__dirname, 'network-probe.ts'),
    path.join(__dirname, 'code-probe.ts'),
    path.join(__dirname, 'dom-probe.ts'),
  ];

  try {
    // 依次运行所有脚本
    for (const script of scripts) {
      if (fs.existsSync(script)) {
        await runScript(script);
      } else {
        console.warn(`⚠️  脚本不存在: ${script}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有探测完成!');
    console.log('='.repeat(60));

    // 生成综合报告
    console.log('\n📝 生成综合报告...');
    await generateFindings();

    console.log('\n📁 查看结果:');
    console.log(`   研究目录: ${OUTPUT_DIR}`);
    console.log(`   综合报告: ${path.join(OUTPUT_DIR, 'FINDINGS.md')}`);

  } catch (error) {
    console.error('\n❌ 探测过程中出现错误:', error);
    process.exit(1);
  }
}

async function generateFindings() {
  const findings: string[] = [];

  findings.push('# mdnice 探测研究结果\n');
  findings.push(`生成时间: ${new Date().toLocaleString()}\n`);
  findings.push('---\n');

  // 读取所有分析结果
  const files = {
    'network-requests.json': '网络请求分析',
    'page-resources.json': '页面资源分析',
    'core-logic.json': '核心逻辑分析',
    'dom-analysis.json': 'DOM 结构分析',
  };

  for (const [filename, title] of Object.entries(files)) {
    const filePath = path.join(OUTPUT_DIR, filename);
    if (fs.existsSync(filePath)) {
      findings.push(`## ${title}\n`);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        findings.push('```json\n');
        findings.push(JSON.stringify(content, null, 2));
        findings.push('\n```\n\n');
      } catch (e) {
        findings.push(`（无法解析文件）\n\n`);
      }
    }
  }

  // 添加关键发现
  findings.push('## 🔍 关键发现\n\n');

  // 尝试读取并分析结果
  try {
    const coreLogic = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'core-logic.json'), 'utf-8'));

    findings.push('### Markdown 转换库\n');
    if (coreLogic.markdownLibrary) {
      findings.push(`- 使用库: **${coreLogic.markdownLibrary}**\n`);
      if (coreLogic.markedVersion) {
        findings.push(`- 版本: ${coreLogic.markedVersion}\n`);
      }
    } else {
      findings.push('- 未检测到常见 Markdown 库\n');
    }
    findings.push('\n');

    findings.push('### 预览区信息\n');
    if (coreLogic.previewSelector) {
      findings.push(`- 选择器: \`${coreLogic.previewSelector}\`\n`);
      findings.push(`- 元素信息:\n`);
      findings.push(`  - 标签: ${coreLogic.previewElement?.tagName}\n`);
      findings.push(`  - Class: ${coreLogic.previewElement?.className}\n`);
      findings.push(`  - ID: ${coreLogic.previewElement?.id}\n`);
    }
    findings.push('\n');

  } catch (e) {
    findings.push('（分析数据不完整）\n\n');
  }

  // 添加建议方案
  findings.push('## 💡 推荐方案\n\n');

  const hasDirectHTML = fs.existsSync(path.join(OUTPUT_DIR, 'direct-extracted.html'));

  if (hasDirectHTML) {
    findings.push('### ✅ 方案: 直接提取预览区 HTML\n\n');
    findings.push('**优点:**\n');
    findings.push('- ✅ 不依赖剪贴板 API\n');
    findings.push('- ✅ 无头和有头模式都可用\n');
    findings.push('- ✅ 简单可靠\n');
    findings.push('- ✅ 已验证可行\n\n');

    findings.push('**实现代码:**\n');
    findings.push('```typescript\n');
    findings.push('const html = await page.evaluate(() => {\n');
    findings.push('  const preview = document.querySelector("#nice-md-box") ||\n');
    findings.push('                 document.querySelector(".preview");\n');
    findings.push('  return preview ? preview.innerHTML : null;\n');
    findings.push('});\n');
    findings.push('```\n\n');
  } else {
    findings.push('### ⚠️  需要进一步分析\n\n');
    findings.push('未能成功提取预览区 HTML，需要进一步分析。\n\n');
  }

  // 保存报告
  const reportPath = path.join(OUTPUT_DIR, 'FINDINGS.md');
  fs.writeFileSync(reportPath, findings.join(''));
  console.log(`✅ 综合报告已生成: ${reportPath}`);
}

main().catch(console.error);
