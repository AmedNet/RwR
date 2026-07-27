import tkinter as tk
from tkinter import scrolledtext
import subprocess
import webbrowser
import threading
import socket
import os
import sys
from pathlib import Path

# ── 配色 ──────────────────────────────────────────────
BG        = "#1e1e2e"   # 主背景
BG_PANEL  = "#181825"   # 面板背景
BG_LOG    = "#11111b"   # 日志区背景
FG        = "#cdd6f4"   # 主文字
FG_DIM    = "#6c7086"   # 次要文字
ACCENT    = "#89b4fa"   # 强调色（蓝）
GREEN     = "#a6e3a1"   # 运行中
RED       = "#f38ba8"   # 错误
YELLOW    = "#f9e2af"   # 警告
BORDER    = "#313244"   # 边框


class GameLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("RwR 启动器")
        self.root.geometry("560x520")
        self.root.resizable(False, False)
        self.root.configure(bg=BG)

        self.server_process = None
        self.port = 8000

        self._build_ui()

    # ── UI 构建 ────────────────────────────────────────
    def _build_ui(self):
        # 顶部标题栏
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

        # 分隔线
        tk.Frame(self.root, bg=BORDER, height=1).pack(fill=tk.X)

        # 状态行：圆点 + 文字
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

        # 启动 / 停止按钮
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

        # 日志区标签
        tk.Label(
            self.root, text="输出日志", font=("Helvetica", 10),
            bg=BG, fg=FG_DIM, anchor="w"
        ).pack(fill=tk.X, padx=24)

        # 日志区
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

        # 日志颜色标签
        self.log_area.tag_configure("info", foreground=FG)
        self.log_area.tag_configure("ok", foreground=GREEN)
        self.log_area.tag_configure("warn", foreground=YELLOW)
        self.log_area.tag_configure("err", foreground=RED)
        self.log_area.tag_configure("dim", foreground=FG_DIM)

        # 底部信息
        tk.Frame(self.root, bg=BORDER, height=1).pack(fill=tk.X, side=tk.BOTTOM)
        self.footer_label = tk.Label(
            self.root, text="端口: --", font=("Helvetica", 9),
            bg=BG_PANEL, fg=FG_DIM, anchor="e"
        )
        self.footer_label.pack(fill=tk.X, side=tk.BOTTOM, padx=24, pady=8)

    # ── 状态 ───────────────────────────────────────────
    def _set_status(self, text, color):
        self.status_label.config(text=text, fg=color)
        self.status_dot.itemconfig(self._dot_id, fill=color)

    def log(self, message, level="info"):
        self.log_area.config(state="normal")
        self.log_area.insert(tk.END, message + "\n", level)
        self.log_area.see(tk.END)
        self.log_area.config(state="disabled")

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
        if self.server_process:
            self.stop_game()
        else:
            self.start_game()

    def start_game(self):
        game_dir = Path(__file__).parent
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
                self.server_process = subprocess.Popen(
                    [sys.executable, "-m", "http.server", str(self.port)],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )

                webbrowser.open(url)
                self._set_status(f"运行中  {url}", GREEN)
                self.log(f"浏览器已打开: {url}", "ok")
                self.start_btn.config(state="normal", text="停止服务器", bg=RED)

                while True:
                    output = self.server_process.stdout.readline()
                    if output:
                        self.log(f"[服务器] {output.strip()}", "dim")
                    if self.server_process.poll() is not None:
                        break

            except Exception as e:
                self.log(f"错误: {e}", "err")
                self._set_status("启动失败", RED)
                self.start_btn.config(state="normal", text="启动游戏", bg=ACCENT)
                self.server_process = None

        threading.Thread(target=run_server, daemon=True).start()

    def stop_game(self):
        if self.server_process:
            self.log("正在停止服务器…", "warn")
            self.server_process.terminate()
            self.server_process = None
            self._set_status("已停止", FG_DIM)
            self.start_btn.config(text="启动游戏", bg=ACCENT)
            self.footer_label.config(text="端口: --")
            self.log("服务器已停止", "ok")


if __name__ == "__main__":
    root = tk.Tk()
    app = GameLauncher(root)
    root.mainloop()
