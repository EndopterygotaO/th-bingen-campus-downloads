"""Generate simple campus-building launcher icons and splash assets."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / 'android/app/src/main/res'


def foreground(size, transparent=False):
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent else '#214d40')
    draw = ImageDraw.Draw(image)
    scale = size / 108
    def box(values): return tuple(round(v * scale) for v in values)
    draw.polygon([(round(x*scale), round(y*scale)) for x,y in [(28,46),(54,29),(80,46)]],fill='#f4f6ee')
    draw.rectangle(box((31,49,77,53)),fill='#f4f6ee')
    for x in (35,50,65): draw.rounded_rectangle(box((x,56,x+8,75)), radius=max(1,round(scale)), fill='#f4f6ee')
    draw.rectangle(box((29,79,79,83)),fill='#f4f6ee')
    return image


for density,size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder=ROOT / f'mipmap-{density}'
    folder.mkdir(exist_ok=True)
    icon=foreground(size*4)
    icon.resize((size,size),Image.Resampling.LANCZOS).save(folder/'ic_launcher.png')
    icon.resize((size,size),Image.Resampling.LANCZOS).save(folder/'ic_launcher_round.png')
    fg=foreground(round(size/48*108)*4,True)
    fg.resize((round(size/48*108),)*2,Image.Resampling.LANCZOS).save(folder/'ic_launcher_foreground.png')

for path in ROOT.glob('drawable*/splash.png'):
    with Image.open(path) as previous: size=previous.size
    image=Image.new('RGB',size,'#f4f5f0')
    side=min(size)//4
    icon=foreground(side*2).resize((side,side),Image.Resampling.LANCZOS)
    image.paste(icon,((size[0]-side)//2,(size[1]-side)//2),icon)
    image.save(path)

background=ROOT/'values/ic_launcher_background.xml'
background.write_text('<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="ic_launcher_background">#214d40</color></resources>\n',encoding='utf-8')
print('Generated Android launcher and splash assets.')
