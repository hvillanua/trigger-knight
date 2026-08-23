function §\x04\x05§()
{
   set("\x03",1325 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = -1239 + "\x04\x05"();
while(true)
{
   if(eval("\x01") == 276)
   {
      set("\x01",eval("\x01") + 556);
      §§push(true);
   }
   else if(eval("\x01") == 111)
   {
      set("\x01",eval("\x01") + 105);
   }
   else
   {
      if(eval("\x01") == 839)
      {
         set("\x01",eval("\x01") - 728);
         break;
      }
      if(eval("\x01") == 485)
      {
         set("\x01",eval("\x01") - 385);
         §§push(eval(§§pop()));
      }
      else if(eval("\x01") == 703)
      {
         set("\x01",eval("\x01") + 170);
         if(§§pop())
         {
            set("\x01",eval("\x01") - 647);
         }
      }
      else
      {
         if(eval("\x01") == 520)
         {
            set("\x01",eval("\x01") + 272);
            var _temp_1 = §§pop() and new §\§\§pop()§();
            nextFrame();
            §§pop() implements ;
            nextFrame();
            prevFrame();
            break;
         }
         if(eval("\x01") == 100)
         {
            set("\x01",eval("\x01") + 603);
            §§push(!§§pop());
         }
         else if(eval("\x01") == 892)
         {
            set("\x01",eval("\x01") - 53);
            if(§§pop())
            {
               set("\x01",eval("\x01") - 728);
            }
         }
         else if(eval("\x01") == 50)
         {
            set("\x01",eval("\x01") + 842);
            §§push(true);
         }
         else if(eval("\x01") == 832)
         {
            set("\x01",eval("\x01") - 312);
            if(§§pop())
            {
               set("\x01",eval("\x01") + 272);
            }
         }
         else if(eval("\x01") == 109)
         {
            set("\x01",eval("\x01") + 376);
            §§push("\x0f");
         }
         else
         {
            if(eval("\x01") == 226)
            {
               set("\x01",eval("\x01") + 262);
               function siteLock()
               {
                  var _loc2_ = this._url.split("/")[2].split(".");
                  if(_loc2_[_loc2_.length - 1] == "com" && _loc2_[_loc2_.length - 2] == "kongregate")
                  {
                     trace("true");
                  }
                  else
                  {
                     this._x = -50000;
                     this._y = -50000;
                  }
               }
               function gotoSite()
               {
                  getURL("http://www.mintsphere.com/", "_blank");
               }
               function onConnectError()
               {
                  trace("conn error!");
               }
               stop();
               var myMenu = new ContextMenu();
               myMenu.hideBuiltInItems();
               var copyright = new ContextMenuItem("(C)2012 MINTSPHERE",gotoSite);
               myMenu.customItems.push(copyright);
               _root.menu = myMenu;
               var MOCHI_ID = "f9217df7ad592297";
               mochi.as2.MochiServices.connect(MOCHI_ID,_root,onConnectError);
               mochi.as2.MochiAd.showPreGameAd({id:"f9217df7ad592297",res:"480x320"});
               kong_btn.onRelease = function()
               {
                  getURL("http://www.kongregate.com/?haref=triggerknight&src=spon-rpg-triggerknight-site-x", "_blank");
               };
               preloading = true;
               loaded = getBytesLoaded();
               total = getBytesTotal();
               percent = 0;
               preloaderbar._xscale = 0;
               this.onEnterFrame = function()
               {
                  if(preloading == true)
                  {
                     loaded = getBytesLoaded();
                     total = getBytesTotal();
                     trace(loaded);
                     trace(total);
                     trace(percent);
                     percent = Math.ceil(loaded / total * 100);
                     preload_txt.text = preloaderbar._xscale + "%";
                     if(preloaderbar._xscale < percent)
                     {
                        preloaderbar._xscale++;
                     }
                     if(preloaderbar._xscale >= 100)
                     {
                        preloading = false;
                        trace("yeah!");
                     }
                  }
               };
               break;
            }
            if(eval("\x01") == 835)
            {
               set("\x01",eval("\x01") - 726);
               var §§pop() = §§pop();
            }
            else if(eval("\x01") == 873)
            {
               set("\x01",eval("\x01") - 647);
            }
            else
            {
               if(eval("\x01") == 488)
               {
                  set("\x01",eval("\x01") - 488);
                  break;
               }
               if(eval("\x01") == 216)
               {
                  set("\x01",eval("\x01") + 619);
                  §§push("\x0f");
                  §§push(1);
               }
               else if(eval("\x01") == 669)
               {
                  set("\x01",eval("\x01") - 453);
               }
               else if(eval("\x01") == 74)
               {
                  set("\x01",eval("\x01") - 24);
               }
               else
               {
                  if(eval("\x01") != 792)
                  {
                     break;
                  }
                  set("\x01",eval("\x01") - 742);
               }
            }
         }
      }
   }
}
