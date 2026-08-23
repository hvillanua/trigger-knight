function §\x04\x05§()
{
   set("\x03",965 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = -1726 + "\x04\x05"();
var _loc2_;
while(true)
{
   if(eval("\x01") == 544)
   {
      set("\x01",eval("\x01") - 437);
      §§push(true);
   }
   else if(eval("\x01") == 217)
   {
      set("\x01",eval("\x01") + 239);
   }
   else if(eval("\x01") == 693)
   {
      set("\x01",eval("\x01") - 237);
   }
   else if(eval("\x01") == 107)
   {
      set("\x01",eval("\x01") - 102);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 212);
      }
   }
   else if(eval("\x01") == 456)
   {
      set("\x01",eval("\x01") + 445);
      §§push("\x0f");
      §§push(1);
   }
   else if(eval("\x01") == 749)
   {
      set("\x01",eval("\x01") - 379);
      §§push(eval(§§pop()));
   }
   else
   {
      if(eval("\x01") == 5)
      {
         set("\x01",eval("\x01") + 212);
         break;
      }
      if(eval("\x01") == 121)
      {
         set("\x01",eval("\x01") + 628);
         §§push("\x0f");
      }
      else if(eval("\x01") == 370)
      {
         set("\x01",eval("\x01") + 121);
         §§push(!§§pop());
      }
      else if(eval("\x01") == 901)
      {
         set("\x01",eval("\x01") - 780);
         var §§pop() = §§pop();
      }
      else if(eval("\x01") == 491)
      {
         set("\x01",eval("\x01") - 124);
         if(§§pop())
         {
            set("\x01",eval("\x01") + 54);
         }
      }
      else
      {
         if(eval("\x01") != 367)
         {
            if(eval("\x01") == 421)
            {
               set("\x01",eval("\x01") + 382);
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
               if(!_global.mochi.as2.MochiEventDispatcher)
               {
                  _loc2_ = mochi.as2.MochiEventDispatcher = function()
                  {
                     this.eventTable = {};
                  }.prototype;
                  _loc2_.buildDelegate = function(thisObject, thatObject)
                  {
                     var _loc2_ = {thisObject:thisObject,thatObject:thatObject};
                     if(thatObject != undefined)
                     {
                        var funct = typeof thatObject != "string" ? thatObject : thisObject[thatObject];
                        _loc2_.delegate = function(args)
                        {
                           funct.call(thisObject,args);
                        };
                     }
                     else
                     {
                        _loc2_.delegate = thisObject;
                     }
                     return _loc2_;
                  };
                  _loc2_.compareDelegate = function(d_A, d_B)
                  {
                     if(d_A.thisObject != d_B.thisObject || d_A.thatObject != d_B.thatObject)
                     {
                        return false;
                     }
                     return true;
                  };
                  _loc2_.addEventListener = function(event, thisObject, thatObject)
                  {
                     this.removeEventListener(event,thisObject,thatObject);
                     this.eventTable[event].push(this.buildDelegate(thisObject,thatObject));
                  };
                  _loc2_.removeEventListener = function(event, thisObject, thatObject)
                  {
                     var _loc3_ = this.buildDelegate(thisObject,thatObject);
                     if(this.eventTable[event] == undefined)
                     {
                        this.eventTable[event] = [];
                        return undefined;
                     }
                     for(var _loc4_ in this.eventTable[event])
                     {
                        if(this.compareDelegate(this.eventTable[event][_loc4_],_loc3_))
                        {
                           this.eventTable[event].splice(Number(_loc4_),1);
                        }
                     }
                  };
                  _loc2_.triggerEvent = function(event, args)
                  {
                     if(this.eventTable[event] == undefined)
                     {
                        return undefined;
                     }
                     for(var _loc4_ in this.eventTable[event])
                     {
                        this.eventTable[event][_loc4_].delegate(args);
                     }
                  };
                  §§push(ASSetPropFlags(mochi.as2.MochiEventDispatcher.prototype,null,1));
               }
               §§pop();
               break;
            }
            if(eval("\x01") == 803)
            {
               set("\x01",eval("\x01") - 803);
            }
            break;
         }
         set("\x01",eval("\x01") + 54);
      }
   }
}
