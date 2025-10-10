#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试图片提取"""
import sys
import os

# 使用新的PDF路径
pdf_path = r"E:\code\n8n_workflow\air_zero_emission.pdf"
output_dir = r"E:\code\n8n_workflow\temp"

print(f"PDF path: {pdf_path}")
print(f"File exists: {os.path.exists(pdf_path)}")
print(f"Output dir: {output_dir}")

if not os.path.exists(pdf_path):
    print("ERROR: PDF file not found!")
    sys.exit(1)

# 测试PyMuPDF
try:
    import fitz
    print(f"PyMuPDF version: {fitz.__version__}")

    # 打开PDF
    doc = fitz.open(pdf_path)
    print(f"PDF pages: {len(doc)}")

    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)

    # 提取图片
    image_counter = 1
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)
        print(f"Page {page_num + 1}: {len(images)} images")

        for img_index, img in enumerate(images):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]

                image_filename = f"image_{image_counter}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)

                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                print(f"  Saved: {image_filename} ({len(image_bytes)} bytes)")
                image_counter += 1
            except Exception as e:
                print(f"  Error extracting image: {e}")

    doc.close()
    print(f"\nTotal images extracted: {image_counter - 1}")

except ImportError as e:
    print(f"PyMuPDF not installed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
