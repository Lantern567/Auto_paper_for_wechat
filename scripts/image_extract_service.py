#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF图片提取HTTP服务
"""

import sys
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF not installed. Please run: pip install PyMuPDF", file=sys.stderr)
    sys.exit(1)


def extract_images(pdf_path, output_dir):
    """
    从PDF提取所有图片

    Args:
        pdf_path: PDF文件路径
        output_dir: 图片输出目录

    Returns:
        图片文件路径列表
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF文件不存在: {pdf_path}")

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)

    # 打开PDF
    doc = fitz.open(pdf_path)
    image_paths = []
    image_counter = 1

    print(f"[INFO] PDF has {len(doc)} pages", file=sys.stderr)

    # 遍历所有页面
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        print(f"[INFO] Page {page_num + 1} has {len(images)} images", file=sys.stderr)

        # 提取每张图片
        for img_index, img in enumerate(images):
            xref = img[0]  # 图片引用编号

            try:
                # 提取图片
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]  # 图片格式 (png, jpeg等)

                # 生成文件名
                image_filename = f"image_{image_counter}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)

                # 保存图片
                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                image_paths.append(image_path)
                print(f"[OK] Extracted image {image_counter}: {image_filename} ({len(image_bytes)} bytes)", file=sys.stderr)
                image_counter += 1

            except Exception as e:
                print(f"[ERROR] Failed to extract image (xref={xref}): {e}", file=sys.stderr)
                continue

    doc.close()
    print(f"\n[INFO] Total images extracted: {len(image_paths)}", file=sys.stderr)

    return image_paths


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

            # 提取图片
            image_paths = extract_images(pdf_path, output_dir)

            # 返回结果
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {
                "success": True,
                "imagePaths": image_paths,
                "count": len(image_paths)
            }
            self.wfile.write(json.dumps(response, ensure_ascii=False).encode('utf-8'))

            print(f"[{self.log_date_time_string()}] 提取成功，返回 {len(image_paths)} 张图片", file=sys.stderr)

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
