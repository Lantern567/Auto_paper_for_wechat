#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查PDF中所有可能的图形对象"""
import sys
import os

pdf_path = r"E:\code\n8n_workflow\air_zero_emission.pdf"

try:
    import fitz

    doc = fitz.open(pdf_path)
    print(f"PDF pages: {len(doc)}\n")

    for page_num in range(len(doc)):
        page = doc[page_num]

        # 获取位图图片
        images = page.get_images(full=True)

        # 获取所有图形对象（包括矢量图）
        drawings = page.get_drawings()

        # 获取页面上的所有对象
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])

        # 统计图片块
        image_blocks = [b for b in blocks if b.get("type") == 1]

        if images or drawings or image_blocks:
            print(f"Page {page_num + 1}:")
            print(f"  Bitmap images: {len(images)}")
            print(f"  Vector drawings: {len(drawings)}")
            print(f"  Image blocks: {len(image_blocks)}")

            # 显示每个图片块的信息
            for idx, block in enumerate(image_blocks):
                bbox = block.get("bbox", [])
                width = block.get("width", 0)
                height = block.get("height", 0)
                print(f"    Block {idx+1}: {width}x{height} at {bbox}")

            print()

    doc.close()

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
