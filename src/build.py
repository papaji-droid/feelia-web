import json, base64, io
from PIL import Image
D = '/tmp/claude-0/-home-claude/3211a68d-b924-5f8f-a9bc-c5beb665f93b/scratchpad/adm/'
rd = lambda n: open(D + n, encoding='utf-8').read()

css = rd('base.css') + rd('admin.css')
tpl = rd('tpl.html')
js = rd('app.js')
assert '</script' not in js and '<!--' not in js and '</style' not in css and '</template' not in tpl

c = json.load(open(D + 'cfg.json', encoding='utf-8'))
S = c['SHOP']
shop = {
    'name': S['name'], 'by': S['by'], 'title': 'FREE.A by Thuý An',
    'desc': 'FREE.A by Thuý An Styling Studio: váy, áo, quần, set phối sẵn cho nàng. Nhận hàng rồi mới trả tiền, được kiểm hàng, đổi size trong 7 ngày.',
    'phone': S['phone'], 'zalo': S['zalo'], 'hours': S['hours'], 'shipFee': S['shipFee'], 'freeShip': S['freeShip'],
    'saleEnd': S['saleEnd'], 'tryon': '', 'bank': S['bank'],
    'notice': 'Nhập FREEA10 giảm 10% cho đơn đầu. Miễn phí giao hàng từ 399.000₫.',
    'headline': 'Mặc là mê.',
    'intro': 'Váy, áo, quần và set phối sẵn cho nàng. Nhận hàng, mở ra xem, ưng rồi mới trả tiền.',
}
vouchers = [{'code': k, **{a: b for a, b in v.items() if a != 'note'}} for k, v in c['VOUCHERS'].items()]
store = {'v': 1, 'rev': 1, 'shop': shop, 'brand': {'st': 'f', 'sz': 34}, 'vouchers': vouchers, 'looks': c['LOOKS'], 'products': c['PRODUCTS']}

im = Image.open('/mnt/user-data/uploads/1000016198.jpg').convert('RGB')
buf = io.BytesIO(); im.save(buf, 'JPEG', quality=80, optimize=True, progressive=True)
logo = base64.b64encode(open('/tmp/claude-0/-home-claude/3211a68d-b924-5f8f-a9bc-c5beb665f93b/scratchpad/st/logo_final.png','rb').read()).decode()
media = {'cover': 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode(), 'logo0': 'data:image/png;base64,' + logo, 'logo': '', 'p': {}}
print('cover bytes', len(buf.getvalue()))

# Bản mồi: trang tự ghi lại chính nó bằng buildDoc() để ra bản chuẩn
seed = ('<!DOCTYPE html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<title>seed</title>\n'
        '<script type="application/json" id="store">' + json.dumps(store, ensure_ascii=False).replace('<', '\\u003c') + '</script>\n'
        '<style id="css">' + css + '</style>\n</head>\n<body>\n<template id="tpl">' + tpl + '</template>\n'
        '<script type="application/json" id="media">' + json.dumps(media) + '</script>\n'
        '<script id="app">' + js + '</script>\n</body>\n</html>\n')
open(D + 'seed.html', 'w', encoding='utf-8').write(seed)
print('seed', len(seed))
