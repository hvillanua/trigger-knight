screenstate = "achievement";
this.attachMovie("TransBlack","tb",3);
buttonstate = 0;
stop();
i = 0;
while(i < 10)
{
   inow = i + 1;
   this["wpn" + inow].gotoAndStop(playerdata[1][i] + 1);
   trace("p:" + playerdata[1][i]);
   i++;
}
i = 0;
while(i < 10)
{
   inow = i + 1;
   this["arm" + inow].gotoAndStop(playerdata[2][i] + 1);
   i++;
}
i = 0;
while(i < 6)
{
   this["ach" + i].gotoAndStop(playerdata[3][i] + 1);
   i++;
}
wepcalc = 0;
armcalc = 0;
achcalc = 0;
progresscalc = 0;
i = 0;
while(i < 10)
{
   wepcalc += playerdata[1][i];
   i++;
}
i = 0;
while(i < 10)
{
   armcalc += playerdata[2][i];
   i++;
}
i = 0;
while(i < 5)
{
   achcalc += playerdata[3][i];
   i++;
}
progresscalc = (wepcalc + armcalc) * 3.5 + achcalc * 6;
gameprogress_txt.text = "Game Progress - " + progresscalc + "%";
_root.kongregateStats.submit("WeaponUnlocked",armcalc);
_root.kongregateStats.submit("WeaponUnlocked",wepcalc);
_root.kongregateStats.submit("Level",playerdata[0][0]);
_root.kongregateStats.submit("HasKilledDragon",playerdata[3][0]);
_root.kongregateStats.submit("GameProgress",progresscalc);
