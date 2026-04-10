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
def get_host_path() -> str:
    """dora_host.py의 절대 경로를 반환한다."""
    if getattr(sys, 'frozen', False):
        # PyInstaller로 빌드된 경우 — 실행 파일 옆에 위치
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, 'dora_host.py')


def build_manifest(host_path: str, ext_id: str) -> dict:
    return {
        "name": "com.abc.dora",
        "description": "DORA - 파일 이동 헬퍼",
        "path": host_path,
        "type": "stdio",
        "allowed_origins": [f"chrome-extension://{ext_id}/"]
    }


def install_mac(ext_id: str) -> str:
    host_path = get_host_path()
    if not os.path.isfile(host_path):
        raise FileNotFoundError(f"dora_host.py를 찾을 수 없습니다:\n{host_path}")

    # 실행 권한 부여
    os.chmod(host_path, os.stat(host_path).st_mode | stat.S_IXUSR | stat.S_IXGRP)

    nm_dir = os.path.expanduser(
        '~/Library/Application Support/Google/Chrome/NativeMessagingHosts'
    )
    os.makedirs(nm_dir, exist_ok=True)

    manifest_path = os.path.join(nm_dir, 'com.abc.dora.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(build_manifest(host_path, ext_id), f, indent=2, ensure_ascii=False)

    return manifest_path


def install_windows(ext_id: str) -> str:
    import winreg  # Windows 전용

    host_path = get_host_path()
    if not os.path.isfile(host_path):
        raise FileNotFoundError(f"dora_host.py를 찾을 수 없습니다:\n{host_path}")

    # 매니페스트 파일 저장
    base = os.path.dirname(host_path)
    manifest_path = os.path.join(base, 'com.abc.dora.win.json')
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(build_manifest(host_path, ext_id), f, indent=2, ensure_ascii=False)

    # 레지스트리 등록
    reg_key = r'Software\Google\Chrome\NativeMessagingHosts\com.abc.dora'
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, reg_key) as key:
        winreg.SetValueEx(key, '', 0, winreg.REG_SZ, manifest_path)

    return manifest_path


def run_install(ext_id: str) -> str:
    os_name = platform.system()
    if os_name == 'Darwin':
        return install_mac(ext_id)
    elif os_name == 'Windows':
        return install_windows(ext_id)
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
        self._step_label(body, '2', 'DORA 카드에 표시된 Extension ID를 입력하세요.')
        desc2 = tk.Label(
            body,
            text='확장 카드 하단에 표시된 영문+숫자 32자리 ID를 복사해 붙여넣으세요.',
            bg=C_BG, fg=C_MUTED, font=('', 10), justify='left'
        )
        desc2.pack(anchor='w', padx=(28, 0), pady=(2, 8))

        self.ext_id_var = tk.StringVar()
        entry = tk.Entry(
            body, textvariable=self.ext_id_var,
            font=('Courier', 11), width=36,
            relief='flat', highlightbackground=C_BORDER,
            highlightthickness=1, highlightcolor=C_PRIMARY,
            padx=8, pady=6
        )
        entry.pack(anchor='w', padx=(28, 0))
        entry.bind('<Return>', lambda e: self._install())

        # 설치 버튼
        install_btn = tk.Button(
            body, text='설치 시작',
            bg=C_PRIMARY, fg='white', relief='flat',
            font=('', 12, 'bold'), cursor='hand2',
            padx=0, pady=10, width=32,
            activebackground='#4338ca', activeforeground='white',
            command=self._install
        )
        install_btn.pack(pady=(20, 0))

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
        ext_id = self.ext_id_var.get().strip()
        if not ext_id:
            self._show_result('Extension ID를 입력해주세요.', error=True)
            return
        if len(ext_id) != 32 or not ext_id.isalpha():
            self._show_result('Extension ID는 영문 소문자 32자리입니다.\n다시 확인해주세요.', error=True)
            return

        try:
            manifest_path = run_install(ext_id)
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
