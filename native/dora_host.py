#!/usr/bin/env python3
"""
DORA Native Messaging Host
Chrome Extension과 통신하여 다운로드된 파일을 지정 폴더로 이동한다.

프로토콜:
  - 입력/출력 모두 4바이트(네이티브 바이트 순서) 길이 헤더 + UTF-8 JSON 본문
  - 요청: { "action": "move", "src": "<원본 경로>", "dst": "<대상 경로>" }
  - 응답: { "success": true, "dst": "<이동된 경로>" }
           { "success": false, "error": "<오류 메시지>" }
"""

import sys
import json
import struct
import shutil
import os


def read_message() -> dict:
    """stdin에서 메시지를 읽어 dict로 반환한다."""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        sys.exit(0)
    length = struct.unpack('@I', raw_length)[0]
    raw_message = sys.stdin.buffer.read(length)
    return json.loads(raw_message.decode('utf-8'))


def send_message(message: dict) -> None:
    """dict를 직렬화해 stdout으로 메시지를 전송한다."""
    encoded = json.dumps(message, ensure_ascii=False).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def move_file(src: str, dst: str) -> dict:
    """
    src 파일을 dst 경로로 이동한다.
    dst 디렉토리가 없으면 자동 생성한다.
    동일 파일명이 존재하면 (1), (2) suffix를 붙인다.
    """
    if not os.path.isfile(src):
        return {'success': False, 'error': f'원본 파일을 찾을 수 없습니다: {src}'}

    dst_dir = os.path.dirname(dst)
    os.makedirs(dst_dir, exist_ok=True)

    # 파일명 충돌 처리
    final_dst = dst
    if os.path.exists(final_dst):
        base, ext = os.path.splitext(dst)
        counter = 1
        while os.path.exists(final_dst):
            final_dst = f'{base} ({counter}){ext}'
            counter += 1

    shutil.move(src, final_dst)
    return {'success': True, 'dst': final_dst}


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
                continue

            result = move_file(src, dst)
            send_message(result)

        elif action == 'ping':
            send_message({'success': True, 'message': 'pong'})

        else:
            send_message({'success': False, 'error': f'알 수 없는 action: {action}'})


if __name__ == '__main__':
    main()
