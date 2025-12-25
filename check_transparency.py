from PIL import Image
import sys

try:
    img = Image.open('assets/images/splash-icon.png')
    img = img.convert('RGBA')
    
    # Check a 5x5 grid in the top-left corner
    print("Top-Left 5x5 Pixels:")
    for y in range(5):
        row_str = ""
        for x in range(5):
            pixel = img.getpixel((x, y))
            row_str += f"{pixel} "
        print(row_str)
        
    print(f"\nImage Mode: {img.mode}")
    print(f"Info: {img.info}")
    
except Exception as e:
    print(f"Error: {e}")
