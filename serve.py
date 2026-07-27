import tkinter as tk
from tkinter import scrolledtext
import webbrowser
import threading
import socket
import sys
import os
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ── 配色 ──────────────────────────────────────────────
BG        = "#1e1e2e"
BG_PANEL  = "#181825"
BG_LOG    = "#11111b"
FG        = "#cdd6f4"
FG_DIM    = "#6c7086"
ACCENT    = "#89b4fa"
GREEN     = "#a6e3a1"
RED       = "#f38ba8"
YELLOW    = "#f9e2af"
BORDER    = "#313244"

# ── 自定义请求处理器（绕过 mimetypes 依赖问题） ────
class SafeHandler(SimpleHTTPRequestHandler):
    """不依赖 mimetypes 数据库的简易文件服务器"""
    EXTENSION_MAP = {
        ".html": "text/html",
        ".htm": "text/html",
        ".css": "text/css",
        ".js": "application/javascript",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml",
        ".ico": "image/x-icon",
        ".wasm": "application/wasm",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".txt": "text/plain",
        ".xml": "application/xml",
        ".pdf": "application/pdf",
        ".zip": "application/zip",
        ".otf": "font/otf",
        ".ttf": "font/ttf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return self.EXTENSION_MAP.get(ext, "application/octet-stream")

    def end_headers(self):
        # 强制内联展示，避免下载器拦截
        self.send_header("Content-Disposition", "inline")
        super().end_headers()

    def log_message(self, format, *args):
        pass


class GameLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("RwR 启动器")
        self.root.geometry("560x520")
        self.root.resizable(False, False)
        self.root.configure(bg=BG)

        self.httpd = None
        self.port = 8000

        self._build_ui()
        self.root.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── UI 构建 ────────────────────────────────────────
    def _build_ui(self):
        header = tk.Frame(self.root, bg=BG_PANEL, height=72)
        header.pack(fill=tk.X)
        header.pack_propagate(False)

        tk.Label(
            header, text="RwR", font=("Helvetica", 22, "bold"),
            bg=BG_PANEL, fg=ACCENT
        ).pack(side=tk.LEFT, padx=(24, 6), pady=16)
        tk.Label(
            header, text="本地游戏启动器", font=("Helvetica", 12),
            bg=BG_PANEL, fg=FG_DIM
        ).pack(side=tk.LEFT, pady=(24, 0))

        tk.Frame(self.root, bg=BORDER, height=1).pack(fill=tk.X)

        status_frame = tk.Frame(self.root, bg=BG)
        status_frame.pack(fill=tk.X, padx=24, pady=(16, 0))

        self.status_dot = tk.Canvas(
            status_frame, width=12, height=12,
            bg=BG, highlightthickness=0
        )
        self.status_dot.pack(side=tk.LEFT, pady=2)
        self._dot_id = self.status_dot.create_oval(2, 2, 10, 10, fill=FG_DIM, outline="")

        self.status_label = tk.Label(
            status_frame, text="就绪", font=("Helvetica", 12),
            bg=BG, fg=FG
        )
        self.status_label.pack(side=tk.LEFT, padx=(8, 0))

        self.start_btn = tk.Button(
            self.root,
            text="启动游戏",
            font=("Helvetica", 13, "bold"),
            command=self._on_button,
            bg=ACCENT, fg=BG_PANEL,
            activebackground="#74a8fc", activeforeground=BG_PANEL,
            relief=tk.FLAT, cursor="hand2",
            width=24, height=1,
            bd=0, padx=16, pady=10,
        )
        self.start_btn.pack(pady=(20, 12))

        tk.Label(
            self.root, text="输出日志", font=("Helvetica", 10),
            bg=BG, fg=FG_DIM, anchor="w"
        ).pack(fill=tk.X, padx=24)

        log_frame = tk.Frame(self.root, bg=BORDER, padx=1, pady=1)
        log_frame.pack(padx=24, pady=(4, 20), fill=tk.BOTH, expand=True)

        self.log_area = scrolledtext.ScrolledText(
            log_frame,
            font=("Menlo", 10),
            bg=BG_LOG, fg=FG,
            insertbackground=FG,
            relief=tk.FLAT,
            state="disabled",
            wrap=tk.WORD,
            padx=10, pady=8,
        )
        self.log_area.pack(fill=tk.BOTH, expand=True)

        self.log_area.tag_configure("info", foreground=FG)
        self.log_area.tag_configure("ok", foreground=GREEN)
        self.log_area.tag_configure("warn", foreground=YELLOW)
        self.log_area.tag_configure("err", foreground=RED)
        self.log_area.tag_configure("dim", foreground=FG_DIM)

        tk.Frame(self.root, bg=BORDER, height=1).pack(fill=tk.X, side=tk.BOTTOM)
        self.footer_label = tk.Label(
            self.root, text="端口: --", font=("Helvetica", 9),
            bg=BG_PANEL, fg=FG_DIM, anchor="e"
        )
        self.footer_label.pack(fill=tk.X, side=tk.BOTTOM, padx=24, pady=8)

    # ── 打开浏览器（新窗口，避免跨域报错） ─────────
    @staticmethod
    def open_browser(url):
        try:
            webbrowser.open(url, new=1, autoraise=True)
        except Exception:
            if sys.platform == "win32":
                os.startfile(url)
            elif sys.platform == "darwin":
                import subprocess
                subprocess.run(["open", url])
            else:
                import subprocess
                subprocess.run(["xdg-open", url])

    # ── 状态与日志 ───────────────────────────────────
    def _set_status(self, text, color):
        self.status_label.config(text=text, fg=color)
        self.status_dot.itemconfig(self._dot_id, fill=color)

    def _write_log(self, message, level="info"):
        self.log_area.config(state="normal")
        self.log_area.insert(tk.END, message + "\n", level)
        self.log_area.see(tk.END)
        self.log_area.config(state="disabled")

    def log(self, message, level="info"):
        self.root.after(0, self._write_log, message, level)

    # ── 端口 ───────────────────────────────────────────
    def find_free_port(self, start_port=8000):
        port = start_port
        while True:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("localhost", port))
                    return port
                except OSError:
                    port += 1

    # ── 按钮逻辑 ──────────────────────────────────────
    def _on_button(self):
        if self.httpd is not None:
            self.stop_game()
        else:
            self.start_game()

    def start_game(self):
        game_dir = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
        if not (game_dir / "index.html").exists():
            self.log("错误: 未找到 index.html", "err")
            self._set_status("缺少 index.html", RED)
            return

        self.port = self.find_free_port(8000)
        url = f"http://localhost:{self.port}"

        self.start_btn.config(state="disabled", text="启动中…", bg=FG_DIM)
        self._set_status("正在启动服务器…", YELLOW)
        self.log(f"游戏目录: {game_dir}", "dim")
        self.log(f"端口: {self.port}", "dim")
        self.footer_label.config(text=f"端口: {self.port}")

        def run_server():
            try:
                os.chdir(game_dir)
                self.httpd = HTTPServer(("localhost", self.port), SafeHandler)
                self.root.after(0, lambda: self.open_browser(url))
                self.root.after(0, lambda: self.log(f"浏览器已打开: {url}", "ok"))
                self.root.after(0, lambda: self._set_status(f"运行中  {url}", GREEN))
                self.root.after(0, lambda: self.start_btn.config(state="normal", text="停止服务器", bg=RED))
                self.httpd.serve_forever()
            except Exception as e:
                self.root.after(0, lambda: self.log(f"错误: {e}", "err"))
                self.root.after(0, lambda: self._set_status("启动失败", RED))
                self.root.after(0, lambda: self.start_btn.config(state="normal", text="启动游戏", bg=ACCENT))
                if self.httpd:
                    self.httpd.server_close()
                    self.httpd = None
            finally:
                if self.httpd:
                    self.httpd.server_close()
                    self.httpd = None
                self.root.after(0, lambda: self._set_status("已停止", FG_DIM))
                self.root.after(0, lambda: self.start_btn.config(state="normal", text="启动游戏", bg=ACCENT))
                self.root.after(0, lambda: self.footer_label.config(text="端口: --"))
                self.root.after(0, lambda: self.log("服务器已停止", "ok"))

        threading.Thread(target=run_server, daemon=True).start()

    def stop_game(self):
        if self.httpd:
            self.log("正在停止服务器…", "warn")
            threading.Thread(target=self.httpd.shutdown, daemon=True).start()
            self.httpd = None

    def _on_close(self):
        self.stop_game()
        self.root.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    app = GameLauncher(root)
    root.mainloop()