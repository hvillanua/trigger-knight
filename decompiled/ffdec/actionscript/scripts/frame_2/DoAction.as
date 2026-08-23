function saveFile()
{
   trace("Game Saved!");
   savedata = SharedObject.getLocal("tksave","/");
   savedata.data.playersave = playerdata;
   savedata.flush();
}
function loadFile()
{
   trace("Game loaded!");
   loaddata = SharedObject.getLocal("tksave","/");
   playerdata = loaddata.data.playersave;
   trace(loaddata.data.playersave);
   trace(playerdata);
}
function newGame()
{
   playerdata = [[1,0,1,0,0,0,0],[1,0,0,0,0,0,0,0,0,0],[1,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0]];
}
function unlockAchievement(what)
{
   if(playerdata[3][what] == 0)
   {
      playerdata[3][what] = 1;
      announce2("CHALLENGE COMPLETED - " + achname[what]);
   }
}
function unlockWeapon(what)
{
   if(playerdata[1][what] == 0)
   {
      playerdata[1][what] = 1;
      announce2("Weapon Discovery : " + wepname[what + 1]);
   }
}
function unlockArmor(what)
{
   if(playerdata[2][what] == 0)
   {
      playerdata[2][what] = 1;
      announce2("Armor Discovery : " + armname[what + 1]);
   }
}
function initGame()
{
   trace("initiating game");
   if(retry == false)
   {
      bgmvol = 0;
      bgmgeneral.setVolume(0);
      bgmgame.start(0,9999);
   }
   tutstate = [false,false,false,false,false,false];
   showmenu = false;
   isbegin = false;
   ispaused = false;
   gameover = false;
   istuto = false;
   soulspawned = false;
   armorspawned = false;
   weaponspawned = false;
   dragonspawned = false;
   pregamedelay = 60;
   postgamedelay = 60;
   lose = false;
   gamestate = "running";
   disnow = 0;
   evarray = [0,0,0];
   pricearray = [0,0,0];
   encountercount = random(3);
   runscore = 0;
   isbattle = false;
   achcheck = false;
   lastchancerate = 40 + random(10);
   hasgivenchance = false;
   shakespeed = 0;
   shakedelay = 0;
   shakedir = 0;
   shaker = false;
   blurred = false;
   distance = 0;
   nextevent = 1000 + random(1000);
   movespeed = 0;
   maxspeed = 15;
   isevent = false;
   canact = false;
   hasact = false;
   eventx = 0;
   eventnow = 8;
   obarray = [];
   obqty = 0;
   gold = 300;
   pricenow = 0;
   disscore = 0;
   score = 0;
   elvl = 1;
   elvlnow = 1;
   weplvl = 1;
   armlvl = 1;
   xextension = 0;
   eqty = 0;
   fxqty = 0;
   damnumqty = 0;
   inthppos = 1;
   intinvpos = 1;
   intgoldpos = 1;
   intextpos = 1;
   intactpos = 1;
   intnextpos = 1;
   intscorepos = 1;
   intfriction = 4;
   expgain = 0;
   inventory = 1;
   existence = 99;
   existencedec = 99;
   randomizeEvent(0);
   randomizeEvent(1);
   randomizeEvent(2);
   this.ob.createEmptyMovieClip("game",1);
   this.ob.game._x = -100;
   this.createEmptyMovieClip("hud",2);
   this.ob.game.createEmptyMovieClip("bg",1);
   this.ob.game.createEmptyMovieClip("bdg",2);
   this.ob.game.createEmptyMovieClip("bgfx",3);
   this.ob.game.createEmptyMovieClip("spr",5);
   this.ob.game.createEmptyMovieClip("fx",6);
   this.ob.game.bg.attachMovie("BGFront","bgf1",6);
   this.ob.game.bg.attachMovie("BGFront","bgf2",7);
   this.ob.game.bg.bgf1._x = 0;
   this.ob.game.bg.bgf1._y = 170;
   this.ob.game.bg.bgf2._x = 960;
   this.ob.game.bg.bgf2._y = 170;
   this.ob.game.bg.attachMovie("BGMid","bgm1",3);
   this.ob.game.bg.attachMovie("BGMid","bgm2",4);
   this.ob.game.bg.bgm1._x = 0;
   this.ob.game.bg.bgm1._y = 60;
   this.ob.game.bg.bgm2._x = 960;
   this.ob.game.bg.bgm2._y = 60;
   this.ob.game.bg.attachMovie("BGBack","bgb1",1);
   this.ob.game.bg.attachMovie("BGBack","bgb2",2);
   this.ob.game.bg.bgb1._x = 0;
   this.ob.game.bg.bgb1._y = 0;
   this.ob.game.bg.bgb2._x = 960;
   this.ob.game.bg.bgb2._y = 0;
   initInterface();
   spawnSprite("chara");
}
function showTutorial(what)
{
   if(what != 0)
   {
      if(playerdata[0][5] == 0)
      {
         if(tutstate[what] == false)
         {
            tutstate[what] = true;
            this.hud.attachMovie("PanelTutorial","paneltut",15);
            this.hud.paneltut._x = 10;
            this.hud.paneltut._y = 10;
            this.hud.paneltut._alpha = 0;
            this.hud.paneltut.gotoAndStop(what + 1);
            pauseGame(true);
            istuto = true;
            sfxnotice.start(0,1);
         }
      }
   }
   else
   {
      tutstate[what] = true;
      this.hud.attachMovie("PanelTutorial","paneltut",15);
      this.hud.paneltut._x = 10;
      this.hud.paneltut._y = 10;
      this.hud.paneltut._alpha = 0;
      this.hud.paneltut.gotoAndStop(what + 1);
      pauseGame(true);
      istuto = true;
      sfxnotice.start(0,1);
   }
}
function bgmFade()
{
   if(bgmmuted == false)
   {
      if(bgmvol < 90)
      {
         bgmvol++;
         bgmgeneral.setVolume(bgmvol);
      }
   }
   else if(bgmvol > 0)
   {
      bgmvol--;
      bgmgeneral.setVolume(bgmvol);
   }
}
function buttonInput()
{
   if(Key.isDown(77) && inputarray[0] == false)
   {
      inputarray[0] = true;
      if(bgmmuted == true)
      {
         bgmmuted = false;
      }
      else
      {
         bgmmuted = true;
      }
   }
   else if(!Key.isDown(77) && inputarray[0] == true)
   {
      inputarray[0] = false;
   }
   if(Key.isDown(83) && inputarray[1] == false)
   {
      inputarray[1] = true;
      if(sfxmuted == true)
      {
         sfxmuted = false;
         sfxgeneral.setVolume(100);
      }
      else if(sfxmuted == false)
      {
         sfxmuted = true;
         sfxgeneral.setVolume(0);
      }
   }
   else if(!Key.isDown(83) && inputarray[1] == true)
   {
      inputarray[1] = false;
   }
   if(Key.isDown(80) && inputarray[2] == false)
   {
      inputarray[2] = true;
      if(screenstate == "game" && isbegin == true)
      {
         if(ispaused == false)
         {
            intendedpause = true;
            pauseGame(true);
         }
         else if(intendedpause == true)
         {
            pauseGame(false);
            intendedpause = false;
         }
      }
   }
   else if(!Key.isDown(80) && inputarray[2] == true)
   {
      inputarray[2] = false;
   }
}
function updateCursor()
{
   this.cur._x = _xmouse;
   this.cur._y = _ymouse;
   if(screenstate == "game")
   {
      if(gamestate != "end")
      {
         if(ispaused == false)
         {
            if(isbattle == true)
            {
               if(inventory != 0)
               {
                  this.cur.gotoAndStop(3);
                  this.cur.event_txt.text = "Battle";
                  switch(inventory)
                  {
                     case 1:
                        this.cur.action_txt.text = "Use Elixir";
                        this.cur.price_txt.text = "Restore HP";
                        break;
                     case 2:
                        this.cur.action_txt.text = "Use Divine Edge";
                        this.cur.price_txt.text = "10000% Damage";
                        break;
                     case 3:
                        this.cur.action_txt.text = "Use Gold Voucher";
                        this.cur.price_txt.text = "1000% Gold";
                  }
               }
               else
               {
                  this.cur.gotoAndStop(2);
                  this.cur.event_txt.text = "";
                  this.cur.action_txt.text = "No Action";
                  this.cur.price_txt.text = "";
               }
            }
            else if(canact == true && hasact == false)
            {
               switch(eventnow)
               {
                  case 1:
                     this.cur.event_txt.text = "Bladesmith";
                     this.cur.action_txt.text = "Upgrade Weapon";
                     this.cur.price_txt.text = pricenow + "G";
                     break;
                  case 2:
                     this.cur.event_txt.text = "Armorsmith";
                     this.cur.action_txt.text = "Upgrade Armor";
                     this.cur.price_txt.text = pricenow + "G";
                     break;
                  case 3:
                     this.cur.event_txt.text = "Soulshrine";
                     this.cur.action_txt.text = "Restores Lifespan";
                     this.cur.price_txt.text = pricenow + "G";
                     break;
                  case 4:
                     this.cur.event_txt.text = "Pharmacy";
                     if(inventory != 0)
                     {
                        this.cur.action_txt.text = "Replaces " + itemname[inventory] + " w/ Elixir";
                     }
                     else
                     {
                        this.cur.action_txt.text = "Buy Elixir";
                     }
                     this.cur.price_txt.text = pricenow + "G";
                     break;
                  case 5:
                     this.cur.event_txt.text = "Grim\'s Shop";
                     if(inventory != 0)
                     {
                        this.cur.action_txt.text = "Replaces " + itemname[inventory] + " w/ Divine Edge";
                     }
                     else
                     {
                        this.cur.action_txt.text = "Buy Divine Edge";
                     }
                     this.cur.price_txt.text = pricenow + "G";
                     break;
                  case 6:
                     this.cur.event_txt.text = "Voucher Store";
                     if(inventory != 0)
                     {
                        this.cur.action_txt.text = "Replaces " + itemname[inventory] + " w/ Gold Ticket";
                     }
                     else
                     {
                        this.cur.action_txt.text = "Buy Gold Ticket";
                     }
                     this.cur.price_txt.text = pricenow + "G";
               }
               if(gold < pricenow)
               {
                  this.cur.gotoAndStop(2);
                  this.cur.price_txt.text += " (Insufficient)";
               }
               else if(eventnow == 1)
               {
                  if(weplvl >= 10)
                  {
                     this.cur.gotoAndStop(2);
                     this.cur.price_txt.text += " (LV MAX)";
                  }
                  else
                  {
                     this.cur.gotoAndStop(3);
                  }
               }
               else if(eventnow == 2)
               {
                  if(armlvl >= 10)
                  {
                     this.cur.gotoAndStop(2);
                     this.cur.price_txt.text += " (LV MAX)";
                  }
                  else
                  {
                     this.cur.gotoAndStop(3);
                  }
               }
               else
               {
                  this.cur.gotoAndStop(3);
               }
            }
            else
            {
               this.cur.gotoAndStop(2);
               this.cur.event_txt.text = "";
               this.cur.action_txt.text = "No Action!";
               this.cur.price_txt.text = "";
            }
         }
         else
         {
            this.cur.gotoAndStop(1);
         }
      }
      else
      {
         this.cur.gotoAndStop(1);
      }
   }
   else
   {
      this.cur.gotoAndStop(1);
   }
}
function initInterface()
{
   this.hud.attachMovie("InterfaceBottom","intbot",1);
   this.hud.intbot._x = 0;
   this.hud.intbot._y = intboty[1];
   this.hud.attachMovie("InterfaceAvatar","intava",3);
   this.hud.intava._x = intavax[1];
   this.hud.intava._y = 325;
   this.hud.attachMovie("InterfaceLifespan2","intlif",4);
   this.hud.intlif._x = 160;
   this.hud.intlif._y = intlify[1];
   this.hud.attachMovie("InterfaceGold","intgold",5);
   this.hud.intgold._x = intgoldx[1];
   this.hud.intgold._y = 2;
   this.hud.attachMovie("InterfaceNext","intnext",6);
   this.hud.intnext._x = intnextx[1];
   this.hud.intnext._y = 35;
   this.hud.attachMovie("InterfaceEnemyHP","intehp",7);
   this.hud.intehp._x = 100;
   this.hud.intehp._y = 100;
   this.hud.intehp._visible = false;
}
function useItem()
{
   emitFX("item",this.ob.game.spr.hero._x,this.ob.game.spr.hero._y);
   switch(inventory)
   {
      case 1:
         this.ob.game.spr.hero.hp = this.ob.game.spr.hero.maxhp;
         break;
      case 2:
         this.ob.game.spr.hero.atkfactor = 100;
         break;
      case 3:
         this.ob.game.spr.enemy.gold *= 10;
   }
   sfxitemuse.start(0,1);
   inventory = 0;
}
function startBattle()
{
   showTutorial(3);
   sfxbattlestart.start(0,1);
   this.ob.game.spr.hero.attackdelay = 0;
   this.ob.game.spr.hero.atkfactor = 1;
   isbattle = true;
   gamestate = "battling";
   this.ob.game.spr.hero.state = "idle";
   switch(inventory)
   {
      case 1:
         announce("You can use Elixir to heal HP!",3);
         break;
      case 2:
         announce("You can use Divine Edge to multiply the damage!",4);
         break;
      case 3:
         announce("You can use Gold Ticket to multiply gold reward!",5);
         break;
      case 4:
      default:
         return;
   }
}
function spawnSprite(what)
{
   switch(what)
   {
      case "chara":
         this.ob.game.spr.attachMovie("Hero","hero",1);
         this.ob.game.spr.hero._x = 50;
         this.ob.game.spr.hero._y = 200;
         this.ob.game.spr.hero.fact = 0;
         this.ob.game.spr.hero.mspd = 10;
         this.ob.game.spr.hero.maxhp = armlvl * armorrate + armorbase;
         this.ob.game.spr.hero.hp = this.ob.game.spr.hero.maxhp;
         this.ob.game.spr.hero.atk = weplvl * weaponrate + weaponbase;
         this.ob.game.spr.hero.atkfactor = 1;
         this.ob.game.spr.hero.numattack = 0;
         this.ob.game.spr.hero.xtar = random(100) + 50;
         this.ob.game.spr.hero.ytar = random(15) + 200;
         this.ob.game.spr.hero.xtarchange = tarchangedelay + random(30);
         this.ob.game.spr.hero.ytarchange = tarchangedelay + random(30);
         this.ob.game.spr.hero.state = "idle";
         this.ob.game.spr.hero.attackdelay = 0;
         this.ob.game.spr.hero.attackfinished = false;
         this.ob.game.spr.hero.attacktarget = 0;
         this.ob.game.spr.hero.knockback = 0;
         obarray.push("hero");
         break;
      case "enemy0":
         this.ob.game.spr.attachMovie("EnemyGoblin","enemy",100);
         this.ob.game.spr.enemy.etype = 0;
         this.ob.game.spr.enemy._x = 600;
         this.ob.game.spr.enemy._xscale = -100;
         this.ob.game.spr.enemy._y = 200 + random(15);
         this.ob.game.spr.enemy.fact = 1;
         this.ob.game.spr.enemy.mspd = 10;
         this.ob.game.spr.enemy.maxhp = elvl * 60 + 600;
         this.ob.game.spr.enemy.hp = this.ob.game.spr.enemy.maxhp;
         this.ob.game.spr.enemy.atk = elvl * 40 + 82;
         this.ob.game.spr.enemy.atkfactor = 1;
         this.ob.game.spr.enemy.numattack = 0;
         this.ob.game.spr.enemy.gold = elvl * 12 + 70;
         this.ob.game.spr.enemy.exp = 10 + elvl * 3;
         this.ob.game.spr.enemy.state = "idle";
         this.ob.game.spr.enemy.attackdelay = 0;
         this.ob.game.spr.enemy.attackfinished = false;
         this.ob.game.spr.enemy.attacktarget = 0;
         this.ob.game.spr.enemy.knockback = 0;
         obarray.push("enemy");
         break;
      case "enemy1":
         this.ob.game.spr.attachMovie("EnemyGolem","enemy",100);
         this.ob.game.spr.enemy.etype = 1;
         this.ob.game.spr.enemy._x = 600;
         this.ob.game.spr.enemy._xscale = -100;
         this.ob.game.spr.enemy._y = 200 + random(15);
         this.ob.game.spr.enemy.fact = 1;
         this.ob.game.spr.enemy.mspd = 10;
         this.ob.game.spr.enemy.maxhp = elvl * 120 + 860;
         this.ob.game.spr.enemy.hp = this.ob.game.spr.enemy.maxhp;
         this.ob.game.spr.enemy.atk = elvl * 28 + 40;
         this.ob.game.spr.enemy.atkfactor = 1;
         this.ob.game.spr.enemy.numattack = 0;
         this.ob.game.spr.enemy.gold = elvl * 14 + 78;
         this.ob.game.spr.enemy.exp = 9 + elvl * 4;
         this.ob.game.spr.enemy.state = "idle";
         this.ob.game.spr.enemy.attackdelay = 0;
         this.ob.game.spr.enemy.attackfinished = false;
         this.ob.game.spr.enemy.attacktarget = 0;
         this.ob.game.spr.enemy.knockback = 0;
         obarray.push("enemy");
         break;
      case "enemy2":
         this.ob.game.spr.attachMovie("EnemyWolf","enemy",100);
         this.ob.game.spr.enemy.etype = 2;
         this.ob.game.spr.enemy._x = 600;
         this.ob.game.spr.enemy._xscale = -100;
         this.ob.game.spr.enemy._y = 200 + random(15);
         this.ob.game.spr.enemy.fact = 1;
         this.ob.game.spr.enemy.mspd = 10;
         this.ob.game.spr.enemy.maxhp = elvl * 44 + 450;
         this.ob.game.spr.enemy.hp = this.ob.game.spr.enemy.maxhp;
         this.ob.game.spr.enemy.atk = elvl * 56 + 94;
         this.ob.game.spr.enemy.atkfactor = 1;
         this.ob.game.spr.enemy.numattack = 0;
         this.ob.game.spr.enemy.gold = elvl * 14 + 78;
         this.ob.game.spr.enemy.exp = 8 + elvl * 5;
         this.ob.game.spr.enemy.state = "idle";
         this.ob.game.spr.enemy.attackdelay = 0;
         this.ob.game.spr.enemy.attackfinished = false;
         this.ob.game.spr.enemy.attacktarget = 0;
         this.ob.game.spr.enemy.knockback = 0;
         obarray.push("enemy");
         break;
      case "enemy3":
         this.ob.game.spr.attachMovie("EnemyDragon","enemy",100);
         this.ob.game.spr.enemy.etype = 3;
         this.ob.game.spr.enemy._x = 600;
         this.ob.game.spr.enemy._xscale = -100;
         this.ob.game.spr.enemy._y = 200 + random(15);
         this.ob.game.spr.enemy.fact = 1;
         this.ob.game.spr.enemy.mspd = 10;
         this.ob.game.spr.enemy.maxhp = elvl * 300 + 2400;
         this.ob.game.spr.enemy.hp = this.ob.game.spr.enemy.maxhp;
         this.ob.game.spr.enemy.atk = elvl * 80 + 160;
         this.ob.game.spr.enemy.atkfactor = 1;
         this.ob.game.spr.enemy.numattack = 0;
         this.ob.game.spr.enemy.gold = elvl * 60 + 350;
         this.ob.game.spr.enemy.exp = 40 + elvl * 25;
         this.ob.game.spr.enemy.state = "idle";
         this.ob.game.spr.enemy.attackdelay = 0;
         this.ob.game.spr.enemy.attackfinished = false;
         this.ob.game.spr.enemy.attacktarget = 0;
         this.ob.game.spr.enemy.knockback = 0;
         obarray.push("enemy");
      default:
         return;
   }
}
function announce(what, avatar)
{
   this.hud.attachMovie("InterfaceAnnounce2","intann",2);
   this.hud.intann._x = 0;
   this.hud.intann._y = 235;
   this.hud.intann.msg = what;
   this.hud.intann.avanow = avatar;
}
function announce2(what)
{
   this.hud.attachMovie("InterfaceAnnounce","intann2",8);
   this.hud.intann2._x = 0;
   this.hud.intann2._y = 150;
   this.hud.intann2.annmes = what;
}
function randomizeEvent(what)
{
   if(encountercount <= 0)
   {
      encountercount = random(3) + 1;
      evarray[what] = 7;
      pricearray[what] = 0;
      weaponspawned = false;
      armorspawned = false;
      soulspawned = false;
      if(elvl < 7 || dragonspawned == true)
      {
         enow = random(3);
      }
      else
      {
         randnum = random(100);
         if(randnum < 3 * (elvl - 7) && dragonspawned == false)
         {
            enow = 3;
            dragonspawned = true;
         }
         else
         {
            enow = random(3);
         }
      }
   }
   else if(existence < lastchancerate && hasgivenchance == false && soulspawned == false)
   {
      evarray[what] = 3;
      pricearray[what] = extbaseprice + xextension * extpricerate;
      lastchancerate = 40 + random(10);
      hasgivenchance = true;
      encountercount--;
   }
   else
   {
      randnum = random(100);
      if(randnum > 65)
      {
         if(weaponspawned == true)
         {
            randomizeEvent(what);
         }
         else
         {
            evarray[what] = 1;
            pricearray[what] = weaponbaseprice + weplvl * weaponpricerate;
            weaponspawned = true;
            encountercount--;
         }
      }
      else if(randnum > 30)
      {
         if(armorspawned == true)
         {
            randomizeEvent(what);
         }
         else
         {
            evarray[what] = 2;
            pricearray[what] = armorbaseprice + armlvl * armorpricerate;
            armorspawned = true;
            encountercount--;
         }
      }
      else if(randnum > 25)
      {
         if(soulspawned == true)
         {
            randomizeEvent(what);
         }
         else
         {
            evarray[what] = 3;
            pricearray[what] = extbaseprice + xextension * extpricerate;
            soulspawned = true;
            encountercount--;
         }
      }
      else if(randnum > 10)
      {
         evarray[what] = 4;
         pricearray[what] = pharmacybaseprice;
         encountercount--;
      }
      else if(randnum > 5)
      {
         evarray[what] = 5;
         pricearray[what] = heraldrybaseprice;
         encountercount--;
      }
      else if(elvl < 4)
      {
         randomizeEvent(what);
      }
      else
      {
         evarray[what] = 6;
         pricearray[what] = voucherbaseprice;
         encountercount--;
      }
   }
}
function spawnEvent()
{
   nextevent = eventdelay + random(300);
   trace("Event!");
   if(evarray[0] == 7)
   {
      isevent = true;
      eventnow = evarray[0];
      pricenow = 0;
      spawnSprite("enemy" + enow);
      if(enow != 3)
      {
         dragonspawned = false;
      }
      else
      {
         enow = random(3);
      }
      eventx = 600;
   }
   else
   {
      sfxevent.start(0,1);
      isevent = true;
      hasact = false;
      eventnow = evarray[0];
      if(eventnow != 7 && eventnow != 3)
      {
         showTutorial(1);
      }
      else if(eventnow == 3)
      {
         showTutorial(2);
      }
      pricenow = pricearray[0];
      this.ob.game.bg.attachMovie("Building","evtbdg",5);
      this.ob.game.bg.evtbdg._x = 600;
      this.ob.game.bg.evtbdg._y = 170;
      eventx = 600;
   }
   evarray[0] = evarray[1];
   evarray[1] = evarray[2];
   pricearray[0] = pricearray[1];
   pricearray[1] = pricearray[2];
   randomizeEvent(2);
   trace(evarray);
   trace(pricearray);
}
function zSort()
{
   i = 0;
   while(i < obarray.length)
   {
      this.ob.game.spr[obarray[i]].swapDepths(this.ob.game.spr[obarray[i]]._y + this.ob.game.spr[obarray[i]]._x / 100);
      i++;
   }
}
function checkExistence()
{
   existencedec -= extrate;
   if(existencedec <= 0)
   {
      existencedec = 99;
      existence--;
      if(existence < 0)
      {
         gamestate = "end";
         isbegin = false;
         isbattle = false;
         isevent = false;
         gameover = true;
         if(blurred == false)
         {
            sfxcharadie.start(0,1);
            blurred = true;
            lose = true;
            pauseGame(true);
            this.hud.attachMovie("InterfaceDead","intdead",11);
            this.hud.intdead.msg1 = "Your lifespan reaches 0%";
            randomizeTip();
         }
      }
   }
   if(existence < 25)
   {
      if(this.ob.game.spr.hero.state != "dead" && gamestate == "running")
      {
         showTutorial(4);
         this.ob.game.spr.hero._alpha = Math.round((existence * 100 + existencedec) / 2500 * 100);
      }
   }
   else if(this.ob.game.spr.hero.state != "dead" && gamestate == "running")
   {
      this.ob.game.spr.hero._alpha = 100;
   }
}
function randomizeTip()
{
   randnum = random(tippool.length);
   this.hud.intdead.msg2 = "Protip " + tippool[randnum];
}
function updateEnemyLevel()
{
   elvl = Math.floor(distance / 7000) + 1;
   if(elvlnow != elvl)
   {
      _root.kongregateStats.submit("Day",elvl);
      elvlnow = elvl;
   }
   if(elvl >= 10 && achcheck == false)
   {
      achcheck = true;
      unlockAchievement(2);
   }
}
function updateInterface()
{
   if(showmenu == false)
   {
      intbotpos = 1;
      intavapos = 1;
      intlifpos = 1;
      intgoldpos = 1;
      intnextpos = 1;
      this.hud.intehp._visible = false;
   }
   else
   {
      intbotpos = 0;
      intavapos = 0;
      intlifpos = 0;
      intgoldpos = 0;
      intnextpos = 0;
      if(isbattle == true)
      {
         this.hud.intehp._visible = true;
         this.hud.intehp._x = this.ob.game.spr.enemy._x;
         this.hud.intehp._y = this.ob.game.spr.enemy._y - 70;
         this.hud.intehp.hpbar._xscale = Math.round(this.ob.game.spr.enemy.hp / this.ob.game.spr.enemy.maxhp * 100);
         if(this.hud.intehp.hpbarshade._xscale > this.hud.intehp.hpbar._xscale)
         {
            this.hud.intehp.hpbarshade._xscale -= 2;
         }
         else
         {
            this.hud.intehp.hpbarshade._xscale = this.hud.intehp.hpbar._xscale;
         }
      }
      else
      {
         this.hud.intehp._visible = false;
      }
   }
   this.hud.intbot.hpbarmask._xscale = this.ob.game.spr.hero.hp / this.ob.game.spr.hero.maxhp * 100;
   this.hud.intbot.hp_txt.text = this.ob.game.spr.hero.hp + "/" + this.ob.game.spr.hero.maxhp;
   this.hud.intbot.wep_txt.text = wepname[weplvl] + " [" + this.ob.game.spr.hero.atk + " ATK]";
   this.hud.intbot.arm_txt.text = armname[armlvl];
   this.hud.intbot.score_txt.text = score;
   this.hud.intbot.day_txt.text = elvl;
   switch(inventory)
   {
      case 0:
         this.hud.intbot.item_txt.text = "-";
         break;
      case 1:
         this.hud.intbot.item_txt.text = "Elixir";
         break;
      case 2:
         this.hud.intbot.item_txt.text = "Divine Edge";
         break;
      case 3:
         this.hud.intbot.item_txt.text = "Gold Voucher";
   }
   this.hud.intlif.lifespanbarmask._xscale = (existence * 100 + existencedec) / 9999 * 100;
   this.hud.intlif.life_txt.text = existence;
   this.hud.intlif.lifedec_txt.text = existencedec;
   this.hud.intgold.gold_txt.text = gold + "G";
   if(isevent == true)
   {
      this.hud.intnext.iconnow.gotoAndStop(eventnow);
   }
   else
   {
      this.hud.intnext.iconnow.gotoAndStop(8);
   }
   if(pricenow == 0)
   {
      this.hud.intnext.iconnow.price_txt.text = "";
   }
   else if(isevent == true)
   {
      this.hud.intnext.iconnow.price_txt.text = pricenow + "G";
   }
   else
   {
      this.hud.intnext.iconnow.price_txt.text = "";
   }
   this.hud.intnext.icon0.gotoAndStop(evarray[0]);
   if(pricearray[0] == 0)
   {
      this.hud.intnext.icon0.price_txt.text = "";
   }
   else
   {
      this.hud.intnext.icon0.price_txt.text = pricearray[0] + "G";
   }
   this.hud.intnext.icon1.gotoAndStop(evarray[1]);
   if(pricearray[1] == 0)
   {
      this.hud.intnext.icon1.price_txt.text = "";
   }
   else
   {
      this.hud.intnext.icon1.price_txt.text = pricearray[1] + "G";
   }
   this.hud.intnext.icon2.gotoAndStop(evarray[2]);
   if(pricearray[2] == 0)
   {
      this.hud.intnext.icon2.price_txt.text = "";
   }
   else
   {
      this.hud.intnext.icon2.price_txt.text = pricearray[2] + "G";
   }
   this.hud.intbot._y += (intboty[intbotpos] - this.hud.intbot._y) / intfriction;
   this.hud.intava._x += (intavax[intavapos] - this.hud.intava._x) / intfriction;
   this.hud.intlif._y += (intlify[intlifpos] - this.hud.intlif._y) / intfriction;
   this.hud.intgold._x += (intgoldx[intgoldpos] - this.hud.intgold._x) / intfriction;
   this.hud.intnext._x += (intnextx[intnextpos] - this.hud.intnext._x) / intfriction;
}
function updateEvent()
{
   if(isevent == true)
   {
      if(eventnow != 7)
      {
         eventx -= movespeed / 2;
         this.ob.game.bg.evtbdg._x = eventx;
         if(eventx < availrange && eventx > unavailrange)
         {
            canact = true;
         }
         else
         {
            canact = false;
         }
         if(eventx < -100)
         {
            this.ob.game.bg.evtbdg.removeMovieClip();
            isevent = false;
         }
      }
      else
      {
         eventx -= movespeed;
         this.ob.game.spr.enemy._x = eventx;
         if(eventx < availrange)
         {
            startBattle();
            trace("elvl:" + elvl);
         }
      }
   }
}
function animeChara()
{
   i = 0;
   while(i < obarray.length)
   {
      if(this.ob.game.spr[obarray[i]].state == "idle")
      {
         if(this.ob.game.spr[obarray[i]].animestate != "idling")
         {
            this.ob.game.spr[obarray[i]].gotoAndPlay("idle");
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "move")
      {
         if(this.ob.game.spr[obarray[i]].animestate != "moving")
         {
            this.ob.game.spr[obarray[i]].gotoAndPlay("move");
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "attack")
      {
         if(this.ob.game.spr[obarray[i]].animestate != "attacking")
         {
            this.ob.game.spr[obarray[i]].gotoAndPlay("attack");
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "flinch")
      {
         if(this.ob.game.spr[obarray[i]].animestate != "flinching")
         {
            this.ob.game.spr[obarray[i]].gotoAndPlay("flinch");
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "dead")
      {
      }
      i++;
   }
}
function pauseGame(what)
{
   if(what == true)
   {
      ispaused = true;
      this.ob.game.filters = blurfilter;
      i = 0;
      while(i < obarray.length)
      {
         this.ob.game.spr[obarray[i]].stop();
         i++;
      }
      if(intendedpause == true)
      {
         this.hud.attachMovie("InterfacePause","intpau",11);
         this.hud.intann.removeMovieClip();
         this.hud.intann2.removeMovieClip();
         this.hud.intpau.resume_btn.onRollOver = function()
         {
            sfxbuttonselect.start(0,1);
         };
         this.hud.intpau.quit_btn.onRollOver = function()
         {
            sfxbuttonselect.start(0,1);
         };
         this.hud.intpau.resume_btn.onRelease = function()
         {
            pauseGame(false);
            intendedpause = false;
            sfxbuttonpress.start(0,1);
         };
         this.hud.intpau.quit_btn.onRelease = function()
         {
            this._parent._parent._parent.gotoAndStop("score");
            this._parent._parent.removeMovieClip();
            sfxbuttonpress.start(0,1);
         };
      }
   }
   else if(what == false)
   {
      ispaused = false;
      this.ob.game.filters = nofilter;
      i = 0;
      while(i < obarray.length)
      {
         this.ob.game.spr[obarray[i]].play();
         i++;
      }
      if(intendedpause == true)
      {
         this.hud.intpau.removeMovieClip();
      }
   }
}
function mainLoop()
{
   this.ob.game._x -= this.ob.game._x / 30;
   if(isbegin == true)
   {
      if(ispaused == false)
      {
         showmenu = true;
         if(gamestate == "running")
         {
            this.ob.game.spr.hero.state = "move";
            if(movespeed < maxspeed)
            {
               movespeed++;
            }
            distance += movespeed;
            score += movespeed * 10 * playerdata[0][2];
            nextevent -= movespeed;
            if(nextevent <= 0)
            {
               spawnEvent();
            }
            this.ob.game.spr.hero._x += (this.ob.game.spr.hero.xtar - this.ob.game.spr.hero._x) / 20;
            this.ob.game.spr.hero._y += (this.ob.game.spr.hero.ytar - this.ob.game.spr.hero._y) / 20;
            this.ob.game.spr.hero.xtarchange--;
            if(this.ob.game.spr.hero.xtarchange <= 0)
            {
               this.ob.game.spr.hero.xtarchange = tarchangedelay + random(30);
               this.ob.game.spr.hero.xtar = random(100) + 50;
            }
            this.ob.game.spr.hero.ytarchange--;
            if(this.ob.game.spr.hero.ytarchange <= 0)
            {
               this.ob.game.spr.hero.ytarchange = tarchangedelay + random(30);
               this.ob.game.spr.hero.ytar = random(15) + 200;
            }
            updateEnemyLevel();
            updateEvent();
         }
         else if(gamestate == "battling")
         {
            if(movespeed > 0)
            {
               movespeed--;
            }
            checkBattle();
            behaveAI();
         }
         else if(gamestate != "tutorial")
         {
            if(gamestate == "end")
            {
               isbegin = false;
               isbattle = false;
               ispaused = false;
            }
         }
         zSort();
         bgScroll();
         checkExistence();
      }
      else
      {
         showmenu = false;
         if(istuto == true)
         {
            if(this.hud.paneltut._alpha < 100)
            {
               this.hud.paneltut._alpha += 10;
            }
         }
      }
   }
   else
   {
      showmenu = false;
      if(gameover == false)
      {
         pregamedelay--;
         if(pregamedelay <= 0 && isbegin == false)
         {
            showTutorial(0);
            pregamedelay--;
            isbegin = true;
         }
      }
      else
      {
         postgamedelay--;
         if(postgamedelay <= 0)
         {
            if(blurred == false)
            {
               sfxcharadie.start(0,1);
               blurred = true;
               lose = true;
               pauseGame(true);
               this.hud.attachMovie("InterfaceDead","intdead",11);
               this.hud.intdead.msg1 = "You are killed by the enemy.";
               randomizeTip();
            }
         }
      }
   }
   animeChara();
   screenShake();
   updateInterface();
}
function behaveAI()
{
   i = 0;
   while(i < obarray.length)
   {
      if(this.ob.game.spr[obarray[i]].state == "idle")
      {
         this.ob.game.spr[obarray[i]].attackfinished = false;
         this.ob.game.spr[obarray[i]].attackdelay--;
         if(this.ob.game.spr[obarray[i]].attackdelay <= 0)
         {
            this.ob.game.spr[obarray[i]].state = "move";
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "move")
      {
         enemyinrange = false;
         j = 0;
         while(j < obarray.length)
         {
            if(this.ob.game.spr[obarray[j]].fact != this.ob.game.spr[obarray[i]].fact)
            {
               if(Math.abs(this.ob.game.spr[obarray[i]]._x - this.ob.game.spr[obarray[j]]._x) < 30)
               {
                  enemyinrange = true;
                  this.ob.game.spr[obarray[i]].attacktarget = j;
                  this.ob.game.spr[obarray[i]].state = "attack";
               }
            }
            j++;
         }
         if(enemyinrange == false)
         {
            if(this.ob.game.spr[obarray[i]].fact == 0)
            {
               this.ob.game.spr[obarray[i]]._x += this.ob.game.spr[obarray[i]].mspd;
            }
            else if(this.ob.game.spr[obarray[i]].fact == 1)
            {
               this.ob.game.spr[obarray[i]]._x -= this.ob.game.spr[obarray[i]].mspd;
            }
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "attack")
      {
         enemyinrange = true;
         if(enemyinrange == true)
         {
            if(this.ob.game.spr[obarray[i]].ishit == true)
            {
               trace("fak yea!");
               attackChara(i,this.ob.game.spr[obarray[i]].attacktarget);
               this.ob.game.spr[obarray[i]].ishit = false;
            }
            if(this.ob.game.spr[obarray[i]].attackfinished == true)
            {
               if(this.ob.game.spr[obarray[i]].attackdelay <= 0)
               {
                  if(this.ob.game.spr[obarray[i]].fact == 0)
                  {
                     this.ob.game.spr[obarray[i]].attackdelay = random(24) + this.ob.game.spr[obarray[i]].numattack * 4;
                  }
                  else
                  {
                     this.ob.game.spr[obarray[i]].attackdelay = random(24) + this.ob.game.spr[obarray[i]].numattack * 12;
                  }
                  this.ob.game.spr[obarray[i]].state = "idle";
               }
            }
         }
         else
         {
            this.ob.game.spr[obarray[i]].state = "move";
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "flinch")
      {
         this.ob.game.spr[obarray[i]].ishit = false;
         if(this.ob.game.spr[obarray[i]].fact == 0)
         {
            this.ob.game.spr[obarray[i]]._x -= this.ob.game.spr[obarray[i]].knockback;
            if(this.ob.game.spr[obarray[i]]._x <= 10)
            {
               this.ob.game.spr[obarray[i]].knockback = 0;
            }
         }
         else if(this.ob.game.spr[obarray[i]].fact == 1)
         {
            this.ob.game.spr[obarray[i]]._x += this.ob.game.spr[obarray[i]].knockback;
            if(this.ob.game.spr[obarray[i]]._x >= 470)
            {
               this.ob.game.spr[obarray[i]].knockback = 0;
            }
         }
         this.ob.game.spr[obarray[i]].knockback *= 0.8;
         if(this.ob.game.spr[obarray[i]].knockback < 1)
         {
            this.ob.game.spr[obarray[i]].state = "idle";
         }
      }
      else if(this.ob.game.spr[obarray[i]].state == "dead")
      {
         if(this.ob.game.spr[obarray[i]].fact == 0)
         {
            this.ob.game.spr[obarray[i]]._x -= this.ob.game.spr[obarray[i]].knockback;
         }
         else if(this.ob.game.spr[obarray[i]].fact == 1)
         {
            this.ob.game.spr[obarray[i]]._x += this.ob.game.spr[obarray[i]].knockback;
         }
         if(this.ob.game.spr[obarray[i]].knockback > 0)
         {
            this.ob.game.spr[obarray[i]].knockback--;
         }
         if(this.ob.game.spr[obarray[i]]._alpha > 0)
         {
            this.ob.game.spr[obarray[i]]._alpha -= 10;
         }
         else if(this.ob.game.spr[obarray[i]]._alpha <= 0)
         {
            if(this.ob.game.spr[obarray[i]].fact == 1)
            {
               isbattle = false;
               isevent = false;
               gamestate = "running";
               if(this.ob.game.spr[obarray[i]].etype == 3)
               {
                  unlockAchievement(0);
                  _root.kongregateStats.submit("HasKilledDragon",playerdata[3][0]);
                  _root.kongregateStats.submit("DragonKilled",1);
               }
               gold += this.ob.game.spr[obarray[i]].gold;
               if(gold >= 3000)
               {
                  unlockAchievement(1);
               }
               expgain += this.ob.game.spr[obarray[i]].exp;
               showInfo(":: Got " + this.ob.game.spr[obarray[i]].gold + "G!");
               score += this.ob.game.spr[obarray[i]].maxhp * 10 + this.ob.game.spr[obarray[i]].atk * 60 * playerdata[0][2];
               this.ob.game.spr[obarray[i]].removeMovieClip();
               dispose = obarray.splice(i,1);
               sfxeventtriggered.start(0,1);
            }
            else
            {
               gamestate = "end";
               isbegin = false;
               isbattle = false;
               isevent = false;
               gameover = true;
            }
         }
      }
      i++;
   }
}
function emitFX(what, whatx, whaty)
{
   switch(what)
   {
      case "hit":
         this.ob.game.fx.attachMovie("FXHit","fx" + fxqty,fxqty);
         break;
      case "item":
         this.ob.game.fx.attachMovie("FXItem","fx" + fxqty,fxqty);
         break;
      case "upgrade":
         this.ob.game.fx.attachMovie("FXUpgrade","fx" + fxqty,fxqty);
         break;
      case "buy":
         this.ob.game.fx.attachMovie("FXBuy","fx" + fxqty,fxqty);
   }
   this.ob.game.fx["fx" + fxqty]._x = whatx;
   this.ob.game.fx["fx" + fxqty]._xscale = 150;
   this.ob.game.fx["fx" + fxqty]._yscale = 150;
   this.ob.game.fx["fx" + fxqty]._y = whaty - 30;
   fxqty++;
   if(fxqty > 100)
   {
      fxqty = 0;
   }
}
function showInfo(what)
{
   trace(what);
   this.hud.attachMovie("InterfaceInfo","intinf",9);
   this.hud.intinf._x = 0;
   this.hud.intinf._y = 50;
   this.hud.intinf.report_mc.report_txt.text = what;
}
function getGold()
{
}
function attackChara(attacker, attacked)
{
   this.ob.game.spr[obarray[attacked]].state = "flinch";
   this.ob.game.spr[obarray[attacked]].knockback = 10 + random(7);
   this.ob.game.spr[obarray[attacker]].numattack++;
   this.ob.game.spr[obarray[attacked]].numattack = 0;
   emitFX("hit",this.ob.game.spr[obarray[attacked]]._x,this.ob.game.spr[obarray[attacked]]._y);
   damage = this.ob.game.spr[obarray[attacker]].atk * this.ob.game.spr[obarray[attacker]].atkfactor;
   damage += Math.round(random(20) / 100 * damage);
   iscrit = false;
   if(this.ob.game.spr[obarray[attacker]].fact == 0)
   {
      randnum = random(100) + 1;
      if(randnum > 90)
      {
         damage *= 2;
         iscrit = true;
      }
   }
   if(damage >= 70000)
   {
      unlockAchievement(4);
   }
   shakespeed = 6;
   shakedelay = 0;
   shaker = true;
   randnum = random(3);
   if(randnum == 0)
   {
      sfxhit01.start(0,1);
   }
   else if(randnum == 1)
   {
      sfxhit02.start(0,1);
   }
   else if(randnum == 2)
   {
      sfxhit03.start(0,1);
   }
   this.hud.attachMovie("DamageNum","d" + damnumqty,damnumqty + 100);
   this.hud["d" + damnumqty]._x = this.ob.game.spr[obarray[attacked]]._x;
   this.hud["d" + damnumqty]._y = this.ob.game.spr[obarray[attacked]]._y - 30;
   this.hud["d" + damnumqty].damnum_mc.damage_txt.text = damage;
   if(iscrit == true)
   {
      this.hud["d" + damnumqty].damnum_mc.damage_txt.text += "!!";
   }
   if(damnumqty > 50)
   {
      damnumqty = 0;
   }
   this.ob.game.spr[obarray[attacked]].hp -= damage;
   if(this.ob.game.spr[obarray[attacked]].hp / this.ob.game.spr[obarray[attacked]].maxhp * 100 < 25)
   {
      if(this.ob.game.spr[obarray[attacked]].fact == 0)
      {
         showTutorial(5);
      }
   }
   if(this.ob.game.spr[obarray[attacked]].hp <= 0)
   {
      this.ob.game.spr[obarray[attacked]].hp = 0;
      shakespeed = 14;
      shakedelay = 0;
      shaker = true;
      this.ob.game.spr[obarray[attacked]].state = "dead";
      this.ob.game.spr[obarray[attacker]].attackdelay = 600;
      sfxenemydie.start(0,1);
   }
   else
   {
      shakespeed = 6;
      shakedelay = 0;
      shaker = true;
   }
}
function screenShake()
{
   if(shaker == true)
   {
      shakedelay++;
      if(shakedelay >= 1)
      {
         shakedelay = 0;
         if(shakespeed > 0)
         {
            if(shakedir == 0)
            {
               this.ob._x += shakespeed;
               this.ob._y += shakespeed;
               shakedir = 1;
            }
            else if(shakedir == 1)
            {
               this.ob._x -= shakespeed;
               this.ob._y -= shakespeed;
               shakespeed--;
               shakedir = 0;
            }
         }
         else
         {
            this.ob._x = 0;
            this.ob._y = 0;
            shaker = false;
         }
      }
   }
}
function bgScroll()
{
   this.ob.game.bg.bgb1._x -= movespeed / 10;
   this.ob.game.bg.bgb2._x -= movespeed / 10;
   if(this.ob.game.bg.bgb1._x < -960)
   {
      this.ob.game.bg.bgb1._x = this.ob.game.bg.bgb2._x + 960 - movespeed;
   }
   if(this.ob.game.bg.bgb2._x < -960)
   {
      this.ob.game.bg.bgb2._x = this.ob.game.bg.bgb1._x + 960 - movespeed;
   }
   this.ob.game.bg.bgm1._x -= movespeed / 5;
   this.ob.game.bg.bgm2._x -= movespeed / 5;
   if(this.ob.game.bg.bgm1._x < -960)
   {
      this.ob.game.bg.bgm1._x = this.ob.game.bg.bgm2._x + 960 - movespeed;
   }
   if(this.ob.game.bg.bgm2._x < -960)
   {
      this.ob.game.bg.bgm2._x = this.ob.game.bg.bgm1._x + 960 - movespeed;
   }
   this.ob.game.bg.bgf1._x -= movespeed;
   this.ob.game.bg.bgf2._x -= movespeed;
   if(this.ob.game.bg.bgf1._x < -960)
   {
      this.ob.game.bg.bgf1._x = this.ob.game.bg.bgf2._x + 960 - movespeed;
   }
   if(this.ob.game.bg.bgf2._x < -960)
   {
      this.ob.game.bg.bgf2._x = this.ob.game.bg.bgf1._x + 960 - movespeed;
   }
}
function actEvent(what)
{
   if(gold >= pricenow)
   {
      switch(what)
      {
         case 1:
            if(weplvl < 10)
            {
               weplvl++;
               this.ob.game.spr.hero.atk = weplvl * weaponrate + weaponbase;
               announce("Upgrade : " + wepname[weplvl - 1] + " > " + wepname[weplvl],1);
               gold -= pricenow;
               hasact = true;
               showInfo(":: Lost " + pricenow + "G!");
               this.attachMovie("MouseEffect","me",99);
               this.me._x = _xmouse;
               this.me._y = _ymouse;
               sfxeventtriggered.start(0,1);
               emitFX("upgrade",this.ob.game.spr.hero._x,this.ob.game.spr.hero._y);
               unlockWeapon(weplvl - 1);
               _root.kongregateStats.submit("WeaponUnlocked",weplvl);
               unlockall = true;
               i = 0;
               while(i < 10)
               {
                  if(playerdata[1][i] == 0)
                  {
                     unlockall = false;
                  }
                  i++;
               }
               i = 0;
               while(i < 10)
               {
                  if(playerdata[2][i] == 0)
                  {
                     unlockall = false;
                  }
                  i++;
               }
               if(unlockall == true)
               {
                  unlockAchievement(3);
               }
            }
            break;
         case 2:
            if(armlvl < 10)
            {
               armlvl++;
               this.ob.game.spr.hero.maxhp = armlvl * armorrate + armorbase;
               this.ob.game.spr.hero.hp = this.ob.game.spr.hero.maxhp;
               announce("Upgrade : " + armname[armlvl - 1] + " > " + armname[armlvl],2);
               gold -= pricenow;
               hasact = true;
               showInfo(":: Lost " + pricenow + "G!");
               this.attachMovie("MouseEffect","me",99);
               this.me._x = _xmouse;
               this.me._y = _ymouse;
               sfxeventtriggered.start(0,1);
               emitFX("upgrade",this.ob.game.spr.hero._x,this.ob.game.spr.hero._y);
               unlockArmor(armlvl - 1);
               _root.kongregateStats.submit("ArmorUnlocked",armlvl);
               unlockall = true;
               i = 0;
               while(i < 10)
               {
                  if(playerdata[1][i] == 0)
                  {
                     unlockall = false;
                  }
                  i++;
               }
               i = 0;
               while(i < 10)
               {
                  if(playerdata[2][i] == 0)
                  {
                     unlockall = false;
                  }
                  i++;
               }
               if(unlockall == true)
               {
                  unlockAchievement(3);
               }
            }
            break;
         case 3:
            xextension++;
            existence = 99;
            existencedec = 99;
            hasgivenchance = false;
            this.attachMovie("Effect-Flash","ef",3);
            gold -= pricenow;
            hasact = true;
            showInfo(":: Lost " + pricenow + "G!");
            this.attachMovie("MouseEffect","me",99);
            this.me._x = _xmouse;
            this.me._y = _ymouse;
            sfxeventtriggered.start(0,1);
            break;
         case 4:
            inventory = 1;
            announce("Bought : Potion",3);
            gold -= pricenow;
            hasact = true;
            showInfo(":: Lost " + pricenow + "G!");
            this.attachMovie("MouseEffect","me",99);
            this.me._x = _xmouse;
            this.me._y = _ymouse;
            sfxeventtriggered.start(0,1);
            emitFX("buy",this.ob.game.spr.hero._x,this.ob.game.spr.hero._y);
            break;
         case 5:
            inventory = 2;
            announce("Bought : Divine Edge",4);
            gold -= pricenow;
            hasact = true;
            showInfo(":: Lost " + pricenow + "G!");
            this.attachMovie("MouseEffect","me",99);
            this.me._x = _xmouse;
            this.me._y = _ymouse;
            sfxeventtriggered.start(0,1);
            emitFX("buy",this.ob.game.spr.hero._x,this.ob.game.spr.hero._y);
            break;
         case 6:
            inventory = 3;
            announce("Bought : Gold Voucher",5);
            gold -= pricenow;
            hasact = true;
            showInfo(":: Lost " + pricenow + "G!");
            this.attachMovie("MouseEffect","me",99);
            this.me._x = _xmouse;
            this.me._y = _ymouse;
            sfxeventtriggered.start(0,1);
            emitFX("buy",this.ob.game.spr.hero._x,this.ob.game.spr.hero._y);
      }
   }
   else
   {
      sfxerror.start(0,1);
   }
}
function randomize(whatentry)
{
}
trace("db included!");
var inthpx = [8,-300];
var intinvx = [15,-300];
var intgoldx = [10,-150];
var intexty = [280,500];
var intacty = [250,350];
var intnextx = [290,500];
var intscorex = [340,500];
var intboty = [250,350];
var intavax = [20,-100];
var intlify = [10,-50];
var tarchangedelay = 60;
var eventdelay = 1500;
var availrange = 420;
var unavailrange = 0;
var weaponbase = 129;
var weaponrate = 87;
var armorbase = 1009;
var armorrate = 899;
var weaponbaseprice = 200;
var weaponpricerate = 36;
var armorbaseprice = 150;
var armorpricerate = 54;
var extbaseprice = 50;
var extpricerate = 70;
var pharmacybaseprice = 150;
var heraldrybaseprice = 200;
var voucherbaseprice = 500;
var extrate = 4;
var expbase = 100;
var expfactor = 30;
wepname = new Array();
armname = new Array();
itemname = new Array();
achname = new Array();
wepname[0] = "Barehand";
wepname[1] = "Dagger";
wepname[2] = "Sword";
wepname[3] = "Rapier";
wepname[4] = "Falchion";
wepname[5] = "Katana";
wepname[6] = "Flamberge";
wepname[7] = "Zweihander";
wepname[8] = "Broad Kris";
wepname[9] = "Excalibur";
wepname[10] = "Astral Sword";
armname[0] = "Barebody";
armname[1] = "Clothing";
armname[2] = "Protector";
armname[3] = "Breastplate";
armname[4] = "Chainmail";
armname[5] = "Fullplate";
armname[6] = "Samurai Mail";
armname[7] = "Valkyrie Garb";
armname[8] = "Odin Garb";
armname[9] = "Avalon";
armname[10] = "Astral Armor";
achname[0] = "Slay a Dragon!";
achname[1] = "Stashed 3000 Gold!";
achname[2] = "Reach Day #10!";
achname[3] = "Got All Collection!";
achname[4] = "70000+ Damage!";
itemname[0] = "Empty";
itemname[1] = "Elixir";
itemname[2] = "Divine Edge";
itemname[3] = "Gold Voucher";
tippool = ["#01 People die if they are killed.","#02 Replenish lifespan at the Soulshrine!","#03 Your HP recovers when upgrading armor.","#04 If only you can Insta-kill those Dragons...","#05 Press M to mute music.","#06 Press S to mute sound.","#07 Enemies level up each day.","#08 Purchase Gold Voucher for quick wealth.","#09 Press P to pause the game.","#10 Use elixir to replenish your HP!","#11 Dragon appears starting from Day 8.","#12 Higher level, higher score.","#13 Need more damage? Purchase Divine Edge!","#14 Believe in protips!","#15 Support the developers!","#16 This game doesn\'t suck!","#17 Keep losing? Try again.","#18 Perhaps you CAN win the game. Perhaps not.","#19 Keep running!","#20 Play STING\'s games. They\'re good.","#21 Upgrade weapon to increase damage.","#22 There are 22 Protips in total."];
trace("source included!");
_quality = "HIGH";
var blurX = 10;
var blurY = 10;
var quality = 3;
var blur = new flash.filters.BlurFilter(blurX,blurY,quality);
var blurfilter = new Array();
var nofilter = new Array();
blurfilter.push(blur);
this.createEmptyMovieClip("bgm",1000);
this.createEmptyMovieClip("sfx",999);
this.createEmptyMovieClip("voiceg",998);
this.createEmptyMovieClip("voiceb",997);
bgmvol = 0;
bgmgeneral = new Sound(this.bgm);
bgmgame = new Sound(this.bgm);
bgmgame.attachSound("BGMGame");
bgmscore = new Sound(this.bgm);
bgmscore.attachSound("BGMScore");
sfxgeneral = new Sound(this.sfx);
sfxapplause = new Sound(this.sfx);
sfxapplause.attachSound("SFXApplause");
sfxbattlestart = new Sound(this.sfx);
sfxbattlestart.attachSound("SFXBattleStart");
sfxbuttonpress = new Sound(this.sfx);
sfxbuttonpress.attachSound("SFXButtonPress");
sfxbuttonselect = new Sound(this.sfx);
sfxbuttonselect.attachSound("SFXButtonSelect");
sfxcharadie = new Sound(this.sfx);
sfxcharadie.attachSound("SFXCharaDie");
sfxenemydie = new Sound(this.sfx);
sfxenemydie.attachSound("SFXEnemyDie");
sfxerror = new Sound(this.sfx);
sfxerror.attachSound("SFXError");
sfxevent = new Sound(this.sfx);
sfxevent.attachSound("SFXEvent");
sfxeventtriggered = new Sound(this.sfx);
sfxeventtriggered.attachSound("SFXEventTriggered");
sfxexploop = new Sound(this.sfx);
sfxexploop.attachSound("SFXEXPLoop");
sfxhit01 = new Sound(this.sfx);
sfxhit01.attachSound("SFXHit01");
sfxhit02 = new Sound(this.sfx);
sfxhit02.attachSound("SFXHit02");
sfxhit03 = new Sound(this.sfx);
sfxhit03.attachSound("SFXHit03");
sfxitemuse = new Sound(this.sfx);
sfxitemuse.attachSound("SFXItemUse");
sfxnotice = new Sound(this.sfx);
sfxnotice.attachSound("SFXNotice");
Mouse.hide();
this.attachMovie("Cursor","cur",100);
inputarray = [false,false,false];
bgmmuted = false;
sfxmuted = false;
intendedpause = false;
this.onMouseDown = function()
{
   Mouse.hide();
   if(screenstate == "achievement")
   {
      sfxstartbutton.start(0,1);
      if(screenbefore == "title")
      {
         this.gotoAndStop("title");
      }
      else if(screenbefore == "score")
      {
         this.gotoAndStop("score");
      }
   }
   else if(screenstate == "credits")
   {
      this.gotoAndStop("title");
   }
   else if(screenstate == "game")
   {
      if(ispaused == false)
      {
         if(isevent == true)
         {
            if(isbattle == true)
            {
               if(inventory != 0)
               {
                  useItem();
                  this.attachMovie("MouseEffect","me",99);
                  this.me._x = _xmouse;
                  this.me._y = _ymouse;
               }
               else
               {
                  sfxerror.start(0,1);
               }
            }
            else if(canact == true && hasact == false)
            {
               actEvent(eventnow);
            }
            else
            {
               sfxerror.start(0,1);
            }
         }
         else
         {
            sfxerror.start(0,1);
         }
      }
      if(lose == true)
      {
         this.gotoAndStop("score");
         this.hud.removeMovieClip();
      }
      if(istuto == true)
      {
         sfxbuttonpress.start(0,1);
         istuto = false;
         this.hud.paneltut.removeMovieClip();
         pauseGame(false);
      }
   }
   if(screenstate == "score")
   {
   }
};
this.onEnterFrame = function()
{
   if(screenstate == "title")
   {
      sil._y -= sil._y / 4;
      silmask._x += (10 - silmask._x) / 4;
      logo._x += (480 - logo._x) / 4;
      if(buttonstate == 0)
      {
         start_btn._x += (460 - start_btn._x) / 3;
         achievement_btn._x += (460 - achievement_btn._x) / 4;
         credits_btn._x += (460 - credits_btn._x) / 5;
         moregames_btn._x += (460 - moregames_btn._x) / 6;
      }
      else if(buttonstate != 1)
      {
         if(buttonstate != 2)
         {
            if(buttonstate == 3)
            {
            }
         }
      }
   }
   else if(screenstate == "achievement")
   {
      levelelement.level_txt.text = "Level " + playerdata[0][0] + " (x" + playerdata[0][2] + " Score)";
      nextlvl = expbase + playerdata[0][0] * expfactor;
      levelelement.exp_txt.text = playerdata[0][1] + "/" + nextlvl + " EXP";
      levelelement.expbar._xscale = Math.round(playerdata[0][1] / nextlvl * 100);
      if(levelelement.expbar._xscale < 1)
      {
         levelelement.expbar._xscale = 1;
      }
      i = 1;
      while(i <= 10)
      {
         if(cur.sensor.hitTest(this["wpn" + i]))
         {
            if(playerdata[1][i - 1] == 1)
            {
               trace("True!");
               equip_txt.text = "Lv" + i + " - " + wepname[i];
            }
         }
         i++;
      }
      i = 1;
      while(i <= 10)
      {
         if(cur.sensor.hitTest(this["arm" + i]))
         {
            if(playerdata[2][i - 1] == 1)
            {
               trace("True!");
               equip_txt.text = "Lv" + i + " - " + armname[i];
            }
         }
         i++;
      }
   }
   else if(screenstate == "game")
   {
      mainLoop();
   }
   else if(screenstate == "score")
   {
      silhouette._x += (- silhouette._x) / 4;
      if(disscore < score)
      {
         disscore += Math.round(score / 90);
      }
      if(disscore > score)
      {
         disscore = score;
      }
      score_txt.text = disscore;
      if(disscore > playerdata[0][6])
      {
         playerdata[0][6] = disscore;
         if(newhigh == false)
         {
            newhigh = true;
         }
      }
      if(newhigh == true)
      {
         trace("fuckyeah!");
         highscoreanim._visible = true;
      }
      else
      {
         highscoreanim._visible = false;
      }
      if(expgain > 3)
      {
         playerdata[0][1] += 3;
         expgain -= 3;
      }
      else if(expgain > 0)
      {
         playerdata[0][1] += expgain;
         expgain = 0;
      }
      nextlvl = expbase + playerdata[0][0] * expfactor;
      if(playerdata[0][1] > nextlvl)
      {
         playerdata[0][0] += 1;
         playerdata[0][1] = 0;
         playerdata[0][2] = 1 + playerdata[0][0] / 10;
      }
      levelelement._y += (10 - levelelement._y) / 4;
      levelelement.level_txt.text = "Level " + playerdata[0][0] + " (x" + playerdata[0][2] + " Score)";
      levelelement.exp_txt.text = playerdata[0][1] + "/" + nextlvl + " EXP";
      levelelement.expbar._xscale = Math.round(playerdata[0][1] / nextlvl * 100);
      if(levelelement.expbar._xscale < 1)
      {
         levelelement.expbar._xscale = 1;
      }
      if(expgain == 0 && disscore == score)
      {
         donecounting = true;
         retry_btn.enabled = true;
         retry_btn._visible = true;
         end_btn.enabled = true;
         end_btn._visible = true;
         achievement_btn.enabled = true;
         achievement_btn._visible = true;
         moregames_btn.enabled = true;
         moregames_btn._visible = true;
      }
      else
      {
         donecounting = false;
         retry_btn.enabled = false;
         retry_btn._visible = false;
         end_btn.enabled = false;
         end_btn._visible = false;
         achievement_btn.enabled = false;
         achievement_btn._visible = false;
         moregames_btn.enabled = false;
         moregames_btn._visible = false;
      }
      if(donecounting == false)
      {
         sfxexploop.start(0,1);
      }
      else if(issaved == false)
      {
         _root.kongregateStats.submit("Level",playerdata[0][0]);
         saveFile();
         issaved = true;
      }
      highscore_txt.text = "Highscore : " + playerdata[0][6];
   }
   buttonInput();
   bgmFade();
   updateCursor();
};
stop();
