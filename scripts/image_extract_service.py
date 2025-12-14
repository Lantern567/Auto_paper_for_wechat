#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF图片提取HTTP服务 - 使用 MinerU 优化版本
集成 MinerU 的强大文档解析能力,提供更准确的图片识别和标签匹配
"""

import sys
import json
import os
import base64
import re
import tempfile
import shutil
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import List, Dict, Optional, Tuple

try:
    import fitz  # PyMuPDF - 用于快速获取第一页
except ImportError as e:
    print(f"PyMuPDF not installed: {e}", file=sys.stderr)
    fitz = None

# MinerU 相关导入
try:
    from mineru.cli.client import main as mineru_main
    from mineru.version import __version__ as mineru_version
    MINERU_AVAILABLE = True
except ImportError:
    MINERU_AVAILABLE = False
    mineru_main = None
    mineru_version = None
    print("[WARN] MinerU 未安装或导入失败，将使用基础模式", file=sys.stderr)

# 配置项
MINERU_BACKEND = (os.environ.get('MINERU_BACKEND') or 'pipeline').strip()  # pipeline | vlm-transformers
MINERU_LANG = (os.environ.get('MINERU_LANG') or 'en').strip()  # ch | en
MINERU_DEVICE = (os.environ.get('MINERU_DEVICE') or 'cuda').strip()  # cpu | cuda | mps
MINERU_DPI = int(os.environ.get('MINERU_DPI', '300'))
MINERU_PARSE_FORMULA = os.environ.get('MINERU_PARSE_FORMULA', '1') == '1'
MINERU_PARSE_TABLE = os.environ.get('MINERU_PARSE_TABLE', '1') == '1'

# 图片匹配相关正则
FIG_REGEX = re.compile(
    r'(fig(?:ure)?|extended\s+data\s+fig|supplementary\s+fig|图)\.?\s*(?:\d+\s*[a-z]?)(?:\s*[-:|])?',
    re.IGNORECASE
)
IMAGE_MARKDOWN_PATTERN = re.compile(r'!\[(?P<alt>[^\]]*)\]\((?P<path>[^)]+)\)')


def extract_figure_number(caption_text: str) -> Optional[int]:
    """
    从caption文本中提取图号

    支持格式:
    - "图1 | xxx" -> 1
    - "图2. xxx" -> 2
    - "Fig. 3" -> 3
    - "Figure 4" -> 4

    Returns:
        图号，如果提取失败返回None
    """
    # 中文格式
    match = re.search(r'图\s*(\d+)', caption_text)
    if match:
        return int(match.group(1))

    # 英文格式
    match = re.search(r'(?:Fig|Figure)\.?\s*(\d+)', caption_text, re.IGNORECASE)
    if match:
        return int(match.group(1))

    return None


def encode_image_to_base64(image_path: Path) -> Tuple[str, str]:
    """
    将图片编码为 base64

    Returns:
        (base64_string, mime_type)
    """
    ext = image_path.suffix.lower()
    mime_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp'
    }
    mime_type = mime_map.get(ext, 'image/png')

    with open(image_path, 'rb') as f:
        base64_data = base64.b64encode(f.read()).decode('utf-8')

    return base64_data, mime_type


def extract_first_page_simple(pdf_path: str, output_dir: str, dpi: int = 300) -> Optional[Dict]:
    """
    使用 PyMuPDF 快速提取第一页

    Returns:
        第一页信息字典或None
    """
    if not fitz:
        return None

    try:
        import cv2
        import numpy as np
    except ImportError:
        return None

    try:
        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            doc.close()
            return None

        page = doc[0]
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

        output_path = Path(output_dir) / "page_1.png"
        cv2.imwrite(str(output_path), img)

        doc.close()

        base64_data, mime_type = encode_image_to_base64(output_path)

        return {
            'page': 1,
            'type': 'first_page',
            'path': str(output_path),
            'base64_data': base64_data,
            'filename': 'page_1.png',
            'mime_type': mime_type
        }
    except Exception as e:
        print(f"[WARN] 提取第一页失败: {e}", file=sys.stderr)
        return None


class MinerUImageExtractor:
    """
    使用 MinerU 的图像提取器
    """

    def __init__(self, backend: str = 'pipeline', lang: str = 'en', device: str = 'cpu'):
        self.backend = backend
        self.lang = lang
        self.device = device
        self.temp_dirs = []

    def __del__(self):
        """清理临时目录"""
        for temp_dir in self.temp_dirs:
            try:
                if temp_dir.exists():
                    shutil.rmtree(temp_dir)
            except Exception as e:
                print(f"[WARN] 清理临时目录失败: {e}", file=sys.stderr)

    def parse_pdf_with_mineru(self, pdf_path: str) -> Tuple[Path, str]:
        """
        使用 MinerU 解析 PDF

        Returns:
            (markdown_dir, markdown_content)
        """
        from mineru.cli.client import main as mineru_main
        import sys as _sys

        # 创建临时输出目录
        output_dir = Path(tempfile.mkdtemp(prefix='mineru_'))
        self.temp_dirs.append(output_dir)

        print(f"[INFO] MinerU 解析中: {pdf_path}", file=sys.stderr)
        print(f"[INFO] 输出目录: {output_dir}", file=sys.stderr)

        # 构建命令行参数
        original_argv = _sys.argv.copy()
        try:
            _sys.argv = [
                'mineru',
                '-p', pdf_path,
                '-o', str(output_dir),
                '-b', self.backend,
                '-l', self.lang,
                '-d', self.device,
                '-f', 'True' if MINERU_PARSE_FORMULA else 'False',
                '-t', 'True' if MINERU_PARSE_TABLE else 'False'
            ]

            # 调用 MinerU
            try:
                mineru_main()
            except SystemExit as e:
                # mineru_main 是 CLI 入口，正常结束会触发 SystemExit(0)
                if e.code not in (0, None):
                    print(f"[ERROR] MinerU 进程非零退出: {e}", file=sys.stderr)
                    raise
                else:
                    print(f"[INFO] MinerU 正常退出 (SystemExit {e.code})，继续处理输出", file=sys.stderr)

        finally:
            _sys.argv = original_argv

        # 查找生成的 markdown 文件
        print(f"[INFO] 查找 markdown 文件...", file=sys.stderr)
        md_files = list(output_dir.rglob('*.md'))
        print(f"[INFO] 找到 {len(md_files)} 个 markdown 文件", file=sys.stderr)

        if not md_files:
            raise RuntimeError("MinerU 未生成 markdown 文件")

        # 选择主 markdown 文件
        pdf_stem = Path(pdf_path).stem
        print(f"[INFO] PDF stem: {pdf_stem}", file=sys.stderr)

        md_file = next((f for f in md_files if f.stem.lower() == pdf_stem.lower()), md_files[0])
        print(f"[INFO] 选择的 markdown 文件: {md_file}", file=sys.stderr)
        print(f"[INFO] 文件存在: {md_file.exists()}, 大小: {md_file.stat().st_size if md_file.exists() else 0} 字节", file=sys.stderr)

        try:
            markdown_content = md_file.read_text(encoding='utf-8', errors='ignore')
            print(f"[INFO] MinerU 解析完成，markdown 长度: {len(markdown_content)}", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] 读取 markdown 文件失败: {e}", file=sys.stderr)
            raise

        # markdown 文件所在目录 (通常为 .../<pdf_stem>/auto/)
        markdown_dir = md_file.parent

        return markdown_dir, markdown_content

    def extract_images_from_markdown(
        self,
        markdown_content: str,
        markdown_dir: Path,
        output_dir: Path
    ) -> List[Dict]:
        """
        从 MinerU 生成的 markdown 中提取图片信息

        Args:
            markdown_content: markdown 文本内容
            markdown_dir: markdown 文件所在目录
            output_dir: 图片输出目录

        Returns:
            图片信息列表
        """
        figures = []
        seen_paths = set()
        auto_index = 1

        output_dir.mkdir(parents=True, exist_ok=True)

        # 分行处理，因为图注在图片引用的下一行
        lines = markdown_content.split('\n')

        # 调试：打印包含图片引用的行
        print(f"[DEBUG] 总行数: {len(lines)}", file=sys.stderr)
        for idx, l in enumerate(lines[:50]):
            if '![' in l or 'images/' in l:
                print(f"[DEBUG] Line {idx}: {repr(l[:120])}", file=sys.stderr)

        for i, line in enumerate(lines):
            match = IMAGE_MARKDOWN_PATTERN.search(line)
            if not match:
                continue

            alt_text = match.group('alt').strip()
            rel_path = match.group('path').strip()
            print(f"[DEBUG] 找到图片引用: alt={repr(alt_text)}, path={repr(rel_path)}", file=sys.stderr)

            # 跳过 URL
            if rel_path.startswith('http'):
                print(f"[DEBUG] 跳过 URL: {rel_path}", file=sys.stderr)
                continue

            # 构建图片绝对路径
            image_path = (markdown_dir / rel_path).resolve()
            print(f"[DEBUG] 图片路径: {image_path}, 存在: {image_path.exists()}", file=sys.stderr)

            # 检查文件是否存在
            if not image_path.exists() or not image_path.is_file():
                print(f"[WARN] 图片不存在: {image_path}", file=sys.stderr)
                continue

            # 去重
            path_key = str(image_path)
            if path_key in seen_paths:
                print(f"[DEBUG] 跳过重复: {path_key}", file=sys.stderr)
                continue
            seen_paths.add(path_key)

            # 扩大搜索范围：在图片前后多行寻找题注
            caption = None
            caption_source = None

            # 搜索顺序：下一行 > 前一行 > 下下行 > 前前行 > 更远
            search_offsets = [1, -1, 2, -2, 3, -3]
            for offset in search_offsets:
                check_idx = i + offset
                if 0 <= check_idx < len(lines):
                    check_line = lines[check_idx].strip()
                    if check_line and (
                        check_line.startswith('Figure ') or
                        check_line.startswith('Fig.') or
                        check_line.startswith('Fig ') or
                        check_line.startswith('图')
                    ):
                        caption = check_line.rstrip()
                        caption_source = f"offset {offset:+d}"
                        print(f"[DEBUG] 从第 {check_idx} 行 (offset={offset:+d}) 获取 caption: {caption[:80]}", file=sys.stderr)
                        break

            # 如果周围没找到标准格式的题注，检查下一行是否像题注描述（可能 Figure X 前缀丢失）
            if caption is None and i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                print(f"[DEBUG] 下一行（无 Figure 前缀）: {repr(next_line[:100]) if len(next_line) > 100 else repr(next_line)}", file=sys.stderr)

                # 检查下一行是否是描述性文字（可能是丢失了 Figure X 前缀的标注）
                # 特征：非空、不是纯空行、不是正文段落开头
                if next_line and len(next_line) > 20:
                    # 在 markdown 全文中搜索是否有 "Figure N" 引用指向这个位置
                    # 如果前面已提取了 Figure 1-4，这可能是 Figure 5
                    expected_fig_num = auto_index
                    fig_ref_pattern = re.compile(rf'Figure\s+{expected_fig_num}[A-Za-z]?\b', re.IGNORECASE)
                    # 在图片后的文本中搜索对这个图的引用
                    remaining_text = '\n'.join(lines[i+1:min(i+50, len(lines))])
                    if fig_ref_pattern.search(remaining_text):
                        caption = f"Figure {expected_fig_num}. {next_line[:100]}"
                        caption_source = "inferred from context"
                        print(f"[DEBUG] 推断标注（基于 Figure {expected_fig_num} 引用）: {caption[:80]}", file=sys.stderr)

            # 如果还是没有，回退到 alt_text / 路径中包含 fig 标记
            if caption is None and FIG_REGEX.search(alt_text):
                caption = alt_text
                caption_source = "alt_text"
                print(f"[DEBUG] 从 alt_text 获取 caption", file=sys.stderr)
            if caption is None and FIG_REGEX.search(rel_path):
                caption = alt_text or rel_path
                caption_source = "rel_path"
                print(f"[DEBUG] 从 rel_path 获取 caption", file=sys.stderr)

            # 最后的回退：如果这是正文中间的图片，基于序号生成 caption
            if caption is None:
                # 检查是否在参考文献部分（通常图片不应该在这里）
                context_before = '\n'.join(lines[max(0, i-10):i])
                if 'References' in context_before or 'REFERENCES' in context_before:
                    print(f"[DEBUG] 跳过：图片在参考文献部分", file=sys.stderr)
                    continue

                # 如果前面已经提取了图片，这可能是下一张
                if figures:
                    last_fig_num = figures[-1]['figure_index']
                    expected_num = last_fig_num + 1
                    # 检查是否有 Figure N 的引用
                    search_range = '\n'.join(lines[max(0, i-20):min(len(lines), i+30)])
                    if re.search(rf'Figure\s+{expected_num}\b', search_range, re.IGNORECASE):
                        caption = f"Figure {expected_num}. (caption not found in markdown)"
                        caption_source = "sequential inference"
                        print(f"[DEBUG] 序号推断标注: {caption}", file=sys.stderr)

            # 只有有明确题注的图才保留
            if not caption:
                print(f"[DEBUG] 跳过：没有 caption", file=sys.stderr)
                continue

            # 检查是否包含图表标识
            is_figure = bool(FIG_REGEX.search(caption) or FIG_REGEX.search(rel_path))
            if not is_figure:
                print(f"[DEBUG] 跳过：不是 figure (caption={caption[:50]})", file=sys.stderr)
                continue

            print(f"[DEBUG] 通过所有检查！caption={caption[:80]}", file=sys.stderr)

            # 提取图号
            figure_num = extract_figure_number(caption)
            if figure_num is None:
                figure_num = auto_index
            auto_index += 1

            # 复制图片到输出目录
            output_filename = f"fig_{figure_num}{image_path.suffix}"
            output_path = output_dir / output_filename

            try:
                shutil.copy2(image_path, output_path)
            except Exception as e:
                print(f"[WARN] 复制图片失败 {image_path}: {e}", file=sys.stderr)
                continue

            # 编码为 base64
            try:
                base64_data, mime_type = encode_image_to_base64(output_path)
            except Exception as e:
                print(f"[WARN] 编码图片失败 {output_path}: {e}", file=sys.stderr)
                continue

            # 从 markdown 中推断页码 (可选)
            page_num = self._infer_page_from_path(rel_path)

            figure_info = {
                'page': page_num,
                'figure_index': figure_num,
                'caption': caption,
                'bbox': None,  # MinerU markdown 不提供精确 bbox
                'path': str(output_path),
                'base64_data': base64_data,
                'filename': output_filename,
                'mime_type': mime_type,
                'source': 'mineru',
                'is_figure': is_figure
            }

            figures.append(figure_info)

            print(f"[INFO] 提取图片 {figure_num}: {caption[:80]}", file=sys.stderr)

        # 按图号排序
        figures.sort(key=lambda x: x['figure_index'])

        return figures

    def _infer_page_from_path(self, rel_path: str) -> Optional[int]:
        """从路径推断页码"""
        match = re.search(r'page[_-]?(\d+)', rel_path, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                pass
        return None

    def extract_images(self, pdf_path: str, output_dir: str) -> Dict:
        """
        主提取函数

        Args:
            pdf_path: PDF 文件路径
            output_dir: 输出目录

        Returns:
            {
                'figures': [...],
                'first_page': {...},
                'metadata': {...}
            }
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")

        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # 1. 先提取第一页 (使用快速方法)
        first_page = extract_first_page_simple(pdf_path, output_dir, dpi=MINERU_DPI)

        # 2. 使用 MinerU 解析 PDF
        try:
            markdown_dir, markdown_content = self.parse_pdf_with_mineru(pdf_path)
        except Exception as e:
            print(f"[ERROR] MinerU 解析失败: {e}", file=sys.stderr)
            raise

        # 3. 从 markdown 中提取图片
        try:
            print(f"[INFO] 开始从 markdown 提取图片", file=sys.stderr)
            print(f"[INFO] Markdown 长度: {len(markdown_content)} 字符", file=sys.stderr)
            print(f"[INFO] MinerU 输出目录: {markdown_dir}", file=sys.stderr)
            print(f"[INFO] 目标输出目录: {output_path}", file=sys.stderr)

            figures = self.extract_images_from_markdown(
                markdown_content,
                markdown_dir,
                output_path
            )

            print(f"[INFO] 共提取 {len(figures)} 张图片", file=sys.stderr)
        except Exception as e:
            print(f"[ERROR] 提取图片失败: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)
            # 返回空列表而不是崩溃
            figures = []

        return {
            'figures': figures,
            'first_page': first_page,
            'metadata': {
                'total_figures': len(figures),
                'backend': self.backend,
                'lang': self.lang,
                'device': self.device
            }
        }


class ImageExtractHandler(BaseHTTPRequestHandler):
    """HTTP 请求处理器"""

    def do_POST(self):
        if self.path != '/extract':
            self.send_error_response(404, "Endpoint not found")
            return

        try:
            # 读取请求
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)

            # 解码
            try:
                body = body_bytes.decode('utf-8')
            except UnicodeDecodeError:
                body = body_bytes.decode('gbk', errors='ignore')

            # 解析 JSON
            try:
                data = json.loads(body)
            except json.JSONDecodeError as e:
                self.send_error_response(400, f"Invalid JSON: {e}")
                return

            pdf_path = data.get('pdfPath')
            output_dir = data.get('outputDir', './temp')

            if not pdf_path:
                self.send_error_response(400, "Missing pdfPath parameter")
                return

            print(f"[{self.log_date_time_string()}] 收到提取请求: {pdf_path}", file=sys.stderr)

            # 执行提取
            if MINERU_AVAILABLE:
                extractor = MinerUImageExtractor(
                    backend=MINERU_BACKEND,
                    lang=MINERU_LANG,
                    device=MINERU_DEVICE
                )
                result = extractor.extract_images(pdf_path, output_dir)
            else:
                # 降级到基础模式
                first_page = extract_first_page_simple(pdf_path, output_dir)
                result = {
                    'figures': [],
                    'first_page': first_page,
                    'metadata': {'error': 'MinerU not available'}
                }

            # 返回成功响应
            self.send_success_response(result)

            print(f"[{self.log_date_time_string()}] 提取成功: {len(result['figures'])} 张图片", file=sys.stderr)

        except FileNotFoundError as e:
            self.send_error_response(404, str(e))
        except Exception as e:
            print(f"[{self.log_date_time_string()}] 提取失败: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            self.send_error_response(500, str(e))

    def send_success_response(self, result: Dict):
        """发送成功响应"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()

        response = {
            'success': True,
            'figures': result['figures'],
            'first_page': result['first_page'],
            'count': len(result['figures']),
            'metadata': result.get('metadata', {})
        }

        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def send_error_response(self, code: int, message: str):
        """发送错误响应"""
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()

        response = {
            'success': False,
            'error': message
        }

        self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

    def log_message(self, format, *args):
        """自定义日志"""
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def main():
    """启动 HTTP 服务"""
    port = int(os.environ.get('PORT', '3457'))

    print("=" * 60)
    print("PDF 图片提取服务 - MinerU 优化版")
    print("=" * 60)
    print(f"监听端口: {port}")
    print(f"API 地址: POST http://localhost:{port}/extract")
    print()
    print("MinerU 配置:")
    print(f"  - 可用状态: {'[YES] 已安装' if MINERU_AVAILABLE else '[NO] 未安装'}")
    print(f"  - Backend: {MINERU_BACKEND}")
    print(f"  - Language: {MINERU_LANG}")
    print(f"  - Device: {MINERU_DEVICE}")
    print(f"  - DPI: {MINERU_DPI}")
    print(f"  - 公式解析: {'[YES]' if MINERU_PARSE_FORMULA else '[NO]'}")
    print(f"  - 表格解析: {'[YES]' if MINERU_PARSE_TABLE else '[NO]'}")
    print()
    print("请求格式:")
    print('  { "pdfPath": "...", "outputDir": "..." }')
    print()
    print("响应格式:")
    print('  {')
    print('    "success": true,')
    print('    "figures": [...],')
    print('    "first_page": {...},')
    print('    "count": N')
    print('  }')
    print()
    print("按 Ctrl+C 停止服务")
    print("=" * 60)

    server = HTTPServer(('0.0.0.0', port), ImageExtractHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[INFO] 正在关闭服务...')
        server.shutdown()
        print('[INFO] 服务已停止')


if __name__ == "__main__":
    main()
