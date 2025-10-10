#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从PDF文件中提取所有图片
使用PyMuPDF (fitz)库
"""

import sys
import json
import os

try:
    import fitz  # PyMuPDF
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed. Please run: pip install PyMuPDF"}), file=sys.stderr)
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

    print(f"PDF共有 {len(doc)} 页", file=sys.stderr)

    # 遍历所有页面
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        print(f"第 {page_num + 1} 页找到 {len(images)} 张图片", file=sys.stderr)

        # 提取每张图片
        for img_index, img in enumerate(images):
            xref = img[0]  # 图片引用编号

            try:
                # 提取图片
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]  # 图片格式 (png, jpeg等)

                # 生成文件名
                image_filename = f"图{image_counter}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)

                # 保存图片
                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                image_paths.append(image_path)
                print(f"✓ 提取图片 {image_counter}: {image_filename} ({len(image_bytes)} bytes)", file=sys.stderr)
                image_counter += 1

            except Exception as e:
                print(f"✗ 提取图片失败 (xref={xref}): {e}", file=sys.stderr)
                continue

    doc.close()
    print(f"\n总共成功提取 {len(image_paths)} 张图片", file=sys.stderr)

    return image_paths


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python extract_pdf_images.py <pdf_path> [output_dir]", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./temp"

    try:
        paths = extract_images(pdf_path, output_dir)
        # 输出JSON格式的图片路径列表到stdout
        print(json.dumps(paths, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
