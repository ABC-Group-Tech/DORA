#!/usr/bin/env python3
"""
DORA Native Messaging Host
Chrome Extension과 통신하여 파일 이동 및 폴더 선택 다이얼로그를 처리한다.

지원 액션:
  - move:        파일을 src에서 dst로 이동
  - pick_folder: OS 기본 폴더 선택 창을 열고 선택된 경로를 반환
  - ping:        연결 상태 확인

프로토콜:
  4바이트(네이티브 바이트 순서) 길이 헤더 + UTF-8 JSON 본문
"""

import sys
import json
import struct
import shutil
import os


def read_message() -> dict:
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        sys.exit(0)
    length = struct.unpack('@I', raw_length)[0]
    raw_message = sys.stdin.buffer.read(length)
    return json.loads(raw_message.decode('utf-8'))


def send_message(message: dict) -> None:
    encoded = json.dumps(message, ensure_ascii=False).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def move_file(src: str, dst: str) -> dict:
    if not os.path.isfile(src):
        return {'success': False, 'error': f'원본 파일을 찾을 수 없습니다: {src}'}

    dst_dir = os.path.dirname(dst)
    os.makedirs(dst_dir, exist_ok=True)

    final_dst = dst
    if os.path.exists(final_dst):
        base, ext = os.path.splitext(dst)
        counter = 1
        while os.path.exists(final_dst):
            final_dst = f'{base} ({counter}){ext}'
            counter += 1

    shutil.move(src, final_dst)
    return {'success': True, 'dst': final_dst}


def pick_folder(title: str = '저장 폴더 선택') -> dict:
    """OS 기본 폴더 선택 창을 열고 선택된 절대 경로를 반환한다."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        # 다이얼로그가 화면 중앙에 뜨도록 루트를 중앙에 먼저 배치 후 숨김
        sw = root.winfo_screenwidth()
        sh = root.winfo_screenheight()
        root.geometry(f'1x1+{sw // 2}+{sh // 2}')
        root.update_idletasks()
        root.withdraw()
        root.wm_attributes('-topmost', 1)

        folder = filedialog.askdirectory(
            title=title,
            parent=root
        )
        root.destroy()

        if folder:
            return {'success': True, 'path': folder}
        else:
            return {'success': False, 'error': 'cancelled'}

    except Exception as e:
        return {'success': False, 'error': str(e)}


def main():
    while True:
        try:
            message = read_message()
        except Exception:
            break

        action = message.get('action')

        if action == 'move':
            src = message.get('src', '')
            dst = message.get('dst', '')
            if not src or not dst:
                send_message({'success': False, 'error': 'src 또는 dst가 비어있습니다.'})
            else:
                send_message(move_file(src, dst))

        elif action == 'pick_folder':
            title = message.get('title', '저장 폴더 선택')
            send_message(pick_folder(title))

        elif action == 'ping':
            send_message({'success': True, 'message': 'pong'})

        else:
            send_message({'success': False, 'error': f'알 수 없는 action: {action}'})


if __name__ == '__main__':
    main()
