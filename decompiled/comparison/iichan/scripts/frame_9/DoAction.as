function §\x04\x05§()
{
   set("\x03",1534 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = 409 + "\x04\x05"();
while(true)
{
   if(eval("\x01") == 414)
   {
      set("\x01",eval("\x01") + 566);
      §§push(true);
   }
   else if(eval("\x01") == 980)
   {
      set("\x01",eval("\x01") - 830);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 769);
      }
   }
   else if(eval("\x01") == 37)
   {
      set("\x01",eval("\x01") + 74);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 629);
      }
   }
   else if(eval("\x01") == 544)
   {
      set("\x01",eval("\x01") + 242);
      §§push(eval(§§pop()));
   }
   else if(eval("\x01") == 786)
   {
      set("\x01",eval("\x01") - 749);
      §§push(!§§pop());
   }
   else if(eval("\x01") == 431)
   {
      set("\x01",eval("\x01") + 113);
      §§push("\x0f");
   }
   else
   {
      if(eval("\x01") == 150)
      {
         set("\x01",eval("\x01") + 769);
         break;
      }
      if(eval("\x01") == 224)
      {
         set("\x01",eval("\x01") + 207);
         var §§pop() = §§pop();
      }
      else if(eval("\x01") == 362)
      {
         set("\x01",eval("\x01") - 138);
         §§push("\x0f");
         §§push(1);
      }
      else if(eval("\x01") == 919)
      {
         set("\x01",eval("\x01") - 557);
      }
      else if(eval("\x01") == 710)
      {
         set("\x01",eval("\x01") - 348);
      }
      else
      {
         if(eval("\x01") != 111)
         {
            if(eval("\x01") == 740)
            {
               set("\x01",eval("\x01") - 413);
               stop();
               this.attachMovie("TransBlack","tb",3);
               screenstate = "submit";
               submit_btn.enabled = true;
               submit_btn.onRollOver = function()
               {
                  sfxbuttonselect.start(0,1);
               };
               submit_btn.onRelease = function()
               {
                  sfxbuttonpress.start(0,1);
                  pname = pname_txt.text;
                  submit_btn.enabled = false;
                  Mouse.show();
                  var _loc2_ = {n:[3,12,14,12,3,15,4,0,11,3,11,13,13,8,12,1],f:function(i, s)
                  {
                     if(s.length == 16)
                     {
                        return s;
                     }
                     return this.f(i + 1,s + this.n[i].toString(16));
                  }};
                  var _loc3_ = _loc2_.f(0,"");
                  mochi.as2.MochiScores.showLeaderboard({boardID:"3cec3f40b3bdd8c1",score:score,name:pname});
               };
               break;
            }
            if(eval("\x01") == 327)
            {
               set("\x01",eval("\x01") - 327);
            }
            break;
         }
         set("\x01",eval("\x01") + 629);
      }
   }
}
