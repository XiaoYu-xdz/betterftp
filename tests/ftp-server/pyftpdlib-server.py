# -*- coding: utf-8 -*-
"""
BetterFTP 本机测试 FTP 服务器（可选，Python 版）。

用途：在没有 Node 环境的电脑上，用 Python 快速起一个 FTP 服务器做手工联调。
Node 自动化测试不依赖本文件（自动化测试用的是 tests/ftp-server/test-server.mjs）。

使用：
  1. pip install pyftpdlib
  2. python pyftpdlib-server.py
  3. 应用「设置 → 全局」把服务器地址改为 127.0.0.1，端口 2121

账号（与自动化测试一致）：
  zhang / 123456  读写
  li    / abcdef  读写
  ro    / read    只读
  drop  / write   只写（投递箱，可传不可看）
"""

import os
import sys

from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
FTPROOT = os.path.join(HERE, "ftproot-py")


def prepare():
    def put(rel, content):
        p = os.path.join(FTPROOT, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, "wb") as f:
            f.write(content if isinstance(content, bytes) else content.encode("utf-8"))

    os.makedirs(os.path.join(FTPROOT, "zhang"), exist_ok=True)
    os.makedirs(os.path.join(FTPROOT, "li"), exist_ok=True)
    os.makedirs(os.path.join(FTPROOT, "readonly"), exist_ok=True)
    os.makedirs(os.path.join(FTPROOT, "dropbox"), exist_ok=True)
    put("zhang/01-课件/第一章 绪论.pptx", "PPTX-CONTENT-" * 3000)
    put("zhang/说明 文档.txt", "说明内容")
    put("readonly/共享课件.pdf", "PDF-SHARED-CONTENT" * 2000)


def main():
    prepare()
    auth = DummyAuthorizer()
    auth.add_user("zhang", "123456", os.path.join(FTPROOT, "zhang"), perm="elradfmwMT")
    auth.add_user("li", "abcdef", os.path.join(FTPROOT, "li"), perm="elradfmwMT")
    auth.add_user("ro", "read", os.path.join(FTPROOT, "readonly"), perm="elr")   # 只读
    auth.add_user("drop", "write", os.path.join(FTPROOT, "dropbox"), perm="adfmwMT")  # 只写（无 l 列目录）

    handler = FTPHandler
    handler.authorizer = auth
    handler.passive_ports = range(60000, 60010)
    handler.banner = "BetterFTP test server (pyftpdlib)"

    server = FTPServer(("127.0.0.1", 2121), handler)
    print("测试 FTP 服务器已启动: ftp://127.0.0.1:2121")
    print("账号: zhang/123456(读写) li/abcdef(读写) ro/read(只读) drop/write(只写)")
    print("文件根目录:", FTPROOT)
    print("按 Ctrl+C 停止")
    server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
