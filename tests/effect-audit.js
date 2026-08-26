(()=>{
  const api=globalThis.__effectAudit;
  const results=[];
  const originalRandom=Math.random;
  const near=(actual,expected,tolerance=.0001)=>Math.abs(actual-expected)<=tolerance;
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  const assertNear=(actual,expected,message,tolerance=.0001)=>assert(near(actual,expected,tolerance),`${message} (expected ${expected}, got ${actual})`);
  const gear=id=>api.equipment.find(item=>item.id===id);
  const relic=id=>api.relics.find(item=>item.id===id);
  const test=(pass,name,fn)=>{
    try{api.reset();fn();results.push({pass,name,ok:true})}
    catch(error){results.push({pass,name,ok:false,error:error.message})}
    finally{Math.random=originalRandom}
  };
  const seededRandom=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};

  for(let pass=1;pass<=3;pass++){
    test(pass,"카탈로그/등급/드롭 풀",()=>{
      assert(api.equipment.length===24,`장비 수 ${api.equipment.length}`);
      assert(api.relics.length===10,`잔흔 수 ${api.relics.length}`);
      assert(new Set(api.equipment.map(item=>item.id)).size===api.equipment.length,"중복 장비 ID");
      assert(new Set(api.relics.map(item=>item.id)).size===api.relics.length,"중복 잔흔 ID");
      const rare=["ghost-pass","ice-chain","vitality-potion","gravity-field","sniper-scope","everlasting-torch","frightening-story"];
      assert(rare.every(id=>gear(id)?.grade==="희귀"),"희귀 7종 등급 불일치");
      assert(!api.rewardPool().some(item=>item.id==="gambling-king-charm"),"도박왕의 부적이 일반 드롭 풀에 포함됨");
      assert(api.rewardPool().length===23,"드롭 풀 개수 불일치");
      assert(api.relicSynergies.special.required.join(",")==="pull,repulsion","이중인격 조건 데이터 불일치");
    });

    test(pass,"잔흔 후보 중복/장착 잔흔 제외",()=>{
      api.equipRelics(["pull"]);Math.random=seededRandom(300+pass);const choices=[];for(let i=0;i<3;i++)choices.push(api.rollRelic(choices.map(choice=>choice.id)));
      assert(choices.every(Boolean),"잔흔 후보 생성 실패");assert(new Set(choices.map(choice=>choice.id)).size===3,"잔흔 후보 중복");assert(!choices.some(choice=>choice.id==="pull"),"이미 장착한 잔흔 재등장");
    });

    test(pass,"큰 지형 하부 통과 공간",()=>{
      api.setStageQueue([1]);api.loadStage();const ceiling=api.stagePlatforms().find(platform=>platform.x===0&&platform.y===400);assert(ceiling,"대형 지형을 찾을 수 없음");assert(568-(ceiling.y+ceiling.h)>=api.player.h+18,"대형 지형 아래 통과 높이가 부족함");
    });

    test(pass,"요격 골렘 광선은 감지 범위 끝까지 조준",()=>{
      api.setStageQueue([0]);api.loadStage();const golem=api.enemies.find(enemy=>enemy.type===2);assert(golem,"요격 골렘 생성 실패");api.player.x=golem.x-240;api.player.y=golem.y;golem.cooldown=0;api.step(1/60);const originX=golem.x+42,originY=golem.y+29;assertNear(Math.hypot(golem.laserAimX-originX,golem.laserAimY-originY),300,"요격 골렘 광선 사거리");
    });

    test(pass,"고블린 공격 1초 준비 시간",()=>{
      api.setStageQueue([0]);api.loadStage();const goblin=api.enemies.find(enemy=>enemy.type===1);assert(goblin,"고블린 생성 실패");api.player.x=goblin.x;api.player.y=goblin.y;api.player.hp=150;goblin.cooldown=0;api.step(1/60);assert(goblin.goblinWindup>.9&&api.player.hp===150,"고블린이 준비 시간 없이 공격함");
    });

    test(pass,"기본 공격 관통 및 기본 피해 25",()=>{
      api.player.x=100;api.player.y=492;const first=api.enemy({x:150,y:492,hp:1000,maxHp:1000}),second=api.enemy({x:180,y:492,hp:1000,maxHp:1000});api.beginAttack("down");api.step(.12);api.step(.01);assertNear(first.hp,975,"첫 번째 적 기본 피해");assertNear(second.hp,975,"두 번째 적 기본 공격 관통");
    });

    test(pass,"돌진 공격 이동 관통",()=>{
      api.player.x=100;api.player.y=492;const first=api.enemy({x:180,y:492,hp:1000,maxHp:1000}),second=api.enemy({x:330,y:492,hp:1000,maxHp:1000});api.beginAttack("dash");api.step(.07);api.step(.03);api.step(.03);api.step(.02);assertNear(first.hp,975,"돌진 첫 번째 적 피해");assertNear(second.hp,975,"돌진 두 번째 적 관통 피해");
    });

    test(pass,"스테이지 클리어 보상 3개/1개 선택",()=>{
      Math.random=seededRandom(700+pass);const rewards=api.prepareRewards();assert(rewards.length===3,"보상 3개가 생성되지 않음");assert(new Set(rewards.map(reward=>reward.item.id)).size===3,"보상 후보 중복");assert(!rewards.some(reward=>reward.item.id==="gambling-king-charm"),"도박왕 부적 보상 생성");assert(api.resolveReward(rewards[1],false),"보상 획득 실패");assert(api.rewardState().resolved,"보상 선택 후 미해결 상태");assert(api.inventory.gear.some(item=>item?.id===rewards[1].item.id),"선택 장비 자동 장착 실패");
    });

    test(pass,"일반 장비 5종 기본 배율",()=>{
      api.equipGear(["ordinary-boots","supply-gloves","magic-primer","wind-aid","merchant-badge"]);
      const stats=api.stats();
      assertNear(stats.moveSpeed,1.1,"성급함의 장화");
      assertNear(stats.basicDamage,1.05,"보급형 장갑");
      assertNear(stats.magicDamage,1.05,"마법학 기초서");
      assertNear(stats.attackSpeed,1.1,"바람의 도움");
      assertNear(stats.goldGain,1.05,"상인연합 뱃지");
    });

    test(pass,"유령 통행증 6중첩 및 2차원 거리",()=>{
      api.equipGear(["ghost-pass"]);
      for(let i=0;i<6;i++)api.enemy({x:120+i*4,y:488});
      api.enemy({x:120,y:80});
      assertNear(api.stats().moveSpeed,1.6,"유령 통행증 최대 중첩");
    });

    test(pass,"얼음 사슬 대상 최대 체력 고정 피해",()=>{
      api.equipGear(["ice-chain"]);
      const a=api.enemy({x:220,hp:100,maxHp:100}),b=api.enemy({x:320,hp:200,maxHp:200}),c=api.enemy({x:420,hp:300,maxHp:300});
      api.hit(a,1,false,"magic");api.hit(b,1,false,"magic");api.hit(c,1,false,"magic");
      assertNear(a.hp,94,"얼음 사슬 100 HP 대상");
      assertNear(b.hp,189,"얼음 사슬 200 HP 대상");
      assertNear(c.hp,284,"얼음 사슬 300 HP 대상");
      assert([a,b,c].every(enemy=>enemy.hitStunUntil===3),"얼음 사슬 3초 속박 누락");
    });

    test(pass,"얼음 사슬 처치 보상 1회만 적용",()=>{
      api.equipGear(["ice-chain"]);api.equipRelics(["steady"]);
      const a=api.enemy({x:220,hp:100,maxHp:100}),b=api.enemy({x:320,hp:100,maxHp:100}),c=api.enemy({x:420,hp:2,maxHp:100});
      api.hit(a,1,false,"magic");api.hit(b,1,false,"magic");api.hit(c,1,false,"magic");
      assert(c.dead,"얼음 사슬 처치 실패");assert(api.relicRuntime.steadyStacks===1,"얼음 사슬 처치 보상 중복 적용");
    });

    test(pass,"활력의 잔 마법 사용 버프",()=>{
      api.equipGear(["vitality-potion"]);api.gearRuntime.lastMagicCooldown=0;api.player.magicCooldown=3;api.step(0);
      assertNear(api.stats().moveSpeed,1.4,"활력의 잔 이동속도");
      assertNear(api.stats().attackSpeed,1.4,"활력의 잔 공격속도");
    });

    test(pass,"중력장/정조준 스코프 거리 판정",()=>{
      api.equipGear(["gravity-field"]);let target=api.enemy({x:160,y:492,hp:1000,maxHp:1000});api.hit(target,100,false,"magic");assertNear(target.hp,890,"중력장");
      api.reset();api.equipGear(["sniper-scope"]);target=api.enemy({x:650,y:492,hp:1000,maxHp:1000});api.hit(target,100,false,"magic");assertNear(target.hp,890,"정조준 스코프");
    });

    test(pass,"꺼지지 않는 횃불 화상/붉은 숫자",()=>{
      api.equipGear(["everlasting-torch"]);const target=api.enemy({x:170,y:492,hp:100,maxHp:100});api.setElapsed(1);api.tickBurns();api.setElapsed(2);api.tickBurns();
      assertNear(target.hp,98,"화상 누적 피해");
      assert(api.damageNumbers.some(number=>number.color==="#ff5b4d"),"화상 피해 숫자 색상 누락");
      assert(target.burnStacks===1,"화상 수치 감소 불일치");
    });

    test(pass,"횃불+화로 화상 중첩 균등 적용",()=>{
      api.equipGear(["everlasting-torch","eternal-brazier"]);const targets=[api.enemy({x:170,y:492}),api.enemy({x:185,y:492}),api.enemy({x:200,y:492})];api.setElapsed(1);api.tickBurns();
      assert(targets.every(target=>target.burnStacks===1),"횃불+화로 화상 중첩이 대상마다 달라짐");
    });

    test(pass,"녹슨 동전 변환 타격은 부적을 중복 적용하지 않음",()=>{
      api.equipGear(["rusted-coin"]);api.gearRuntime.coinJackpots=9;Math.random=()=>.999;const target=api.enemy({hp:1000,maxHp:1000});api.hit(target,100,false,"magic");
      assertNear(target.hp,800,"변환 타격 피해 배율");assert(api.inventory.gear.some(item=>item?.id==="gambling-king-charm"),"도박왕의 부적 변환 실패");
    });

    test(pass,"첫 석판 2개 선택/두 번째 사망 복귀",()=>{
      api.beginFirstAltar();api.openChoices();let state=api.relicChoiceState(),firstChoices=[...state.choices];assert(state.remaining===2&&state.choices.length===3,"첫 석판 후보 또는 선택 횟수 오류");api.selectChoice(0);state=api.relicChoiceState();assert(state.remaining===1&&state.choices.length===3&&api.inventory.equipped.filter(Boolean).length===1,"첫 번째 잔흔 선택 후 상태 오류");assert(state.choices.every(choice=>!firstChoices.includes(choice))&&state.rerolled.every(value=>!value),"첫 선택 후 후보 전체 리롤 또는 리롤 충전 실패");api.selectChoice(0);assert(api.inventory.equipped.filter(Boolean).length===2,"첫 석판에서 두 번째 잔흔 장착 실패");
      api.player.x=333;api.player.y=421;api.player.hp=1;api.damagePlayer(5);assertNear(api.player.hp,api.player.maxHp*.6,"첫 사망 부활 체력");assert(api.player.x===333&&api.player.y===421,"첫 사망 부활 위치가 변경됨");assert(api.runtimeSnapshot().playerReviveEffectUntil>api.getElapsed(),"부활 연출 시작 실패");api.setElapsed(1);api.player.hp=1;api.damagePlayer(5);state=api.relicChoiceState();assert(state.active&&state.remaining===2&&!state.firstComplete,"두 번째 사망 후 첫 석판 복귀 실패");assert(api.inventory.equipped.every(item=>!item)&&api.inventory.gear.every(item=>!item),"두 번째 사망 후 런 장비 초기화 실패");
    });

    test(pass,"무서운 이야기 처치 속박",()=>{
      api.equipGear(["frightening-story"]);const target=api.enemy({x:220,hp:1,maxHp:100}),other=api.enemy({x:300,hp:100,maxHp:100});api.hit(target,1,false,"magic");
      assertNear(other.hitStunUntil,1,"무서운 이야기 속박");
    });

    test(pass,"녹슨 동전 10회 대박 변환",()=>{
      api.equipGear(["rusted-coin"]);const target=api.enemy({hp:10000,maxHp:10000});Math.random=()=>.9999;for(let i=0;i<10;i++)api.hit(target,1,false,"magic");
      assert(api.inventory.gear.some(item=>item?.id==="gambling-king-charm"),"도박왕의 부적으로 변환되지 않음");
    });

    test(pass,"아무도 모르는 고서 단독 적",()=>{
      api.equipGear(["unknown-grimoire"]);const target=api.enemy({hp:1000,maxHp:1000});api.hit(target,100,false,"magic");assertNear(target.hp,830,"고서 마법 배율");
    });

    test(pass,"몰입의 비약 만료 초기화/처치 적중",()=>{
      api.equipGear(["focus-elixir"]);let target=api.enemy({hp:100,maxHp:100});api.hit(target,1,true,"basic");assertNear(api.stats().attackSpeed,1.05,"몰입 1중첩");
      api.setElapsed(3);api.hit(target,1,true,"basic");assert(api.gearRuntime.focusStacks===1,"만료 후 몰입 중첩이 초기화되지 않음");
      api.reset();api.equipGear(["focus-elixir"]);target=api.enemy({hp:1,maxHp:100});api.hit(target,1,true,"basic");assert(api.gearRuntime.focusStacks===1,"처치 적중에서 몰입 미발동");
    });

    test(pass,"공간 접개 대시 거리",()=>{
      api.equipGear(["space-expansion"]);api.player.dashTimer=.14;api.player.facing=1;const before=api.player.x;api.step(.1);assert(api.player.x-before>120,"공간 접개 대시 거리 증가 누락");
    });

    test(pass,"도박왕의 부적 마법 피해",()=>{
      api.equipGear(["gambling-king-charm"]);const target=api.enemy({hp:1000,maxHp:1000});Math.random=()=>0;api.hit(target,100,false,"magic");assertNear(target.hp,850,"도박왕의 부적 마법 최소 보너스");
    });

    test(pass,"부유함의 증거/상인 뱃지/검은 공명 골드 통합",()=>{
      api.equipGear(["proof-of-wealth","merchant-badge"]);api.equipRelics(["steady","vampirism"]);api.player.hp=100;api.setStageQueue([0]);api.loadStage();assert(api.player.gold===52,"맵 입장 골드 통합 배율 불일치");
    });

    test(pass,"피묻은 철조망 실제 접촉/쿨타임",()=>{
      api.equipGear(["bloody-barbed-wire"]);api.relicRuntime.shield=30;const target=api.enemy({x:120,y:492,hp:100,maxHp:100});api.wire();assertNear(target.hp,70,"철조망 접촉 피해");api.wire();assertNear(target.hp,70,"철조망 쿨타임");api.setElapsed(1.6);api.wire();assertNear(target.hp,40,"철조망 재발동");
    });

    test(pass,"만년 화로 전체 화상 전파",()=>{
      api.equipGear(["eternal-brazier"]);const source=api.enemy({x:220}),other=api.enemy({x:300});api.burn(source,6);assert(other.burnStacks===6,"화로가 전체 화상 수치를 전파하지 않음");
    });

    test(pass,"마력 순환 회로 처치 적중",()=>{
      api.equipGear(["mana-cycle"]);api.player.magicCooldown=3;const target=api.enemy({hp:1,maxHp:100});api.hit(target,1,true,"basic");assertNear(api.player.magicCooldown,2,"처치 적중 쿨다운 감소");
    });

    test(pass,"은빛 단검 대시 즉시 감지",()=>{
      api.equipGear(["silver-dagger"]);api.gearRuntime.dashHasteUntil=0;api.dash();assert(api.gearRuntime.dashHasteUntil===3,"대시 직후 은빛 단검 미발동");
    });

    test(pass,"현상수배지/핸드 카운터",()=>{
      api.equipGear(["wanted-poster","hand-counter"]);const target=api.enemy({hp:5000,maxHp:5000});for(let i=0;i<10;i++)api.hit(target,100,true,"basic");
      const expected=5000-(100+105+110+115+120+125+130+135+140+290);
      assertNear(target.hp,expected,"현상수배지 또는 핸드 카운터 누적");
    });

    test(pass,"당겨!!/기피증 순서·방향·상쇄",()=>{
      api.equipRelics(["repulsion","pull"]);const right=api.enemy({x:240,hp:1000,maxHp:1000});api.hit(right,1,false,"magic");assert(right.relicPushVelocity>0,"첫 장착 기피증 방향");api.hit(right,1,false,"magic");assert(right.relicPullTimer>0&&right.relicPushTimer===0,"당기기 전환 시 밀기 취소 실패");
      api.reset();api.player.facing=1;api.equipRelics(["repulsion"]);const left=api.enemy({x:20,hp:1000,maxHp:1000});api.hit(left,1,false,"magic");assert(left.relicPushVelocity<0,"플레이어 왼쪽 적을 잘못된 방향으로 밀침");
    });

    test(pass,"대마법사/관통탄/이중인격 마법 경로",()=>{
      api.equipRelics(["archmage"]);let bolt=api.castMagic();assertNear(bolt.life,3.1,"대마법사 사거리");
      api.reset();api.equipRelics(["piercing-shot"]);bolt=api.castMagic();assert(bolt.piercing,"관통탄 미적용");
      api.reset();api.equipRelics(["pull","repulsion","archmage"]);bolt=api.castMagic();assert(bolt.shockwave&&bolt.radius===900,"이중인격+대마법사 충격파");
    });

    test(pass,"차곡차곡 해제 시 비활성화",()=>{
      api.equipRelics(["steady"]);const target=api.enemy({hp:1,maxHp:100});api.hit(target,1,false,"magic");assertNear(api.relicStats().outgoingDamage,1.01,"차곡차곡 처치 중첩");api.equipRelics([]);assertNear(api.relicStats().outgoingDamage,1,"차곡차곡 해제 후 잔류");
    });

    test(pass,"살점 갑옷/보호막이 내가 된다",()=>{
      api.equipRelics(["flesh-armor"]);let target=api.enemy({hp:1,maxHp:200});api.hit(target,1,false,"magic");assertNear(api.relicRuntime.shield,20,"살점 갑옷");
      api.reset();api.equipRelics(["flesh-armor","shield-heart"]);const before=api.player.maxHp;target=api.enemy({hp:1,maxHp:200});api.hit(target,1,false,"magic");assertNear(api.player.maxHp,before+10,"보호막 최대 체력 전환");assertNear(api.relicRuntime.shield,0,"전환 후 보호막 잔류");
    });

    test(pass,"거인 직접 마법 추가 피해",()=>{
      api.equipRelics(["giant"]);const target=api.enemy({hp:1000,maxHp:1000});api.hit(target,10,false,"magic");assertNear(target.hp,960,"거인 마법 추가 피해");
    });

    test(pass,"거인 현재 체력 기준 추가 피해",()=>{
      api.equipRelics(["giant"]);api.player.hp=75;const target=api.enemy({hp:1000,maxHp:1000});api.hit(target,10,false,"magic");assertNear(target.hp,975,"거인 현재 체력 추가 피해");assert(api.relics.find(relic=>relic.id==="giant").effect.includes("현재 체력의 20%"),"거인 효과 툴팁 표기 불일치");
    });

    test(pass,"흡혈 회복 제한/초과 공격속도",()=>{
      api.equipRelics(["vampirism"]);api.player.hp=50;let target=api.enemy({hp:1,maxHp:100});api.hit(target,1,false,"magic");assertNear(api.player.hp,52,"흡혈 회복");assert(api.heal(20,"other")===0&&api.player.hp===52,"흡혈 외 회복 차단 실패");api.player.hp=api.player.maxHp;target=api.enemy({hp:1,maxHp:100});api.hit(target,1,false,"magic");assertNear(api.relicStats().attackSpeed,1.02,"초과 회복 공격속도 전환");api.equipRelics([]);assertNear(api.relicStats().attackSpeed,1,"흡혈 해제 후 공격속도 잔류");
    });

    test(pass,"유산 MP 증가/자연 회복 차단",()=>{
      api.equipRelics(["legacy"]);api.player.mp=80;api.player.maxMp=100;api.setStageQueue([0]);api.loadStage();assert(api.player.maxMp===120&&api.player.mp===120,"유산 맵 이동 효과");api.player.mp=50;api.step(1);assertNear(api.player.mp,50,"유산 외 MP 회복 차단");
    });

    test(pass,"색상 시너지 단계값",()=>{
      const red=structuredClone(relic("pull")),green=structuredClone(relic("giant")),black=structuredClone(relic("steady"));
      api.inventory.equipped.splice(0,4,red,structuredClone(red),null,null);assertNear(api.relicStats().basicDamage,1.5,"붉은색 2개");
      api.inventory.equipped.splice(0,4,green,structuredClone(green),structuredClone(green),structuredClone(green));assert(api.relicStats().maxHp===300,"녹색 4개");
      api.inventory.equipped.splice(0,4,black,structuredClone(black),structuredClone(black),structuredClone(black));assert(api.relicStats().maxHp===1&&api.relicStats().incomingDamage===1.5&&api.relicStats().goldGain===.5,"검은색 4개");
    });

    test(pass,"고서+부적+하늘색 공명 조합",()=>{
      api.equipGear(["magic-primer","unknown-grimoire","gambling-king-charm"]);api.equipRelics(["archmage","piercing-shot"]);const target=api.enemy({hp:1000,maxHp:1000});Math.random=()=>0;api.hit(target,30*api.stats().magicDamage,false,"magic");assertNear(target.hp,1000-30*1.05*1.5*1.7*1.5,"복합 마법 배율");
    });

    test(pass,"고정 피해 배율 오염 방지",()=>{
      api.equipGear(["gambling-king-charm"]);api.equipRelics(["steady"]);api.relicRuntime.steadyStacks=100;const target=api.enemy({hp:100,maxHp:100});Math.random=()=>0;api.hit(target,10,false,"ice");assertNear(target.hp,90,"고정 피해에 일반 배율이 적용됨");
    });

    test(pass,"살점 갑옷+철조망 연계",()=>{
      api.equipGear(["bloody-barbed-wire"]);api.equipRelics(["flesh-armor"]);let target=api.enemy({x:400,hp:1,maxHp:100});api.hit(target,1,false,"magic");assertNear(api.relicRuntime.shield,10,"살점 보호막 생성");target=api.enemy({x:120,y:492,hp:100,maxHp:100});api.wire();assertNear(target.hp,90,"생성 보호막 철조망 연계");
    });

    test(pass,"유산+마력 순환 회로 조합",()=>{
      api.equipGear(["mana-cycle"]);api.equipRelics(["legacy"]);api.player.mp=40;api.step(1);assertNear(api.player.mp,40,"유산 MP 잠금");api.player.magicCooldown=3;const target=api.enemy({hp:1,maxHp:100});api.hit(target,1,true,"basic");assertNear(api.player.magicCooldown,2,"유산 중 마력 순환 회로");
    });

    test(pass,"관리자 모드 런타임 완전 복원",()=>{
      api.setElapsed(42);const tracked=api.enemy({hp:100,maxHp:100});api.gearRuntime.focusStacks=7;api.gearRuntime.focusUntil=44;api.gearRuntime.coinJackpots=4;api.gearRuntime.lastTarget=tracked;api.gearRuntime.targetStacks=6;api.relicRuntime.steadyStacks=3;const before=api.runtimeSnapshot();api.openAdmin();api.gearRuntime.focusStacks=16;api.gearRuntime.coinJackpots=10;api.relicRuntime.steadyStacks=99;api.setElapsed(300);api.closeAdmin();const after=api.runtimeSnapshot();assert(after.elapsed===before.elapsed,"관리자 모드 elapsed 누출");assert(after.gearRuntime.focusStacks===7&&after.gearRuntime.coinJackpots===4,"관리자 장비 런타임 누출");assert(after.relicRuntime.steadyStacks===3,"관리자 잔흔 런타임 누출");assert(api.gearRuntime.lastTarget===api.enemies[0]&&api.gearRuntime.targetStacks===6,"관리자 현상수배 대상 복원 실패");
    });

    test(pass,"24종 장비 모든 2종 조합 무예외",()=>{
      Math.random=seededRandom(1000+pass);
      for(let i=0;i<api.equipment.length;i++)for(let j=i+1;j<api.equipment.length;j++){
        api.reset();api.equipGear([api.equipment[i].id,api.equipment[j].id]);const target=api.enemy({hp:100000,maxHp:100000});
        const stats=api.stats();assert(Object.values(stats).every(Number.isFinite),`${api.equipment[i].id}+${api.equipment[j].id} 비정상 능력치`);
        api.hit(target,10,true,"basic");api.hit(target,10,false,"magic");api.burn(target,1);assert(Number.isFinite(target.hp),`${api.equipment[i].id}+${api.equipment[j].id} 비정상 피해`);
      }
    });

    test(pass,"10종 잔흔 모든 2종 조합 무예외",()=>{
      for(let i=0;i<api.relics.length;i++)for(let j=i+1;j<api.relics.length;j++){
        api.reset();api.equipRelics([api.relics[i].id,api.relics[j].id]);const target=api.enemy({hp:100000,maxHp:100000});api.hit(target,10,true,"basic");api.hit(target,10,false,"magic");const stats=api.relicStats();assert(Object.values(stats).every(Number.isFinite),`${api.relics[i].id}+${api.relics[j].id} 비정상 능력치`);assert(Number.isFinite(target.hp),`${api.relics[i].id}+${api.relics[j].id} 비정상 피해`);
      }
    });

    test(pass,"장비 24종×잔흔 10종 교차 조합 무예외",()=>{
      Math.random=seededRandom(2000+pass);
      for(const item of api.equipment)for(const trace of api.relics){
        api.reset();api.equipGear([item.id]);api.equipRelics([trace.id]);const target=api.enemy({hp:100000,maxHp:100000});api.hit(target,10,true,"basic");api.hit(target,10,false,"magic");
        assert(Object.values(api.stats()).every(Number.isFinite),`${item.id}×${trace.id} 비정상 능력치`);assert(Number.isFinite(target.hp),`${item.id}×${trace.id} 비정상 피해`);
      }
    });
  }

  const failures=results.filter(result=>!result.ok),summary={passes:3,checks:results.length,passed:results.length-failures.length,failed:failures.length,failures};
  globalThis.__effectAuditResults=summary;
  const output=document.createElement("pre");output.id="effect-audit-results";output.style.cssText="position:fixed;z-index:9999;inset:12px;overflow:auto;margin:0;padding:18px;background:#071018;color:#d8edf3;font:13px/1.55 monospace;white-space:pre-wrap";output.textContent=JSON.stringify(summary,null,2);document.body.append(output);
  document.title=failures.length?`EFFECT AUDIT FAIL ${failures.length}`:`EFFECT AUDIT PASS ${summary.passed}`;
})();
