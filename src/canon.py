import asyncio
from playwright.async_api import async_playwright
D='/tmp/claude-0/-home-claude/3211a68d-b924-5f8f-a9bc-c5beb665f93b/scratchpad/adm/'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();errs=[]
        pg=await b.new_page();pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+D+'seed.html');await pg.wait_for_timeout(400)
        doc=await pg.evaluate('__fa.buildDoc()');open(D+'index.html','w',encoding='utf-8').write(doc)
        pg2=await b.new_page();pg2.on('pageerror',lambda e:errs.append(str(e)))
        await pg2.goto('file://'+D+'index.html');await pg2.wait_for_timeout(400)
        same=(await pg2.evaluate('__fa.buildDoc()'))==doc
        print('identical',same,'cards',await pg2.locator('#grid .card').count(),'errs',errs,'chars',len(doc))
        assert same and not errs
        await b.close()
asyncio.run(main())
