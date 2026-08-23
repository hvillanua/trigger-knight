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
   sfxbuttonpress.start(0,1);
   getURL("http://www.kongregate.com/?haref=triggerknight&src=spon-rpg-triggerknight-site-x", "_blank");
};
appstore_btn.onRelease = function()
{
   sfxbuttonpress.start(0,1);
   getURL("http://itunes.apple.com/us/app/trigger-knight/id500620156?mt=8", "_blank");
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
