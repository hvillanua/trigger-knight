screenstate = "score";
screenbefore = "score";
this.attachMovie("TransBlack","tb",3);
scoreover = 0;
stop();
retry_btn.enabled = true;
end_btn.enabled = true;
playerdata[0][5] = 1;
issaved = false;
newhigh = false;
sfxapplause.start(0,1);
retry_btn.onRollOver = function()
{
   sfxbuttonselect.start(0,1);
};
achievement_btn.onRollOver = function()
{
   sfxbuttonselect.start(0,1);
};
end_btn.onRollOver = function()
{
   sfxbuttonselect.start(0,1);
};
moregames_btn.onRollOver = function()
{
   sfxbuttonselect.start(0,1);
};
retry_btn.onRelease = function()
{
   retry = true;
   sfxgeneral.stop();
   sfxbuttonpress.start(0,1);
   retry_btn.enabled = false;
   attachMovie("TransitionBattle","tb",3);
};
end_btn.onRelease = function()
{
   sfxgeneral.stop();
   bgmgeneral.stop();
   sfxbuttonpress.start(0,1);
   gotoAndStop("title");
};
achievement_btn.onRelease = function()
{
   sfxgeneral.stop();
   sfxbuttonpress.start(0,1);
   gotoAndStop("achievement");
};
moregames_btn.onRelease = function()
{
   sfxbuttonpress.start(0,1);
   getURL("http://www.kongregate.com/?haref=triggerknight&src=spon-rpg-triggerknight-site-x", "_blank");
};
tweet_btn.onRelease = function()
{
   sfxbuttonpress.start(0,1);
   urlnow = "http://twitter.com/?status=I+got+" + score + "+points+on+Trigger+Knight!+Play+it+at+http%3A%2F%2Fgoo.gl%2FJkbwh+%23TKnight";
   getURL(urlnow,"_blank");
};
_root.kongregateStats.submit("Score",score);
_root.kongregateStats.submit("HasKilledDragon",playerdata[3][0]);
