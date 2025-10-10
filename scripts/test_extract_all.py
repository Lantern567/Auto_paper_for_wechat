#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""改进的图片提取 - 提取所有图片块"""
import sys
import os

pdf_path = r"E:\code\n8n_workflow\air_zero_emission.pdf"
output_dir = r"E:\code\n8n_workflow\temp"

try:
    import fitz

    doc = fitz.open(pdf_path)
    print(f"PDF pages: {len(doc)}")

    os.makedirs(output_dir, exist_ok=True)

    image_counter = 1
    extracted_xrefs = set()

    for page_num in range(len(doc)):
        page = doc[page_num]

        # 方法1: 使用get_images获取图片
        images = page.get_images(full=True)
        print(f"\nPage {page_num + 1}: {len(images)} images via get_images()")

        for img_index, img in enumerate(images):
            xref = img[0]

            if xref in extracted_xrefs:
                print(f"  Image xref={xref} already extracted (duplicate)")
                continue

            extracted_xrefs.add(xref)

            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                image_filename = f"image_{image_counter}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)

                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                print(f"  [{image_counter}] Saved: {image_filename} ({len(image_bytes)} bytes, xref={xref})")
                image_counter += 1

            except Exception as e:
                print(f"  ERROR extracting xref={xref}: {e}")

        # 方法2: 使用get_text("dict")获取图片块
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])
        image_blocks = [b for b in blocks if b.get("type") == 1]

        if len(image_blocks) > len(images):
            print(f"  Found {len(image_blocks)} image blocks (more than get_images)")
            print(f"  Attempting to extract additional images via rendering...")

            # 对于额外的图片块，尝试通过bbox渲染
            for idx, block in enumerate(image_blocks[len(images):], start=len(images)):
                try:
                    bbox = fitz.Rect(block["bbox"])
                    # 渲染这个区域为图片
                    pix = page.get_pixmap(clip=bbox, matrix=fitz.Matrix(2, 2))  # 2x scale for better quality

                    image_filename = f"image_{image_counter}.png"
                    image_path = os.path.join(output_dir, image_filename)

                    pix.save(image_path)

                    print(f"  [{image_counter}] Rendered: {image_filename} (bbox={list(bbox)})")
                    image_counter += 1

                except Exception as e:
                    print(f"  ERROR rendering block {idx}: {e}")

    doc.close()
    print(f"\n{'='*60}")
    print(f"Total images extracted: {image_counter - 1}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
