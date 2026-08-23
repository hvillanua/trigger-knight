function §\x04\x05§()
{
   set("\x03",1508 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = -1861 + "\x04\x05"();
while(true)
{
   if(eval("\x01") == 569)
   {
      set("\x01",eval("\x01") + 422);
      §§push(true);
   }
   else if(eval("\x01") == 271)
   {
      set("\x01",eval("\x01") + 509);
      §§push("\x0f");
      §§push(1);
   }
   else if(eval("\x01") == 291)
   {
      set("\x01",eval("\x01") - 20);
   }
   else if(eval("\x01") == 451)
   {
      set("\x01",eval("\x01") - 180);
   }
   else if(eval("\x01") == 780)
   {
      set("\x01",eval("\x01") - 652);
      var §§pop() = §§pop();
   }
   else if(eval("\x01") == 868)
   {
      set("\x01",eval("\x01") + 79);
      §§push(!§§pop());
   }
   else if(eval("\x01") == 991)
   {
      set("\x01",eval("\x01") - 577);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 37);
      }
   }
   else if(eval("\x01") == 937)
   {
      set("\x01",eval("\x01") - 69);
      §§push(eval(§§pop()));
   }
   else if(eval("\x01") == 128)
   {
      set("\x01",eval("\x01") + 809);
      §§push("\x0f");
   }
   else
   {
      if(eval("\x01") == 414)
      {
         set("\x01",eval("\x01") + 37);
         toggleHighQuality();
         call(§§pop());
         break;
      }
      if(eval("\x01") == 947)
      {
         set("\x01",eval("\x01") - 236);
         if(§§pop())
         {
            set("\x01",eval("\x01") + 35);
         }
      }
      else
      {
         if(eval("\x01") != 711)
         {
            if(eval("\x01") == 746)
            {
               set("\x01",eval("\x01") - 590);
               screenstate = "title";
               this.attachMovie("TransWhite","ts",3);
               buttonstate = 0;
               start_btn.enabled = true;
               achievement_btn.enabled = true;
               tuto_rb.gotoAndStop(playerdata[0][5] + 1);
               screenbefore = "title";
               stop();
               loadFile();
               if(playerdata[0][0] == undefined)
               {
                  trace("Player data not found; initiating data!");
                  newGame();
                  saveFile();
               }
               start_btn.onRollOver = function()
               {
                  sfxbuttonselect.start(0,1);
               };
               achievement_btn.onRollOver = function()
               {
                  sfxbuttonselect.start(0,1);
               };
               credits_btn.onRollOver = function()
               {
                  sfxbuttonselect.start(0,1);
               };
               moregames_btn.onRollOver = function()
               {
                  sfxbuttonselect.start(0,1);
               };
               tutorial_btn.onRollOver = function()
               {
                  sfxbuttonselect.start(0,1);
               };
               start_btn.onRelease = function()
               {
                  retry = false;
                  bgmgeneral.setVolume(0);
                  sfxbuttonpress.start(0,1);
                  start_btn.enabled = false;
                  attachMovie("TransitionBattle","tb",3);
               };
               achievement_btn.onRelease = function()
               {
                  sfxbuttonpress.start(0,1);
                  gotoAndStop("achievement");
               };
               credits_btn.onRelease = function()
               {
                  sfxbuttonpress.start(0,1);
                  gotoAndStop("credits");
               };
               moregames_btn.onRelease = function()
               {
                  getURL("http://www.kongregate.com/?haref=triggerknight&src=spon-rpg-triggerknight-site-x", "_blank");
               };
               tutorial_btn.onRelease = function()
               {
                  sfxbuttonpress.start(0,1);
                  if(playerdata[0][5] == 0)
                  {
                     playerdata[0][5] = 1;
                  }
                  else
                  {
                     playerdata[0][5] = 0;
                  }
                  tuto_rb.gotoAndStop(playerdata[0][5] + 1);
               };
               break;
            }
            if(eval("\x01") == 156)
            {
               set("\x01",eval("\x01") - 156);
            }
            break;
         }
         set("\x01",eval("\x01") + 35);
      }
   }
}
