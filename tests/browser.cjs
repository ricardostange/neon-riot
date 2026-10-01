// Optional real-browser checks. Install Playwright outside the game or use NODE_PATH.
// Start ./run.sh, then: RIOT_URL=http://localhost:8000 node tests/browser.cjs
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {instrument} = require('./harness.cjs');
const url = process.env.RIOT_URL || 'http://localhost:8000';
const shots = process.env.RIOT_SCREENSHOTS || '/tmp/neon-riot-screenshots';
fs.mkdirSync(shots,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  const errors=[];
  try {
    const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1440,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/game.js',route=>route.fulfill({contentType:'text/javascript',body:instrument()}));
    await page.goto(url);await page.locator('#start').waitFor();
    await page.screenshot({path:`${shots}/01-menu.png`});
    await page.click('#start');
    assert.ok((await page.locator('#pause').boundingBox()).y<80,'Desktop pause remains at top');
    await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');
    assert.ok(await page.evaluate(()=>__riot.player.x>20));
    await page.keyboard.press('Space');assert.ok(await page.evaluate(()=>__riot.player.dash>0));
    await page.keyboard.press('p');const before=await page.evaluate(()=>__riot.clock);await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>__riot.clock),before);assert.ok(await page.locator('#pauseMenu').isVisible());
    await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>__riot.state),'playing');
    await page.evaluate(()=>{__riot.scene();__riot.player.inv=20;});
    await page.waitForTimeout(300);await page.screenshot({path:`${shots}/02-combat.png`});
    await page.keyboard.down('Space');
    await page.evaluate(()=>{__riot.setXP(__riot.need);__riot.levelUp();});
    await page.keyboard.down('Space'); // Native auto-repeat while a draft takes focus.
    await page.keyboard.up('Space');
    assert.equal(await page.evaluate(()=>__riot.state),'upgrade','Holding dash cannot auto-select an upgrade');
    assert.equal(await page.locator('.card').count(),3);
    const old=await page.locator('.card strong').allTextContents();
    await page.keyboard.press('r');const fresh=await page.locator('.card strong').allTextContents();
    assert.ok(fresh.every(x=>!old.includes(x)));assert.equal(await page.evaluate(()=>__riot.rerolls),1);
    await page.screenshot({path:`${shots}/03-upgrades.png`});
    await page.keyboard.press('2');assert.equal(await page.evaluate(()=>__riot.state),'playing');
    await page.keyboard.press('Escape');await page.screenshot({path:`${shots}/04-pause.png`});
    // Pause settings stay within the dialog tab order.
    await page.locator('#fullscreen').focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'resume');
    await page.click('#resume');
    await page.evaluate(()=>{__riot.clean();__riot.setClock(179.99);__riot.player.inv=20;__riot.update(1/60);const b=__riot.enemies.find(e=>e.boss);b.entry=0;b.windup=.55;b.windupMax=.85;b.aim=.3;__riot.updateHud();});
    await page.screenshot({path:`${shots}/05-boss.png`});
    await page.evaluate(()=>{const boss=__riot.enemies.find(e=>e.boss);for(let phase=0;phase<3;phase++){boss.armor=0;__riot.damage(boss,1e7);}});
    await page.locator('#end').waitFor({state:'visible'});assert.match(await page.locator('#endTitle').innerText(),/COMPLETE/);
    await page.screenshot({path:`${shots}/06-results.png`});
    await page.click('#restart');assert.equal(await page.evaluate(()=>__riot.level),1);
    await page.click('#pause');await page.click('#motion');await page.click('#mute');await page.reload();
    assert.equal(await page.evaluate(()=>__riot.calm),true);assert.equal(await page.evaluate(()=>__riot.muted),true);
    // Reduced-motion preferences work before a user has saved an override.
    const reduced=await browser.newPage({reducedMotion:'reduce'});
    await reduced.goto(url);assert.ok(await reduced.locator('body').evaluate(e=>e.classList.contains('calm')));await reduced.close();

    const mobile=await browser.newPage({serviceWorkers:'block',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.route('**/game.js',route=>route.fulfill({contentType:'text/javascript',body:instrument()}));
    await mobile.goto(url);await mobile.click('#start');await mobile.evaluate(()=>__riot.clean());
    const stick=await mobile.locator('#stick').boundingBox();assert.ok(stick);
    const dash=await mobile.locator('#touchDash').boundingBox();
    const pause=await mobile.locator('#pause').boundingBox();
    assert.ok(pause.y+pause.height<=dash.y-12 && pause.y>844/2,'Touch pause stays low and separate from dash');
    const cdp=await mobile.context().newCDPSession(mobile);
    const point={x:stick.x+stick.width/2,y:stick.y+stick.height/2,id:1};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    point.x+=17;
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point]});
    await mobile.waitForTimeout(150);assert.ok(await mobile.evaluate(()=>__riot.player.x>0));
    const x=await mobile.evaluate(()=>__riot.player.x);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,{x:dash.x+dash.width/2,y:dash.y+dash.height/2,id:2}]});
    await mobile.waitForTimeout(250);
    assert.ok(await mobile.evaluate(x=>__riot.player.x-x>180,x),'Analog touch dash is full strength');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.deepEqual(await mobile.evaluate(()=>__riot.joy),{x:0,y:0});
    await mobile.evaluate(()=>{__riot.scene();__riot.player.inv=20;});await mobile.waitForTimeout(150);
    await mobile.screenshot({path:`${shots}/07-mobile-combat.png`});
    await mobile.evaluate(()=>{__riot.setXP(__riot.need);__riot.levelUp();});
    await mobile.screenshot({path:`${shots}/08-mobile-upgrades.png`});
    assert.equal(await mobile.locator('#touchControls').evaluate(e=>getComputedStyle(e).display),'none');
    const third=await mobile.locator('.card').nth(2).boundingBox();assert.ok(third.y+third.height<844-55,'Third choice is visible without clipping');
    await mobile.locator('.card').nth(2).tap();assert.equal(await mobile.evaluate(()=>__riot.state),'playing');
    await mobile.setViewportSize({width:844,height:390});
    const landscapePause=await mobile.locator('#pause').boundingBox(),landscapeDash=await mobile.locator('#touchDash').boundingBox();
    assert.ok(landscapePause.y>80 && landscapePause.y+landscapePause.height<=landscapeDash.y-12);
    await mobile.click('#pause');
    await mobile.screenshot({path:`${shots}/09-mobile-landscape.png`});
    assert.ok(await mobile.locator('#resume').isVisible());
    assert.deepEqual(errors,[]);
    console.log(`PASS: desktop gameplay, drafts, focus, boss/results, persistence, reduced motion, real multitouch, mobile layouts.\nScreenshots: ${shots}`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
