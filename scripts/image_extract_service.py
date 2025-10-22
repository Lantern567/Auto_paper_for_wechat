#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF图片提取HTTP服务 - 使用混合策略提取学术论文中的图表
"""

import sys
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import re

try:
    import fitz  # PyMuPDF
    import cv2
    import numpy as np
except ImportError as e:
    print(f"Required library not installed: {e}", file=sys.stderr)
    print("Please run: pip install PyMuPDF opencv-python numpy", file=sys.stderr)
    sys.exit(1)


def detect_figure_captions(page):
    """
    检测页面中的图表标题（加粗的Fig.X格式）
    """
    captions = []
    exclude_keywords = ['reveals', 'shows', 'are depicted', 'is shown',
                       'we used', 'can be found', 'are presented']

    blocks = page.get_text("dict")["blocks"]

    for block in blocks:
        if block.get("type") == 0:
            for line in block.get("lines", []):
                line_text = ""
                is_bold = False
                line_bbox = None

                for span in line.get("spans", []):
                    line_text += span.get("text", "")
                    flags = span.get("flags", 0)
                    if flags & 16:
                        is_bold = True
                    if line_bbox is None:
                        line_bbox = list(span["bbox"])
                    else:
                        line_bbox[0] = min(line_bbox[0], span["bbox"][0])
                        line_bbox[1] = min(line_bbox[1], span["bbox"][1])
                        line_bbox[2] = max(line_bbox[2], span["bbox"][2])
                        line_bbox[3] = max(line_bbox[3], span["bbox"][3])

                if line_text and line_bbox:
                    if re.match(r'^(Fig\.|Figure|fig\.|figure|FIG\.)\s*\d+', line_text.strip()):
                        if is_bold:
                            if not any(keyword in line_text for keyword in exclude_keywords):
                                captions.append({
                                    'bbox': line_bbox,
                                    'text': line_text.strip(),
                                    'y_top': line_bbox[1]
                                })

    captions.sort(key=lambda x: x['y_top'])
    return captions


def get_text_regions(page):
    """获取所有文字区域"""
    text_regions = []
    blocks = page.get_text("dict")["blocks"]

    for block in blocks:
        if block.get("type") == 0:
            bbox = block["bbox"]
            text_regions.append([bbox[0], bbox[1], bbox[2], bbox[3]])

    return text_regions


def generate_text_stripped_image(page, dpi=300):
    """生成去除文字的图片"""
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    text_regions = get_text_regions(page)
    page_rect = page.rect
    scale_x = pix.width / page_rect.width
    scale_y = pix.height / page_rect.height

    for region in text_regions:
        x0 = int(region[0] * scale_x)
        y0 = int(region[1] * scale_y)
        x1 = int(region[2] * scale_x)
        y1 = int(region[3] * scale_y)
        cv2.rectangle(img, (x0, y0), (x1, y1), (255, 255, 255), -1)

    return img, scale_x, scale_y


def detect_graphical_content(text_stripped_img, page_rect, scale_x, scale_y, min_size_pt=10):
    """从去除文字的图片中检测图形轮廓"""
    gray = cv2.cvtColor(text_stripped_img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((5, 5), np.uint8)
    dilation = cv2.dilate(thresh, kernel, iterations=1)
    contours, _ = cv2.findContours(dilation, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_size_px = min_size_pt / scale_x
    potential_boxes = []

    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w > min_size_px and h > min_size_px:
            pdf_bbox = [
                x / scale_x,
                y / scale_y,
                (x + w) / scale_x,
                (y + h) / scale_y
            ]
            potential_boxes.append(pdf_bbox)

    return potential_boxes


def associate_figures_with_captions(graphical_boxes, captions, page_rect):
    """
    基于标题位置关联图形框

    关键：
    - 上边界：OpenCV检测的最小y值（确保图形顶部完整）
    - 下边界：标题顶部位置（图表和标题之间自然有间隔）
    """
    if not captions:
        return []

    results = []

    for i, caption in enumerate(captions):
        caption_y_top = caption['bbox'][1]

        if i == 0:
            search_top = 0
        else:
            prev_caption = captions[i-1]
            search_top = prev_caption['bbox'][3]

        search_bottom = caption_y_top

        figures_in_region = []
        for gbox in graphical_boxes:
            box_center_y = (gbox[1] + gbox[3]) / 2
            if search_top <= box_center_y <= search_bottom:
                figures_in_region.append(gbox)

        if figures_in_region:
            x0_list = [box[0] for box in figures_in_region]
            y0_list = [box[1] for box in figures_in_region]
            x1_list = [box[2] for box in figures_in_region]

            merged_bbox = [
                min(x0_list),
                min(y0_list),
                max(x1_list),
                caption_y_top  # 下边界直接用标题顶部
            ]

            results.append({
                'caption': caption,
                'figure_bbox': merged_bbox,
                'subfigures': figures_in_region
            })

    return results


def extract_figure_number(caption_text):
    """
    从caption文本中提取图号

    支持格式：
    - "图1 | xxx" -> 1
    - "图2. xxx" -> 2
    - "Fig. 3" -> 3
    - "Figure 4" -> 4

    Returns:
        int: 图号，如果提取失败返回None
    """
    import re

    # 尝试匹配中文格式：图N
    match = re.search(r'图\s*(\d+)', caption_text)
    if match:
        return int(match.group(1))

    # 尝试匹配英文格式：Fig. N 或 Figure N
    match = re.search(r'(?:Fig|Figure)\.?\s*(\d+)', caption_text, re.IGNORECASE)
    if match:
        return int(match.group(1))

    return None


def extract_first_page(pdf_path, output_dir, dpi=300):
    """
    提取PDF第一页作为完整图片

    Args:
        pdf_path: PDF文件路径
        output_dir: 图片输出目录
        dpi: 输出图片分辨率

    Returns:
        第一页图片信息字典
    """
    doc = fitz.open(pdf_path)
    if len(doc) == 0:
        doc.close()
        return None

    page = doc[0]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)

    # 转换为 OpenCV 格式
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)

    # 保存第一页
    output_filename = "page_1.png"
    output_path = os.path.join(output_dir, output_filename)
    cv2.imwrite(output_path, img)

    # 读取并转换为 base64
    import base64
    with open(output_path, 'rb') as img_file:
        img_data = img_file.read()
        base64_data = base64.b64encode(img_data).decode('utf-8')

    doc.close()

    print(f"[INFO] 已提取第一页: {output_filename}, base64: {len(base64_data)} chars", file=sys.stderr)

    return {
        'page': 1,
        'type': 'first_page',
        'path': output_path,
        'base64_data': base64_data,
        'filename': output_filename,
        'mime_type': 'image/png'
    }


def extract_images(pdf_path, output_dir, dpi=300):
    """
    从PDF提取图表（使用混合策略）+ 第一页完整截图

    Args:
        pdf_path: PDF文件路径
        output_dir: 图片输出目录
        dpi: 输出图片分辨率

    Returns:
        提取结果字典，包含 figures 和 first_page
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")

    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    all_results = []

    # 提取第一页
    first_page_info = extract_first_page(pdf_path, output_dir, dpi)

    print(f"[INFO] PDF共有 {len(doc)} 页", file=sys.stderr)

    for page_num in range(len(doc)):
        page = doc[page_num]
        print(f"[INFO] 处理第 {page_num + 1} 页...", file=sys.stderr)

        # 1. 检测标题
        captions = detect_figure_captions(page)
        print(f"  检测到 {len(captions)} 个图表标题", file=sys.stderr)

        if not captions:
            continue

        # 2. 生成无文字图片
        text_stripped_img, scale_x, scale_y = generate_text_stripped_image(page, dpi)

        # 3. 检测图形内容
        page_rect = page.rect
        graphical_boxes = detect_graphical_content(
            text_stripped_img, page_rect, scale_x, scale_y, min_size_pt=10
        )
        print(f"  检测到 {len(graphical_boxes)} 个图形框", file=sys.stderr)

        if not graphical_boxes:
            continue

        # 4. 关联图形与标题
        figure_caption_pairs = associate_figures_with_captions(
            graphical_boxes, captions, page_rect
        )
        print(f"  成功关联 {len(figure_caption_pairs)} 个图表", file=sys.stderr)

        # 5. 提取并保存
        mat = fitz.Matrix(dpi / 72, dpi / 72)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        full_img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
            pix.height, pix.width, 3
        )
        full_img = cv2.cvtColor(full_img, cv2.COLOR_RGB2BGR)

        for idx, pair in enumerate(figure_caption_pairs):
            figure_bbox = pair['figure_bbox']
            caption_text = pair['caption']['text']

            # 从caption中提取真实图号
            fig_num = extract_figure_number(caption_text)
            if fig_num is None:
                # 如果无法提取图号，使用页内索引作为后备
                fig_num = idx + 1
                print(f"  警告: 无法从caption提取图号，使用索引 {fig_num}: {caption_text}", file=sys.stderr)

            x0_px = int(figure_bbox[0] * scale_x)
            y0_px = int(figure_bbox[1] * scale_y)
            x1_px = int(figure_bbox[2] * scale_x)
            y1_px = int(figure_bbox[3] * scale_y)

            x0_px = max(0, x0_px)
            y0_px = max(0, y0_px)
            x1_px = min(full_img.shape[1], x1_px)
            y1_px = min(full_img.shape[0], y1_px)

            cropped = full_img[y0_px:y1_px, x0_px:x1_px]

            # 使用真实图号命名文件
            output_filename = f"fig_{fig_num}.png"
            output_path = os.path.join(output_dir, output_filename)
            cv2.imwrite(output_path, cropped)

            # 读取图片并转换为 base64
            import base64
            with open(output_path, 'rb') as img_file:
                img_data = img_file.read()
                base64_data = base64.b64encode(img_data).decode('utf-8')

            print(f"  保存: {output_filename} (图{fig_num}), base64: {len(base64_data)} chars", file=sys.stderr)

            all_results.append({
                'page': page_num + 1,
                'figure_index': fig_num,  # 使用真实图号
                'caption': caption_text,
                'bbox': figure_bbox,
                'path': output_path,
                'base64_data': base64_data,  # 添加 base64 数据
                'filename': output_filename,
                'mime_type': 'image/png'
            })

    doc.close()
    print(f"[INFO] 完成！共提取 {len(all_results)} 个图表", file=sys.stderr)

    # 按图号排序，确保返回的顺序是：图1, 图2, 图3, ...
    # 这样imagePaths[0]对应图1，imagePaths[1]对应图2
    all_results.sort(key=lambda x: x['figure_index'])
    fig_nums = [f"图{r['figure_index']}" for r in all_results]
    print(f"[INFO] 已按图号排序: {fig_nums}", file=sys.stderr)

    return {
        'figures': all_results,
        'first_page': first_page_info
    }


class ImageExtractHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/extract':
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Not found"}).encode())
            return

        # 读取请求体，尝试多种编码方式
        content_length = int(self.headers['Content-Length'])
        body_bytes = self.rfile.read(content_length)

        # 尝试UTF-8解码，如果失败则尝试其他编码
        try:
            body = body_bytes.decode('utf-8')
        except UnicodeDecodeError:
            try:
                body = body_bytes.decode('gbk')
            except UnicodeDecodeError:
                body = body_bytes.decode('latin-1')

        try:
            data = json.loads(body)
            pdf_path = data.get('pdfPath')
            output_dir = data.get('outputDir', './temp')

            if not pdf_path:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Missing pdfPath"}).encode())
                return

            print(f"[{self.log_date_time_string()}] 收到提取请求: {pdf_path}", file=sys.stderr)

            # 提取图表和第一页
            result = extract_images(pdf_path, output_dir)

            # 返回结果
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "success": True,
                "figures": result['figures'],
                "first_page": result['first_page'],
                "count": len(result['figures'])
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

            print(f"[{self.log_date_time_string()}] 提取成功，返回 {len(result['figures'])} 个图表 + 第一页", file=sys.stderr)

        except Exception as e:
            print(f"[{self.log_date_time_string()}] 提取失败: {e}", file=sys.stderr)
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}, ensure_ascii=False).encode('utf-8'))

    def log_message(self, format, *args):
        # 自定义日志格式
        sys.stderr.write(f"[{self.log_date_time_string()}] {format % args}\n")


def main():
    port = 3457
    server = HTTPServer(('0.0.0.0', port), ImageExtractHandler)
    print(f"[INFO] Image extraction service started")
    print(f"[INFO] Listening on port: {port}")
    print(f"[INFO] API endpoint: POST http://localhost:{port}/extract")
    print(f"[INFO] Request format: {{ \"pdfPath\": \"...\", \"outputDir\": \"...\" }}")
    print(f"[INFO] Response format: {{ \"success\": true, \"imagePaths\": [...], \"count\": N }}")
    print('')
    print('[INFO] Press Ctrl+C to stop')

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n[INFO] Shutting down...')
        server.shutdown()
        print('[INFO] Service stopped')


if __name__ == "__main__":
    main()
