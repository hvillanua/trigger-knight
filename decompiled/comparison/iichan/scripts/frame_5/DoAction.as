function §\x04\x05§()
{
   set("\x03",2742 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = -568 + "\x04\x05"();
while(true)
{
   if(eval("\x01") == 367)
   {
      set("\x01",eval("\x01") - 71);
      §§push(true);
   }
   else if(eval("\x01") == 74)
   {
      set("\x01",eval("\x01") - 19);
   }
   else if(eval("\x01") == 818)
   {
      set("\x01",eval("\x01") - 251);
      var §§pop() = §§pop();
   }
   else if(eval("\x01") == 428)
   {
      set("\x01",eval("\x01") + 167);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 216);
      }
   }
   else if(eval("\x01") == 296)
   {
      set("\x01",eval("\x01") - 110);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 387);
      }
   }
   else if(eval("\x01") == 595)
   {
      set("\x01",eval("\x01") + 216);
   }
   else if(eval("\x01") == 164)
   {
      set("\x01",eval("\x01") + 264);
      §§push(!§§pop());
   }
   else
   {
      if(eval("\x01") == 186)
      {
         set("\x01",eval("\x01") + 387);
         §§push(mbord(new §\§\§pop()§()));
         break;
      }
      if(eval("\x01") == 573)
      {
         set("\x01",eval("\x01") - 518);
      }
      else if(eval("\x01") == 451)
      {
         set("\x01",eval("\x01") - 287);
         §§push(eval(§§pop()));
      }
      else if(eval("\x01") == 55)
      {
         set("\x01",eval("\x01") + 763);
         §§push("\x0f");
         §§push(1);
      }
      else
      {
         if(eval("\x01") != 567)
         {
            if(eval("\x01") == 811)
            {
               set("\x01",eval("\x01") - 186);
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
               break;
            }
            if(eval("\x01") == 625)
            {
               set("\x01",eval("\x01") - 625);
            }
            break;
         }
         set("\x01",eval("\x01") - 116);
         §§push("\x0f");
      }
   }
}
