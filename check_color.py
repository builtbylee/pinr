from PIL import Image
import sys

try:
    img = Image.open('assets/images/splash-icon.png')
    pixel = img.getpixel((0, 0)) # Get top-left corner
    # Convert to hex
    if len(pixel) == 4:
        r, g, b, a = pixel
    else:
        r, g, b = pixel
    
    hex_color = '#{:02x}{:02x}{:02x}'.format(r, g, b)
    print(hex_color)
except Exception as e:
    print(f"Error: {e}")
