#!/usr/bin/env python3
"""
DORA 설치 프로그램
더블클릭으로 실행 가능한 GUI 설치 앱.
Extension ID를 입력하면 Native Messaging 호스트를 자동으로 등록한다.
"""

import os
import sys
import json
import stat
import platform
import subprocess
import traceback

# tkinter 로드 실패 시 에러 로그를 Desktop에 남기고 종료
try:
    import tkinter as tk
    from tkinter import font as tkfont
except Exception:
    _log = os.path.expanduser('~/Desktop/DORA_error.log')
    with open(_log, 'w', encoding='utf-8') as _f:
        _f.write('tkinter 로드 실패:\n')
        _f.write(traceback.format_exc())
    sys.exit(1)


# ── 색상 & 스타일 상수 ─────────────────────────────────────────
C_BG       = '#f8f9fa'
C_SURFACE  = '#ffffff'
C_PRIMARY  = '#4f46e5'
C_SUCCESS  = '#10b981'
C_ERROR    = '#ef4444'
C_TEXT     = '#1e293b'
C_MUTED    = '#64748b'
C_BORDER   = '#e2e8f0'


# ── 설치 로직 ──────────────────────────────────────────────────
def get_bundled_host_path() -> str:
    """번들 안의 native host 파일 위치를 반환한다.
    - macOS: dora_host.py (shebang으로 python3 실행)
    - Windows: dora_host.exe (Python 불필요한 독립 실행 파일)
    PyInstaller는 --add-data 파일을 sys._MEIPASS 디렉터리에 풀어놓는다."""
    if getattr(sys, 'frozen', False):
        base = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    else:
        base = os.path.dirname(os.path.abspath(__file__))

    host_file = 'dora_host.exe' if platform.system() == 'Windows' else 'dora_host.py'
    return os.path.join(base, host_file)


EXTENSION_ID = "fmmefolhigiojpcaejdchkmbdlljmngf"


def build_manifest(host_path: str) -> dict:
    return {
        "name": "com.abc.dora",
        "description": "DORA - 파일 이동 헬퍼",
        "path": host_path,
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{EXTENSION_ID}/"]
    }


def install_mac() -> str:
    import shutil

    src = get_bundled_host_path()
    if not os.path.isfile(src):
        raise FileNotFoundError(f"번들에서 dora_host.py를 찾을 수 없습니다:\n{src}")

    # 앱을 삭제해도 유지되도록 영구 위치에 복사
    dora_dir = os.path.expanduser('~/.dora')
    os.makedirs(dora_dir, exist_ok=True)
    host_path = os.path.join(dora_dir, 'dora_host.py')
    shutil.copy2(src, host_path)

    # 실행 권한 부여
    os.chmod(host_path, os.stat(host_path).st_mode | stat.S_IXUSR | stat.S_IXGRP)

    nm_dir = os.path.expanduser(
        '~/Library/Application Support/Google/Chrome/NativeMessagingHosts'
    )
    os.makedirs(nm_dir, exist_ok=True)

    manifest_path = os.path.join(nm_dir, 'com.abc.dora.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(build_manifest(host_path), f, indent=2, ensure_ascii=False)

    return manifest_path


def install_windows() -> str:
    import shutil
    import winreg  # Windows 전용

    src = get_bundled_host_path()
    if not os.path.isfile(src):
        raise FileNotFoundError(f"번들에서 dora_host.py를 찾을 수 없습니다:\n{src}")

    # 영구 위치에 복사 (%APPDATA%\DORA\)
    dora_dir = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'DORA')
    os.makedirs(dora_dir, exist_ok=True)
    host_path = os.path.join(dora_dir, 'dora_host.exe')
    shutil.copy2(src, host_path)

    # 매니페스트 파일 저장
    manifest_path = os.path.join(dora_dir, 'com.abc.dora.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(build_manifest(host_path), f, indent=2, ensure_ascii=False)

    # 레지스트리 등록
    reg_key = r'Software\Google\Chrome\NativeMessagingHosts\com.abc.dora'
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_key) as key:
        winreg.SetValueEx(key, '', 0, winreg.REG_SZ, manifest_path)

    return manifest_path


def run_install() -> str:
    os_name = platform.system()
    if os_name == 'Darwin':
        return install_mac()
    elif os_name == 'Windows':
        return install_windows()
    else:
        raise RuntimeError(f"지원하지 않는 OS입니다: {os_name}")


# ── GUI ────────────────────────────────────────────────────────
class DoraInstaller(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('DORA 설치')
        self.configure(bg=C_BG)
        self.resizable(False, False)
        self._build_ui()
        self._center()
        # macOS .app 번들에서 실행 시 창이 뒤에 숨는 문제 방지
        self.lift()
        self.focus_force()
        self.attributes('-topmost', True)
        self.after(300, lambda: self.attributes('-topmost', False))

    def _center(self):
        self.update_idletasks()
        w, h = self.winfo_width(), self.winfo_height()
        sw, sh = self.winfo_screenwidth(), self.winfo_screenheight()
        self.geometry(f'{w}x{h}+{(sw-w)//2}+{(sh-h)//2}')

    def _build_ui(self):
        # ── 헤더 ──
        header = tk.Frame(self, bg=C_PRIMARY, padx=24, pady=18)
        header.pack(fill='x')

        tk.Label(header, text='DORA', bg=C_PRIMARY, fg='white',
                 font=('', 20, 'bold')).pack(anchor='w')
        tk.Label(header, text='Document Organizer & Retrieval Assistant',
                 bg=C_PRIMARY, fg='#c7d2fe', font=('', 10)).pack(anchor='w')

        # ── 본문 ──
        body = tk.Frame(self, bg=C_BG, padx=24, pady=20)
        body.pack(fill='both', expand=True)

        # Step 1
        self._step_label(body, '1', 'Chrome에 확장 프로그램을 먼저 로드해주세요.')
        desc1 = tk.Label(
            body,
            text='chrome://extensions 에서 개발자 모드를 켜고\n'
                 '"압축해제된 확장 프로그램 로드"로 DORA 폴더를 선택하세요.',
            bg=C_BG, fg=C_MUTED, font=('', 10), justify='left'
        )
        desc1.pack(anchor='w', padx=(28, 0), pady=(2, 0))

        open_btn = tk.Button(
            body, text='chrome://extensions 열기',
            bg=C_SURFACE, fg=C_PRIMARY, relief='flat',
            font=('', 10), cursor='hand2', padx=8, pady=4,
            highlightbackground=C_BORDER, highlightthickness=1,
            command=self._open_extensions
        )
        open_btn.pack(anchor='w', padx=(28, 0), pady=(8, 16))

        # Step 2
        self._step_label(body, '2', '설치 시작을 눌러 Native Host를 등록하세요.')
        desc2 = tk.Label(
            body,
            text='확장 프로그램 로드 후 아래 버튼을 누르면\n'
                 'Native Messaging 호스트가 자동으로 등록됩니다.',
            bg=C_BG, fg=C_MUTED, font=('', 10), justify='left'
        )
        desc2.pack(anchor='w', padx=(28, 0), pady=(2, 16))

        # 설치 버튼
        install_btn = tk.Button(
            body, text='설치 시작',
            bg=C_PRIMARY, fg='white', relief='flat',
            font=('', 12, 'bold'), cursor='hand2',
            padx=0, pady=10, width=32,
            activebackground='#4338ca', activeforeground='white',
            command=self._install
        )
        install_btn.pack(pady=(0, 0))

        # 결과 메시지
        self.result_var = tk.StringVar()
        self.result_label = tk.Label(
            body, textvariable=self.result_var,
            bg=C_BG, font=('', 10), justify='left', wraplength=380
        )
        self.result_label.pack(pady=(12, 0), anchor='w')

    def _step_label(self, parent, number, text):
        frame = tk.Frame(parent, bg=C_BG)
        frame.pack(anchor='w', pady=(0, 4))

        badge = tk.Label(frame, text=number, bg=C_PRIMARY, fg='white',
                         font=('', 10, 'bold'), width=2, pady=1)
        badge.pack(side='left')

        tk.Label(frame, text=f'  {text}', bg=C_BG, fg=C_TEXT,
                 font=('', 11, 'bold')).pack(side='left')

    def _open_extensions(self):
        url = 'chrome://extensions'
        os_name = platform.system()
        try:
            if os_name == 'Darwin':
                subprocess.run(['open', '-a', 'Google Chrome', url])
            elif os_name == 'Windows':
                subprocess.run(['start', 'chrome', url], shell=True)
            else:
                subprocess.run(['xdg-open', url])
        except Exception as e:
            self._show_result(f'Chrome을 열 수 없습니다: {e}', error=True)

    def _install(self):
        try:
            manifest_path = run_install()
            self._show_result(
                f'✅ 설치 완료!\n\nChrome을 완전히 종료한 뒤 다시 실행하면\nDORA가 정상 동작합니다.\n\n'
                f'매니페스트 경로:\n{manifest_path}',
                error=False
            )
        except Exception as e:
            self._show_result(f'❌ 설치 실패\n\n{e}', error=True)

    def _show_result(self, msg, error=False):
        self.result_var.set(msg)
        self.result_label.configure(fg=C_ERROR if error else C_SUCCESS)


def main():
    try:
        app = DoraInstaller()
        app.mainloop()
    except Exception:
        import traceback
        log_path = os.path.expanduser('~/Desktop/DORA_error.log')
        with open(log_path, 'w', encoding='utf-8') as f:
            f.write(traceback.format_exc())


if __name__ == '__main__':
    main()
