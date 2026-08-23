function §\x04\x05§()
{
   set("\x03",1033 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = 319 + "\x04\x05"();
var _loc2_;
while(true)
{
   if(eval("\x01") == 374)
   {
      set("\x01",eval("\x01") + 520);
      §§push(true);
   }
   else if(eval("\x01") == 669)
   {
      set("\x01",eval("\x01") - 509);
   }
   else if(eval("\x01") == 232)
   {
      set("\x01",eval("\x01") - 5);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 442);
      }
   }
   else if(eval("\x01") == 44)
   {
      set("\x01",eval("\x01") + 188);
      §§push(true);
   }
   else if(eval("\x01") == 508)
   {
      set("\x01",eval("\x01") + 402);
   }
   else if(eval("\x01") == 160)
   {
      set("\x01",eval("\x01") + 144);
      §§push("\x0f");
      §§push(1);
   }
   else if(eval("\x01") == 894)
   {
      set("\x01",eval("\x01") - 818);
      if(§§pop())
      {
         set("\x01",eval("\x01") + 432);
      }
   }
   else if(eval("\x01") == 585)
   {
      set("\x01",eval("\x01") - 541);
   }
   else if(eval("\x01") == 446)
   {
      set("\x01",eval("\x01") - 402);
   }
   else if(eval("\x01") == 422)
   {
      set("\x01",eval("\x01") - 262);
   }
   else
   {
      if(eval("\x01") == 76)
      {
         set("\x01",eval("\x01") + 432);
         break;
      }
      if(eval("\x01") == 786)
      {
         set("\x01",eval("\x01") + 128);
         if(§§pop())
         {
            set("\x01",eval("\x01") - 468);
         }
      }
      else if(eval("\x01") == 481)
      {
         set("\x01",eval("\x01") + 275);
         §§push(eval(§§pop()));
      }
      else
      {
         if(eval("\x01") == 914)
         {
            set("\x01",eval("\x01") - 468);
            §§push(typeof §§pop());
            break;
         }
         if(eval("\x01") == 454)
         {
            set("\x01",eval("\x01") + 27);
            §§push("\x0f");
         }
         else if(eval("\x01") == 558)
         {
            set("\x01",eval("\x01") + 352);
         }
         else if(eval("\x01") == 910)
         {
            set("\x01",eval("\x01") - 124);
            §§push(true);
         }
         else
         {
            if(eval("\x01") == 227)
            {
               set("\x01",eval("\x01") + 442);
               stopDrag();
               return §§pop();
            }
            if(eval("\x01") == 304)
            {
               set("\x01",eval("\x01") + 150);
               var §§pop() = §§pop();
            }
            else if(eval("\x01") == 756)
            {
               set("\x01",eval("\x01") + 236);
               §§push(!§§pop());
            }
            else if(eval("\x01") == 992)
            {
               set("\x01",eval("\x01") - 559);
               if(§§pop())
               {
                  set("\x01",eval("\x01") - 429);
               }
            }
            else
            {
               if(eval("\x01") != 433)
               {
                  if(eval("\x01") == 4)
                  {
                     set("\x01",eval("\x01") + 306);
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
                     if(!_global.mochi.as2.MochiDigits)
                     {
                        _loc2_ = mochi.as2.MochiDigits = function(digit, index)
                        {
                           this.Encoder = 0;
                           this.setValue(digit,index);
                        }.prototype;
                        _loc2_.__get__value = function()
                        {
                           return Number(this.toString());
                        };
                        _loc2_.__set__value = function(v)
                        {
                           this.setValue(v);
                           return this.value;
                        };
                        _loc2_.addValue = function(v)
                        {
                           this.value += v;
                        };
                        _loc2_.setValue = function(digit, index)
                        {
                           var _loc3_ = digit.toString();
                           if(index == undefined || isNaN(index))
                           {
                              index = 0;
                           }
                           this.Fragment = _loc3_.charCodeAt(index++) ^ this.Encoder;
                           if(index < _loc3_.length)
                           {
                              this.Sibling = new mochi.as2.MochiDigits(digit,index);
                           }
                           else
                           {
                              this.Sibling = null;
                           }
                           this.reencode();
                        };
                        _loc2_.reencode = function()
                        {
                           var _loc2_ = int(2147483647 * Math.random());
                           this.Fragment ^= _loc2_ ^ this.Encoder;
                           this.Encoder = _loc2_;
                        };
                        _loc2_.toString = function()
                        {
                           var _loc2_ = String.fromCharCode(this.Fragment ^ this.Encoder);
                           return this.Sibling == null ? _loc2_ : _loc2_.concat(this.Sibling.toString());
                        };
                        §§push(_loc2_.addProperty("value",_loc2_.__get__value,_loc2_.__set__value));
                        §§push(ASSetPropFlags(mochi.as2.MochiDigits.prototype,null,1));
                     }
                     §§pop();
                     break;
                  }
                  if(eval("\x01") == 310)
                  {
                     set("\x01",eval("\x01") - 310);
                  }
                  break;
               }
               set("\x01",eval("\x01") - 429);
            }
         }
      }
   }
}
