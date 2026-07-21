import { chromium } from "playwright";
const B="http://localhost:4173";
const b=await chromium.launch();
const ctx=await b.newContext({ viewport:{width:1280,height:800}, recordVideo:{ dir:"/private/tmp/claude-501/-Users-assem-Documents-Doc-Assem-Claude-Code-nexus/0fcaeda7-df7b-4da6-aa8d-aba222094e48/scratchpad/motion-vid", size:{width:1280,height:800} } });
const p=await ctx.newPage();
const w=(ms)=>p.waitForTimeout(ms);
// 1) list — row hover lift
await p.goto(B+"/#/o/companies"); await w(900);
for (const r of [1,2,3,4]){ await p.hover('tbody tr:nth-child('+r+')').catch(()=>{}); await w(280); }
// 2) unified search → filter dropdown pop-in → pick → chip pop-in
await p.click('[data-testid=list-search]'); await p.type('[data-testid=list-search]',"Soft",{delay:90}); await w(700);
await p.click('[data-testid=filter-sug-value-industry]').catch(()=>{}); await w(900);
await p.click('[data-testid=filter-remove-industry]').catch(()=>{}); await w(700);
// 3) board view — kanban cards
await p.goto(B+"/#/o/deals"); await w(500); await p.click('text=Board').catch(()=>{}); await w(900);
for (const c of [1,2]){ await p.hover('[data-testid^=kcard]:nth-of-type('+c+'), .nxKCard:nth-of-type('+c+')').catch(()=>{}); await w(320); }
// 4) standard record — peek slide-in + suggestions cards pop-in
await p.goto(B+"/#/o/companies"); await w(500); await p.click('text=Brightline Analytics'); await w(1100);
await p.locator('[data-testid=suggest-request]').click().catch(()=>{}); await w(1600);
await p.keyboard.press('Escape'); await w(500);
// 5) document — wide side panel slide-in
await p.goto(B+"/#/o/docs"); await w(500); await p.click('text=Q3 launch plan'); await w(1300);
await p.keyboard.press('Escape'); await w(500);
// 6) copilot panel slide + suggestions chips
await p.goto(B+"/#/o/companies/r/co_1"); await w(700); await p.click('[data-testid=copilot-toggle]').catch(()=>{}); await w(1100);
await p.keyboard.press('Escape').catch(()=>{}); await w(400);
// 7) settings — tab underline slide
await p.goto(B+"/#/p/settings"); await w(800); await p.click('text=ABOUT').catch(()=>{}); await w(700); await p.click('text=WRITING RULES').catch(()=>{}); await w(700);
await ctx.close(); // saves video
await b.close();
const fs=await import("node:fs"); const f=fs.readdirSync("/private/tmp/claude-501/-Users-assem-Documents-Doc-Assem-Claude-Code-nexus/0fcaeda7-df7b-4da6-aa8d-aba222094e48/scratchpad/motion-vid").find(x=>x.endsWith(".webm"));
console.log("video:", f, f?Math.round(fs.statSync("/private/tmp/claude-501/-Users-assem-Documents-Doc-Assem-Claude-Code-nexus/0fcaeda7-df7b-4da6-aa8d-aba222094e48/scratchpad/motion-vid/"+f).size/1024)+"KB":"NONE");
