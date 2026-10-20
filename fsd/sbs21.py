import sys
from PIL import Image
R='/cursor/stores/store-61d7f99a-c6c4-4afa-9c00-b6989c7f0b04/grok-bot/agents/396e4cf7-0bf9-43bb-ab59-605e558d33e0/attachments/'
tag=sys.argv[1]; H=900
ims=[Image.open(R+'01M5CVZS4WH6BM92N81Z50F6F7.png').convert('RGB')]+[Image.open(f'shots/v21/{tag}-{s}.png').convert('RGB') for s in sys.argv[2:]]
ims=[i.resize((round(i.width*H/i.height),H)) for i in ims]
out=Image.new('RGB',(sum(i.width for i in ims)+20*(len(ims)-1),H),'white'); x=0
for i in ims: out.paste(i,(x,0)); x+=i.width+20
out.save(f'shots/v21/compare-{tag}.png')
