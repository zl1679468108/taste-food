#!/usr/bin/env python3
"""Generate tabBar icons for WeChat mini-program using pure Python (no Pillow)."""

import struct
import zlib
import os

def create_png(width, height, pixels, filepath):
    """
    Create a PNG file from raw RGBA pixel data.
    pixels: list of (r,g,b,a) tuples in row-major order
    """
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
        return struct.pack('>I', len(data)) + chunk + crc

    header = b'\x89PNG\r\n\x1a\n'

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr = make_chunk(b'IHDR', ihdr_data)

    # IDAT - raw pixel data
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            r, g, b, a = pixels[y * width + x]
            raw_data += struct.pack('BBBB', r, g, b, a)
    compressed = zlib.compress(raw_data)
    idat = make_chunk(b'IDAT', compressed)

    # IEND
    iend = make_chunk(b'IEND', b'')

    with open(filepath, 'wb') as f:
        f.write(header + ihdr + idat + iend)


def draw_icon(size, color, shape_fn):
    """Draw an icon using a shape function that returns True for filled pixels."""
    pixels = []
    for y in range(size):
        for x in range(size):
            if shape_fn(x, y, size):
                pixels.append((color[0], color[1], color[2], 255))
            else:
                pixels.append((0, 0, 0, 0))
    return pixels


def menu_shape(x, y, s):
    """Three horizontal lines (hamburger menu)."""
    # Convert to center coordinates
    cx, cy = x - s // 2, y - s // 2
    h = s // 2

    # Three lines at y offsets: -h//2, 0, h//2
    line_y_positions = [-h // 2, 0, h // 2]
    line_h = max(1, s // 16)
    line_margin = max(2, s // 8)

    for ly in line_y_positions:
        if abs(cy - ly) < line_h:
            if abs(cx) < (h - line_margin):
                return True
    return False


def order_shape(x, y, s):
    """A clipboard / order receipt icon."""
    cx, cy = x - s // 2, y - s // 2
    h = s // 2
    sw = max(2, s // 10)
    gap = max(1, s // 20)

    # Clip border
    border = max(2, s // 12)
    if abs(cx) > h - border or abs(cy) > h - border:
        return False

    # Header (clip part)
    clip_h = h // 3
    if abs(cy) < clip_h:
        return True

    # Lines (like text on the order)
    line_h = max(1, s // 20)
    for i in range(4):
        ly = clip_h + (h - clip_h) * (i + 1) // 5
        if abs(cy - ly) < line_h:
            line_w = (h - border - gap) - (i % 2) * (s // 6)
            if abs(cx) < line_w:
                return True
    return False


def main():
    output_dir = '/Users/zhaolong/前端/taste-food/client/src/assets/icons'
    os.makedirs(output_dir, exist_ok=True)

    size = 81  # standard tabBar icon size

    # Define icons: (filename, color, shape_function)
    icons = [
        # Gray (unselected)
        ('menu.png',       (153, 153, 153), menu_shape),
        ('order.png',      (153, 153, 153), order_shape),
        # Red (selected)
        ('menu-active.png', (231, 76, 60),  menu_shape),
        ('order-active.png',(231, 76, 60),  order_shape),
    ]

    for fname, color, shape_fn in icons:
        filepath = os.path.join(output_dir, fname)
        pixels = draw_icon(size, color, shape_fn)
        create_png(size, size, pixels, filepath)
        file_size = os.path.getsize(filepath)
        print(f'Created {fname} ({file_size} bytes)')

if __name__ == '__main__':
    main()
