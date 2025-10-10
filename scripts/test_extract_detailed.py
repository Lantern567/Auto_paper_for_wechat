#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""详细测试图片提取"""
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
    all_xrefs = set()  # 追踪所有xref，避免重复

    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        print(f"\nPage {page_num + 1}:")
        print(f"  Found {len(images)} image references")

        for img_index, img in enumerate(images):
            xref = img[0]
            print(f"  Image {img_index + 1}: xref={xref}", end="")

            if xref in all_xrefs:
                print(" (DUPLICATE - skipped)")
                continue

            all_xrefs.add(xref)

            try:
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                width = base_image.get("width", 0)
                height = base_image.get("height", 0)

                image_filename = f"image_{image_counter}.{image_ext}"
                image_path = os.path.join(output_dir, image_filename)

                with open(image_path, "wb") as f:
                    f.write(image_bytes)

                print(f" -> Saved as {image_filename} ({width}x{height}, {len(image_bytes)} bytes)")
                image_counter += 1

            except Exception as e:
                print(f" -> ERROR: {e}")

    doc.close()
    print(f"\n{'='*60}")
    print(f"Total unique images extracted: {image_counter - 1}")
    print(f"Total unique xrefs found: {len(all_xrefs)}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
