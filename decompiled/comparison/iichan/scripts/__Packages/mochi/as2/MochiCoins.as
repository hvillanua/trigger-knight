function §\x04\x05§()
{
   set("\x03",2083 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = 191 + "\x04\x05"();
var _loc2_;
while(true)
{
   if(eval("\x01") == 386)
   {
      set("\x01",eval("\x01") + 264);
      §§push(true);
   }
   else if(eval("\x01") == 381)
   {
      set("\x01",eval("\x01") + 585);
   }
   else if(eval("\x01") == 650)
   {
      set("\x01",eval("\x01") + 112);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 72);
      }
   }
   else
   {
      if(eval("\x01") == 762)
      {
         set("\x01",eval("\x01") + 72);
         eval(§§pop()).coins_showStore = _loc12_;
         NO_USER[§§constant(56)] = getTimer();
         NO_USER[§§constant(57)] = false;
         NO_USER.send = send;
         NO_USER[§§constant(59)] = function()
         {
            var _loc2_ = 100 * (1 - (getTimer() - this[§§constant(60)]) / this.send);
            var _loc3_;
            if(_loc2_ > 0)
            {
               this[§§constant(61)][§§constant(62)] = _loc2_;
            }
            else
            {
               _loc3_ = this[§§constant(61)][§§constant(61)];
               mochi.as2.MochiCoins[§§constant(63)](_loc3_);
               delete this[§§constant(64)];
            }
         };
         STORE_ITEMS[§§constant(66)][§§constant(68)] = StoreShow.triggerEvent;
         STORE_ITEMS[§§constant(66)][§§constant(69)] = StoreShow.removeEventListener;
         STORE_ITEMS[§§constant(66)][§§constant(70)] = function(msec)
         {
            var _loc2_ = this.STORE_ITEMS.NoUser;
            _loc2_[§§constant(71)] = true;
            _loc2_[§§constant(56)] = getTimer();
            _loc2_[§§constant(55)] = msec - 250;
         };
         STORE_ITEMS[§§constant(66)][§§constant(72)] = function(callbackID, arg)
         {
            mochi.as2.MochiCoins[§§constant(72)](options,callbackID,arg);
         };
         STORE_ITEMS[§§constant(73)] = function(s)
         {
            trace(§§constant(74) + s);
            return s;
         };
         NO_USER[§§constant(64)] = function()
         {
            var _loc5_ = this[§§constant(61)][§§constant(76)];
            var _loc4_ = getTimer() - this[§§constant(56)];
            var _loc2_ = false;
            var _loc3_;
            if(!NO_USER[§§constant(57)])
            {
               _loc3_ = _loc5_[§§constant(75)]();
               if(_loc3_ > 0 || typeof _loc3_ == §§constant(86))
               {
                  NO_USER[§§constant(57)] = true;
                  NO_USER[§§constant(56)] = getTimer();
               }
               else if(_loc4_ > NO_USER.coins_showStore)
               {
                  StoreShow.addEventListener();
                  _loc2_ = true;
               }
            }
            if(_loc4_ > NO_USER[§§constant(55)])
            {
               _loc2_ = true;
            }
            if(_loc2_)
            {
               if(this[§§constant(71)])
               {
                  delete this[§§constant(64)];
               }
               else
               {
                  this[§§constant(60)] = getTimer();
                  this[§§constant(64)] = this[§§constant(59)];
               }
            }
         };
         §§pop()[§§pop()] = §§pop();
         _loc1_["ERROR: showItem call must pass an Object with an item key"] = function(options)
         {
            trace(§§constant(93));
            mochi.as2.MochiCoins.showStore(options);
         };
         _loc1_[§§constant(92)] = function(options)
         {
            trace(§§constant(94));
            mochi.as2.MochiCoins[§§constant(91)](options);
         };
         _loc1_[§§constant(95)] = function(server)
         {
            var _loc1_ = server[§§constant(98)](§§constant(97))[2][§§constant(98)](§§constant(96))[0];
            if(eval(§§constant(99))[§§constant(100)])
            {
               if(eval(§§constant(99))[§§constant(100)][§§constant(101)])
               {
                  eval(§§constant(99))[§§constant(100)][§§constant(101)](§§constant(102));
                  eval(§§constant(99))[§§constant(100)][§§constant(101)](_loc1_);
               }
               if(eval(§§constant(99))[§§constant(100)][§§constant(103)])
               {
                  eval(§§constant(99))[§§constant(100)][§§constant(103)](§§constant(102));
                  eval(§§constant(99))[§§constant(100)][§§constant(103)](_loc1_);
               }
            }
            return _loc1_;
         };
         _loc1_.ItemNew = function(options)
         {
            var _loc12_ = {options:_root,(§§constant(104)):§§constant(105),string:"ItemNew",(§§constant(106)):10333,(§§constant(82)):§§constant(107)};
            options = mochi.as2.MochiCoins.STORE_HIDE(options,_loc12_);
            options[§§constant(108)] = options.options[§§constant(109)]() || 6;
            options[§§constant(110)] = mochi.as2.MochiCoins.getVersion();
            var _loc6_ = options.options;
            if(!mochi.as2.MochiCoins[§§constant(111)]())
            {
               return null;
            }
            if(_loc6_[§§constant(112)])
            {
               return null;
            }
            var _loc11_ = options[§§constant(106)];
            delete options[§§constant(106)];
            var STORE_ITEMS = _loc6_.MochiEventDispatcher("StoreItems",_loc11_);
            var _loc10_ = mochi.as2.MochiCoins.Error(options);
            options[§§constant(88)] = _loc10_[0] + §§constant(113) + _loc10_[1];
            options[§§constant(104)] += options[§§constant(82)];
            delete options[§§constant(82)];
            _loc6_[§§constant(112)] = true;
            if(_loc6_[§§constant(115)][§§constant(116)](§§constant(114)) != 0)
            {
               trace(§§constant(117));
            }
            var _loc4_ = STORE_ITEMS.MochiEventDispatcher(§§constant(76),1);
            for(var _loc7_ in options)
            {
               _loc4_[_loc7_] = options[_loc7_];
            }
            var _loc9_ = _loc4_[§§constant(104)];
            delete _loc4_[§§constant(104)];
            var _loc13_ = mochi.as2.MochiCoins[§§constant(95)](_loc9_);
            STORE_ITEMS[§§constant(64)] = function()
            {
               if(this[§§constant(76)][§§constant(115)] != this[§§constant(115)])
               {
                  this[§§constant(64)] = function()
                  {
                     if(!this[§§constant(76)])
                     {
                        delete this[§§constant(64)];
                        mochi.as2.MochiCoins[§§constant(63)](this[§§constant(61)]);
                     }
                  };
               }
            };
            var _loc5_ = new Object();
            var _loc8_ = [§§constant(122),eval(§§constant(78))[§§constant(121)](new §\§\§constant(119)§()[§§constant(120)]()),random(999999)][§§constant(123)](§§constant(118));
            _loc5_.STORE_ITEMS = STORE_ITEMS;
            _loc5_[§§constant(124)] = _loc8_;
            _loc5_[§§constant(125)] = _loc13_;
            _loc5_[§§constant(101)] = function(d)
            {
               return true;
            };
            _loc5_[§§constant(103)] = _loc5_[§§constant(101)];
            _loc5_[§§constant(126)](_loc8_);
            STORE_ITEMS[§§constant(66)] = _loc5_;
            STORE_ITEMS[§§constant(66)][§§constant(127)] = function(lc_name)
            {
               STORE_ITEMS[§§constant(81)] = lc_name;
            };
            _loc4_[§§constant(66)] = _loc8_;
            _loc4_[§§constant(128)] = getTimer();
            if(!options.ITEM_NEW)
            {
               _loc4_[§§constant(131)](_loc9_ + §§constant(130),§§constant(129));
            }
            return STORE_ITEMS;
         };
         _loc1_[§§constant(63)] = function(clip)
         {
            if(typeof clip == §§constant(86))
            {
               clip = _root;
            }
            if(clip.options && clip.options.StoreItems)
            {
               clip = clip.options;
            }
            if(!clip.StoreItems)
            {
               return false;
            }
            mochi.as2.MochiCoins[§§constant(85)](clip,{(§§constant(82)):§§constant(63)},clip.StoreItems[§§constant(81)]);
            clip.StoreItems[§§constant(132)]();
            delete clip[§§constant(112)];
            delete clip.StoreItems;
            return true;
         };
         _loc1_[§§constant(111)] = function()
         {
            var _loc1_;
            if(eval(§§constant(99))[§§constant(100)])
            {
               _loc1_ = eval(§§constant(99))[§§constant(100)];
               if(_loc1_[§§constant(133)] == §§constant(134))
               {
                  return false;
               }
            }
            return true;
         };
         _loc1_.Error = function(options)
         {
            var _loc3_ = options.options[§§constant(135)]();
            var _loc2_ = 0;
            var _loc1_ = 0;
            var _loc4_;
            if(typeof options[§§constant(88)] != §§constant(86))
            {
               _loc4_ = options[§§constant(88)][§§constant(98)](§§constant(113));
               _loc2_ = §§constant(136)(_loc4_[0]);
               _loc1_ = §§constant(136)(_loc4_[1]);
            }
            else
            {
               _loc2_ = _loc3_[§§constant(137)] - _loc3_[§§constant(138)];
               _loc1_ = _loc3_[§§constant(139)] - _loc3_[§§constant(140)];
            }
            if(_loc2_ == 0 || _loc1_ == 0)
            {
               _loc2_ = eval(§§constant(141))[§§constant(142)];
               _loc1_ = eval(§§constant(141))[§§constant(143)];
            }
            return [_loc2_,_loc1_];
         };
         _loc1_.STORE_HIDE = function(options, defaults)
         {
            var _loc4_ = {};
            for(var _loc8_ in defaults)
            {
               _loc4_[_loc8_] = defaults[_loc8_];
            }
            if(options)
            {
               for(_loc8_ in options)
               {
                  _loc4_[_loc8_] = options[_loc8_];
               }
            }
            var _loc5_;
            var _loc2_;
            var _loc3_;
            if(_root[§§constant(144)])
            {
               _loc5_ = _root[§§constant(144)][§§constant(98)](§§constant(145));
               _loc2_ = 0;
               while(_loc2_ < _loc5_[§§constant(146)])
               {
                  _loc3_ = _loc5_[_loc2_][§§constant(98)](§§constant(147));
                  _loc4_[§§constant(148)(_loc3_[0])] = §§constant(148)(_loc3_[1]);
                  _loc2_ = _loc2_ + 1;
               }
            }
            if(_loc4_[§§constant(82)] == §§constant(149))
            {
               trace(§§constant(150));
            }
            return _loc4_;
         };
         _loc1_[§§constant(72)] = function(clip, callbackID, arg)
         {
            var _loc4_;
            var _loc3_;
            switch(arg[§§constant(82)])
            {
               case §§constant(151):
                  mochi.as2.MochiCoins[§§constant(151)](clip,arg[§§constant(155)],arg[§§constant(154)]);
                  return;
               case §§constant(152):
                  _loc4_ = mochi.as2.MochiCoins[§§constant(152)](clip,arg[§§constant(155)]);
                  mochi.as2.MochiCoins[§§constant(156)](clip,callbackID,_loc4_,clip.StoreItems[§§constant(81)]);
                  return;
               case §§constant(153):
                  _loc3_ = mochi.as2.MochiCoins[§§constant(153)](clip,arg.string,arg[§§constant(157)]);
                  mochi.as2.MochiCoins[§§constant(156)](clip,callbackID,_loc3_,clip.StoreItems[§§constant(81)]);
                  return;
               default:
                  trace(§§constant(158) + arg[§§constant(82)]);
                  return;
            }
         };
         _loc1_[§§constant(151)] = function(base, objectName, value)
         {
            var _loc2_ = objectName[§§constant(98)](§§constant(159));
            var _loc1_;
            _loc1_ = 0;
            while(_loc1_ < _loc2_[§§constant(146)] - 1)
            {
               if(base[_loc2_[_loc1_]] == undefined || base[_loc2_[_loc1_]] == null)
               {
                  return undefined;
               }
               base = base[_loc2_[_loc1_]];
               _loc1_ = _loc1_ + 1;
            }
            base[_loc2_[_loc1_]] = value;
         };
         _loc1_[§§constant(152)] = function(base, objectName)
         {
            var _loc2_ = objectName[§§constant(98)](§§constant(159));
            var _loc1_;
            _loc1_ = 0;
            while(_loc1_ < _loc2_[§§constant(146)] - 1)
            {
               if(base[_loc2_[_loc1_]] == undefined || base[_loc2_[_loc1_]] == null)
               {
                  return undefined;
               }
               base = base[_loc2_[_loc1_]];
               _loc1_ = _loc1_ + 1;
            }
            return base[_loc2_[_loc1_]];
         };
         _loc1_[§§constant(153)] = function(base, methodName, argsArray)
         {
            var _loc2_ = methodName[§§constant(98)](§§constant(159));
            var _loc1_;
            _loc1_ = 0;
            while(_loc1_ < _loc2_[§§constant(146)] - 1)
            {
               if(base[_loc2_[_loc1_]] == undefined || base[_loc2_[_loc1_]] == null)
               {
                  return undefined;
               }
               base = base[_loc2_[_loc1_]];
               _loc1_ = _loc1_ + 1;
            }
            if(typeof base[_loc2_[_loc1_]] == §§constant(160))
            {
               return base[_loc2_[_loc1_]][§§constant(161)](base,argsArray);
            }
            return undefined;
         };
         _loc1_[§§constant(85)] = function(clip, args, lcName)
         {
            var _loc1_ = clip.StoreItems[§§constant(76)][§§constant(162)][§§constant(163)];
            if(_loc1_[§§constant(164)])
            {
               _loc1_[§§constant(164)](args);
            }
            else
            {
               new §\§\§constant(165)§()[§§constant(166)](lcName,§§constant(164),args);
            }
         };
         _loc1_[§§constant(156)] = function(clip, callbackID, val, lcName)
         {
            var _loc1_ = clip.StoreItems[§§constant(76)][§§constant(162)][§§constant(163)];
            if(_loc1_[§§constant(167)])
            {
               _loc1_[§§constant(167)](callbackID,val);
            }
            else
            {
               new §\§\§constant(165)§()[§§constant(166)](lcName,§§constant(167),callbackID,val);
            }
         };
         §§constant(168)(mochi.as2.MochiCoins.prototype,null,1);
         break;
      }
      if(eval("\x01") == 782)
      {
         set("\x01",eval("\x01") - 474);
         §§push(eval(§§pop()));
      }
      else if(eval("\x01") == 834)
      {
         set("\x01",eval("\x01") + 63);
      }
      else if(eval("\x01") == 87)
      {
         set("\x01",eval("\x01") + 695);
         §§push("\x0f");
      }
      else if(eval("\x01") == 308)
      {
         set("\x01",eval("\x01") + 284);
         §§push(!§§pop());
      }
      else if(eval("\x01") == 592)
      {
         set("\x01",eval("\x01") - 211);
         if(§§pop())
         {
            set("\x01",eval("\x01") + 585);
         }
      }
      else if(eval("\x01") == 718)
      {
         set("\x01",eval("\x01") - 631);
         var §§pop() = §§pop();
      }
      else
      {
         if(eval("\x01") == 966)
         {
            set("\x01",eval("\x01") - 576);
            if(!_global.mochi)
            {
               _global.mochi = new Object();
            }
            §§pop();
            if(!_global.mochi.as2)
            {
               _global.mochi.as2 = new Object();
            }
            §§pop();
            if(!_global.mochi.as2.MochiCoins)
            {
               _loc2_ = mochi.as2.MochiCoins = function()
               {
               }.prototype;
               mochi.as2.MochiCoins = function()
               {
               }.getVersion = function()
               {
                  return mochi.as2.MochiServices.getVersion();
               };
               mochi.as2.MochiCoins = function()
               {
               }.showStore = function(options)
               {
                  mochi.as2.MochiServices.send("coins_showStore",{options:options},null,null);
               };
               mochi.as2.MochiCoins = function()
               {
               }.showItem = function(options)
               {
                  if(options == undefined || typeof options.item != "string")
                  {
                     trace("ERROR: showItem call must pass an Object with an item key");
                     return undefined;
                  }
                  mochi.as2.MochiServices.send("coins_showItem",{options:options},null,null);
               };
               mochi.as2.MochiCoins = function()
               {
               }.showVideo = function(options)
               {
                  if(options == undefined || typeof options.item != "string")
                  {
                     trace("ERROR: showVideo call must pass an Object with an item key");
                     return undefined;
                  }
                  mochi.as2.MochiServices.send("coins_showVideo",{options:options},null,null);
               };
               mochi.as2.MochiCoins = function()
               {
               }.getStoreItems = function()
               {
                  mochi.as2.MochiServices.send("coins_getStoreItems");
               };
               mochi.as2.MochiCoins = function()
               {
               }.requestFunding = function(properties)
               {
                  mochi.as2.MochiServices.send("social_requestFunding",properties);
               };
               mochi.as2.MochiCoins = function()
               {
               }.addEventListener = function(eventType, delegate)
               {
                  mochi.as2.MochiCoins._dispatcher.addEventListener(eventType,delegate);
               };
               mochi.as2.MochiCoins = function()
               {
               }.triggerEvent = function(eventType, args)
               {
                  mochi.as2.MochiCoins._dispatcher.triggerEvent(eventType,args);
               };
               mochi.as2.MochiCoins = function()
               {
               }.removeEventListener = function(eventType, delegate)
               {
                  mochi.as2.MochiCoins._dispatcher.removeEventListener(eventType,delegate);
               };
               mochi.as2.MochiCoins = function()
               {
               }.STORE_SHOW = "StoreShow";
               mochi.as2.MochiCoins = function()
               {
               }.STORE_HIDE = "StoreHide";
               mochi.as2.MochiCoins = function()
               {
               }.ITEM_OWNED = "ItemOwned";
               mochi.as2.MochiCoins = function()
               {
               }.ITEM_NEW = "ItemNew";
               mochi.as2.MochiCoins = function()
               {
               }.STORE_ITEMS = "StoreItems";
               mochi.as2.MochiCoins = function()
               {
               }.ERROR = "Error";
               mochi.as2.MochiCoins = function()
               {
               }.IO_ERROR = "IOError";
               mochi.as2.MochiCoins = function()
               {
               }.NO_USER = "NoUser";
               mochi.as2.MochiCoins = function()
               {
               }._dispatcher = new mochi.as2.MochiEventDispatcher();
               §§push(ASSetPropFlags(mochi.as2.MochiCoins.prototype,null,1));
            }
            §§pop();
            break;
         }
         if(eval("\x01") == 390)
         {
            set("\x01",eval("\x01") - 390);
            break;
         }
         if(eval("\x01") == 897)
         {
            set("\x01",eval("\x01") - 179);
            §§push("\x0f");
            §§push(1);
         }
         else
         {
            if(eval("\x01") != 781)
            {
               break;
            }
            set("\x01",eval("\x01") + 116);
         }
      }
   }
}
