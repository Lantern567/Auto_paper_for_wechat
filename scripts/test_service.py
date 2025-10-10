#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试图片提取服务"""
import sys
import os

print("Python executable:", sys.executable)
print("Python version:", sys.version)
print("Current directory:", os.getcwd())

# 测试文件路径
pdf_path = r"E:\code\n8n_workflow\files\航空净零排放的途径.pdf"
print(f"\nPDF文件路径: {pdf_path}")
print(f"文件是否存在: {os.path.exists(pdf_path)}")

# 测试PyMuPDF
try:
    import fitz
    print("\n✓ PyMuPDF (fitz) 已安装")
    print(f"PyMuPDF version: {fitz.__version__}")

    # 尝试打开PDF
    doc = fitz.open(pdf_path)
    print(f"✓ 成功打开PDF，共 {len(doc)} 页")
    doc.close()
except ImportError as e:
    print(f"\n✗ PyMuPDF 未安装: {e}")
except Exception as e:
    print(f"\n✗ 打开PDF失败: {e}")

print("\n测试完成")
