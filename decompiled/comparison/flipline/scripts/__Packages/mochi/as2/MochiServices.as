function §\x04\x05§()
{
   set("\x03",1347 % 511 * 5);
   return eval("\x03");
}
var §\x01§ = -1177 + "\x04\x05"();
var _loc2_;
while(true)
{
   if(eval("\x01") == 448)
   {
      set("\x01",eval("\x01") - 375);
      §§push(true);
   }
   else if(eval("\x01") == 572)
   {
      set("\x01",eval("\x01") - 535);
      §§push(!§§pop());
   }
   else if(eval("\x01") == 225)
   {
      set("\x01",eval("\x01") + 444);
      §§push("\x0f");
   }
   else
   {
      if(eval("\x01") == 991)
      {
         set("\x01",eval("\x01") - 51);
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
         if(!_global.mochi.as2.MochiServices)
         {
            _loc2_ = mochi.as2.MochiServices = function()
            {
            }.prototype;
            mochi.as2.MochiServices = function()
            {
            }.__get__id = function()
            {
               return mochi.as2.MochiServices._id;
            };
            mochi.as2.MochiServices = function()
            {
            }.__get__clip = function()
            {
               return mochi.as2.MochiServices._container;
            };
            mochi.as2.MochiServices = function()
            {
            }.__get__childClip = function()
            {
               return mochi.as2.MochiServices._clip;
            };
            mochi.as2.MochiServices = function()
            {
            }.getVersion = function()
            {
               return "3.9.4 as2";
            };
            mochi.as2.MochiServices = function()
            {
            }.allowDomains = function(server)
            {
               var _loc1_ = server.split("/")[2].split(":")[0];
               if(System.security)
               {
                  if(System.security.allowDomain)
                  {
                     System.security.allowDomain("*");
                     System.security.allowDomain(_loc1_);
                  }
                  if(System.security.allowInsecureDomain)
                  {
                     System.security.allowInsecureDomain("*");
                     System.security.allowInsecureDomain(_loc1_);
                  }
               }
               return _loc1_;
            };
            mochi.as2.MochiServices = function()
            {
            }.__get__isNetworkAvailable = function()
            {
               var _loc1_;
               if(System.security)
               {
                  _loc1_ = System.security;
                  if(_loc1_.sandboxType == "localWithFile")
                  {
                     return false;
                  }
               }
               return true;
            };
            mochi.as2.MochiServices = function()
            {
            }.__set__comChannelName = function(val)
            {
               if(val != undefined)
               {
                  if(val.length > 3)
                  {
                     mochi.as2.MochiServices._sendChannelName = val + "_fromgame";
                     mochi.as2.MochiServices.initComChannels();
                  }
               }
               return mochi.as2.MochiServices.comChannelName;
            };
            mochi.as2.MochiServices = function()
            {
            }.__get__connected = function()
            {
               return mochi.as2.MochiServices._connected;
            };
            mochi.as2.MochiServices = function()
            {
            }.connect = function(id, clip, onError)
            {
               if(onError != undefined)
               {
                  mochi.as2.MochiServices.onError = onError;
               }
               else if(mochi.as2.MochiServices.onError == undefined)
               {
                  mochi.as2.MochiServices.onError = function(errorCode)
                  {
                     trace(errorCode);
                  };
               }
               mochi.as2.MochiServices.warnID(id,false);
               if(!mochi.as2.MochiServices._connected && mochi.as2.MochiServices._clip == undefined)
               {
                  trace("MochiServices Connecting...");
                  mochi.as2.MochiServices._connecting = true;
                  mochi.as2.MochiServices.init(id,clip);
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.disconnect = function()
            {
               if(mochi.as2.MochiServices._connected || mochi.as2.MochiServices._connecting)
               {
                  mochi.as2.MochiServices._connecting = mochi.as2.MochiServices._connected = false;
                  mochi.as2.MochiServices.flush(true);
                  if(mochi.as2.MochiServices._clip != undefined)
                  {
                     mochi.as2.MochiServices._clip.removeMovieClip();
                     delete mochi.as2.MochiServices._clip;
                  }
                  mochi.as2.MochiServices._listenChannel.close();
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.init = function(id, clip)
            {
               mochi.as2.MochiServices._id = id;
               if(clip != undefined)
               {
                  mochi.as2.MochiServices._container = clip;
               }
               else
               {
                  mochi.as2.MochiServices._container = _root;
               }
               mochi.as2.MochiServices.loadCommunicator(id,mochi.as2.MochiServices._container);
            };
            mochi.as2.MochiServices = function()
            {
            }.loadCommunicator = function(id, clip)
            {
               var _loc6_ = "_mochiservices_com_" + id;
               var _loc5_ = new MovieClipLoader();
               var _loc3_ = {};
               if(mochi.as2.MochiServices._clip != null)
               {
                  return mochi.as2.MochiServices._clip;
               }
               if(!mochi.as2.MochiServices.isNetworkAvailable)
               {
                  mochi.as2.MochiServices.onError("NotConnected");
                  return null;
               }
               if(mochi.as2.MochiServices.urlOptions().servURL)
               {
                  mochi.as2.MochiServices._servURL = mochi.as2.MochiServices.urlOptions().servURL;
               }
               var _loc4_ = mochi.as2.MochiServices._servURL + mochi.as2.MochiServices._services;
               if(mochi.as2.MochiServices.urlOptions().servicesURL)
               {
                  _loc4_ = mochi.as2.MochiServices.urlOptions().servicesURL;
               }
               mochi.as2.MochiServices.allowDomains(_loc4_);
               mochi.as2.MochiServices._clip = clip.createEmptyMovieClip(_loc6_,10336,false);
               mochi.as2.MochiServices._listenChannelName += Math.floor(new Date().getTime()) + "_" + Math.floor(Math.random() * 99999);
               mochi.as2.MochiServices.listen();
               if(_loc3_.waitInterval != null)
               {
                  clearInterval(_loc3_.waitInterval);
               }
               _loc3_.onLoadError = mochi.as2.MochiServices.loadError;
               _loc3_.onLoadStart = function(target_mc)
               {
                  this.isLoading = true;
               };
               _loc3_.onLoadComplete = function(target_mc)
               {
                  target_mc.MochiServices = mochi.as2.MochiServices;
               };
               _loc3_.startTime = getTimer();
               _loc3_.wait = function()
               {
                  if(getTimer() - this.startTime > 10000)
                  {
                     if(!this.isLoading)
                     {
                        mochi.as2.MochiServices.disconnect();
                        mochi.as2.MochiServices.onError("IOError");
                     }
                     clearInterval(this.waitInterval);
                  }
               };
               _loc3_.waitInterval = setInterval(_loc3_,"wait",1000);
               _loc5_.addListener(_loc3_);
               _loc5_.loadClip(_loc4_ + "?listenLC=" + mochi.as2.MochiServices._listenChannelName + "&mochiad_options=" + escape(_root.mochiad_options) + "&api_version=" + mochi.as2.MochiServices.getVersion(),mochi.as2.MochiServices._clip);
               mochi.as2.MochiServices._sendChannel = new LocalConnection();
               mochi.as2.MochiServices._sendChannel._queue = [];
               return mochi.as2.MochiServices._clip;
            };
            mochi.as2.MochiServices = function()
            {
            }.loadError = function(target_mc, errorCode, httpStatus)
            {
               trace("MochiServices could not load.");
               mochi.as2.MochiServices.disconnect();
               mochi.as2.MochiServices.onError(errorCode);
            };
            mochi.as2.MochiServices = function()
            {
            }.onStatus = function(infoObject)
            {
               var _loc0_;
               if((_loc0_ = infoObject.level) === "error")
               {
                  mochi.as2.MochiServices._connected = false;
                  mochi.as2.MochiServices._listenChannel.connect(mochi.as2.MochiServices._listenChannelName);
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.listen = function()
            {
               mochi.as2.MochiServices._listenChannel = new LocalConnection();
               mochi.as2.MochiServices._listenChannel.handshake = function(args)
               {
                  mochi.as2.MochiServices.comChannelName = args.newChannel;
               };
               mochi.as2.MochiServices._listenChannel.allowDomain = function(d)
               {
                  return true;
               };
               mochi.as2.MochiServices._listenChannel.allowInsecureDomain = mochi.as2.MochiServices._listenChannel.allowDomain;
               mochi.as2.MochiServices._listenChannel._nextcallbackID = 0;
               mochi.as2.MochiServices._listenChannel._callbacks = {};
               mochi.as2.MochiServices._listenChannel.connect(mochi.as2.MochiServices._listenChannelName);
               trace("Waiting for MochiAds services to connect...");
            };
            mochi.as2.MochiServices = function()
            {
            }.initComChannels = function()
            {
               if(!mochi.as2.MochiServices._connected)
               {
                  mochi.as2.MochiServices._sendChannel.onStatus = function(infoObject)
                  {
                     mochi.as2.MochiServices.onStatus(infoObject);
                  };
                  mochi.as2.MochiServices._sendChannel.send(mochi.as2.MochiServices._sendChannelName,"onReceive",{methodName:"handshakeDone"});
                  mochi.as2.MochiServices._sendChannel.send(mochi.as2.MochiServices._sendChannelName,"onReceive",{methodName:"registerGame",id:mochi.as2.MochiServices._id,version:mochi.as2.MochiServices.getVersion()});
                  mochi.as2.MochiServices._listenChannel.onStatus = function(infoObject)
                  {
                     mochi.as2.MochiServices.onStatus(infoObject);
                  };
                  mochi.as2.MochiServices._listenChannel.onReceive = function(pkg)
                  {
                     var _loc5_ = pkg.callbackID;
                     var _loc4_ = this._callbacks[_loc5_];
                     if(!_loc4_)
                     {
                        return undefined;
                     }
                     var _loc2_ = _loc4_.callbackMethod;
                     var _loc3_ = _loc4_.callbackObject;
                     if(_loc3_ && typeof _loc2_ == "string")
                     {
                        _loc2_ = _loc3_[_loc2_];
                     }
                     if(_loc2_ != undefined)
                     {
                        _loc2_.apply(_loc3_,pkg.args);
                     }
                     delete this._callbacks[_loc5_];
                  };
                  mochi.as2.MochiServices._listenChannel.onEvent = function(pkg)
                  {
                     switch(pkg.target)
                     {
                        case "services":
                           mochi.as2.MochiServices.triggerEvent(pkg.event,pkg.args);
                           break;
                        case "events":
                           mochi.as2.MochiEvents.triggerEvent(pkg.event,pkg.args);
                           break;
                        case "coins":
                           mochi.as2.MochiCoins.triggerEvent(pkg.event,pkg.args);
                           break;
                        case "social":
                           mochi.as2.MochiSocial.triggerEvent(pkg.event,pkg.args);
                        default:
                           return;
                     }
                  };
                  mochi.as2.MochiServices._listenChannel.onError = function()
                  {
                     mochi.as2.MochiServices.onError("IOError");
                  };
                  trace("[SERVICES_API] connected!");
                  mochi.as2.MochiServices._connecting = false;
                  mochi.as2.MochiServices._connected = true;
                  while(mochi.as2.MochiServices._sendChannel._queue.length > 0)
                  {
                     mochi.as2.MochiServices._sendChannel.send(mochi.as2.MochiServices._sendChannelName,"onReceive",mochi.as2.MochiServices._sendChannel._queue.shift());
                  }
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.flush = function(error)
            {
               var _loc1_;
               var _loc2_;
               while(mochi.as2.MochiServices._sendChannel._queue.length > 0)
               {
                  _loc1_ = mochi.as2.MochiServices._sendChannel._queue.shift();
                  false;
                  if(_loc1_.callbackID != null)
                  {
                     _loc2_ = mochi.as2.MochiServices._listenChannel._callbacks[_loc1_.callbackID];
                  }
                  delete mochi.as2.MochiServices._listenChannel._callbacks[_loc1_.callbackID];
                  if(error)
                  {
                     mochi.as2.MochiServices.handleError(_loc1_.args,_loc2_.callbackObject,_loc2_.callbackMethod);
                  }
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.handleError = function(args, callbackObject, callbackMethod)
            {
               if(args != null)
               {
                  if(args.onError != null)
                  {
                     args.onError("NotConnected");
                  }
                  if(args.options != null && args.options.onError != null)
                  {
                     args.options.onError("NotConnected");
                  }
               }
               if(callbackMethod != null)
               {
                  args = {};
                  args.error = true;
                  args.errorCode = "NotConnected";
                  if(callbackObject != null && typeof callbackMethod == "string")
                  {
                     callbackObject[callbackMethod](args);
                  }
                  else if(callbackMethod != null)
                  {
                     callbackMethod.apply(args);
                  }
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.send = function(methodName, args, callbackObject, callbackMethod)
            {
               if(mochi.as2.MochiServices._connected)
               {
                  mochi.as2.MochiServices._sendChannel.send(mochi.as2.MochiServices._sendChannelName,"onReceive",{methodName:methodName,args:args,callbackID:mochi.as2.MochiServices._listenChannel._nextcallbackID});
               }
               else
               {
                  if(mochi.as2.MochiServices._clip == undefined || !mochi.as2.MochiServices._connecting)
                  {
                     trace("Error: MochiServices not connected.   Please call MochiServices.connect().  Function: " + methodName);
                     mochi.as2.MochiServices.handleError(args,callbackObject,callbackMethod);
                     mochi.as2.MochiServices.flush(true);
                     return undefined;
                  }
                  mochi.as2.MochiServices._sendChannel._queue.push({methodName:methodName,args:args,callbackID:mochi.as2.MochiServices._listenChannel._nextcallbackID});
               }
               mochi.as2.MochiServices._listenChannel._callbacks[mochi.as2.MochiServices._listenChannel._nextcallbackID] = {callbackObject:callbackObject,callbackMethod:callbackMethod};
               mochi.as2.MochiServices._listenChannel._nextcallbackID++;
            };
            mochi.as2.MochiServices = function()
            {
            }.urlOptions = function()
            {
               var _loc5_ = {};
               var _loc6_;
               var _loc2_;
               if(_root._url.indexOf("mochiad_options") != -1)
               {
                  _loc2_ = _root._url.indexOf("mochiad_options") + "mochiad_options".length + 1;
                  _loc6_ = _root._url.substr(_loc2_,_root._url.length);
               }
               else if(_root.mochiad_options)
               {
                  _loc6_ = _root.mochiad_options;
               }
               var _loc4_;
               var _loc3_;
               if(_loc6_)
               {
                  _loc4_ = _root.mochiad_options.split("&");
                  _loc2_ = 0;
                  while(_loc2_ < _loc4_.length)
                  {
                     _loc3_ = _loc4_[_loc2_].split("=");
                     _loc5_[unescape(_loc3_[0])] = unescape(_loc3_[1]);
                     _loc2_ = _loc2_ + 1;
                  }
               }
               return _loc5_;
            };
            mochi.as2.MochiServices = function()
            {
            }.warnID = function(bid, leaderboard)
            {
               bid = bid.toLowerCase();
               if(bid.length != 16)
               {
                  trace("WARNING: " + (!leaderboard ? "game" : "board") + " ID is not the appropriate length");
                  return undefined;
               }
               if(bid == "1e113c7239048b3f")
               {
                  if(leaderboard)
                  {
                     trace("WARNING: Using testing board ID");
                  }
                  else
                  {
                     trace("WARNING: Using testing board ID as game ID");
                  }
                  return undefined;
               }
               if(bid == "84993a1de4031cd8")
               {
                  if(leaderboard)
                  {
                     trace("WARNING: Using testing game ID as board ID");
                  }
                  else
                  {
                     trace("WARNING: Using testing game ID");
                  }
                  return undefined;
               }
               var _loc1_ = 0;
               while(_loc1_ < bid.length)
               {
                  switch(bid.charAt(_loc1_))
                  {
                     case "0":
                     case "1":
                     case "2":
                     case "3":
                     case "4":
                     case "5":
                     case "6":
                     case "7":
                     case "8":
                     case "9":
                     case "a":
                     case "b":
                     case "c":
                     case "d":
                     case "e":
                     case "f":
                        break;
                     default:
                        trace("WARNING: Board ID contains illegal characters: " + bid);
                        return undefined;
                  }
                  _loc1_ = _loc1_ + 1;
               }
            };
            mochi.as2.MochiServices = function()
            {
            }.addLinkEvent = function(url, burl, btn, onClick)
            {
               var timeout = 1500;
               var t0 = getTimer();
               var _loc2_ = new Object();
               _loc2_.mav = mochi.as2.MochiServices.getVersion();
               _loc2_.swfv = btn.getSWFVersion() || 6;
               _loc2_.swfurl = btn._url;
               _loc2_.fv = System.capabilities.version;
               _loc2_.os = System.capabilities.os;
               _loc2_.lang = System.capabilities.language;
               _loc2_.scres = System.capabilities.screenResolutionX + "x" + System.capabilities.screenResolutionY;
               var s = "?";
               var _loc3_ = 0;
               for(var _loc6_ in _loc2_)
               {
                  if(_loc3_ != 0)
                  {
                     s += "&";
                  }
                  _loc3_ = _loc3_ + 1;
                  s = s + _loc6_ + "=" + escape(_loc2_[_loc6_]);
               }
               var _loc7_;
               if(!(mochi.as2.MochiServices.netupAttempted || mochi.as2.MochiServices._connected))
               {
                  var ping = btn.createEmptyMovieClip("ping",777);
                  _loc7_ = btn.createEmptyMovieClip("nettest",778);
                  mochi.as2.MochiServices.netupAttempted = true;
                  ping.loadMovie("http://link.mochiads.com/linkping.swf?t=" + getTimer());
                  _loc7_.onEnterFrame = function()
                  {
                     if(ping._totalframes > 0 && ping._totalframes == ping._framesloaded)
                     {
                        delete this.onEnterFrame;
                     }
                     else if(getTimer() - t0 > timeout)
                     {
                        delete this.onEnterFrame;
                        mochi.as2.MochiServices.netup = false;
                     }
                  };
               }
               var _loc4_ = btn.createEmptyMovieClip("clk",1001);
               _loc4_._alpha = 0;
               _loc4_.beginFill(1044735);
               _loc4_.moveTo(0,0);
               _loc4_.lineTo(0,btn._height);
               _loc4_.lineTo(btn._width,btn._height);
               _loc4_.lineTo(btn._width,0);
               _loc4_.lineTo(0,0);
               _loc4_.endFill();
               _loc4_.onRelease = function()
               {
                  if(mochi.as2.MochiServices.netup)
                  {
                     getURL(url + s,"_blank");
                  }
                  else
                  {
                     getURL(burl,"_blank");
                  }
                  if(onClick != undefined)
                  {
                     onClick();
                  }
               };
            };
            mochi.as2.MochiServices = function()
            {
            }.setContainer = function(clip)
            {
            };
            mochi.as2.MochiServices = function()
            {
            }.stayOnTop = function(clip)
            {
            };
            mochi.as2.MochiServices = function()
            {
            }.addEventListener = function(eventType, thisObject, thatObject)
            {
               mochi.as2.MochiServices._dispatcher.addEventListener(eventType,thisObject,thatObject);
            };
            mochi.as2.MochiServices = function()
            {
            }.triggerEvent = function(eventType, args)
            {
               mochi.as2.MochiServices._dispatcher.triggerEvent(eventType,args);
            };
            mochi.as2.MochiServices = function()
            {
            }.removeEventListener = function(eventType, thisObject, thatObject)
            {
               mochi.as2.MochiServices._dispatcher.removeEventListener(eventType,thisObject,thatObject);
            };
            mochi.as2.MochiServices = function()
            {
            }.CONNECTED = "onConnected";
            mochi.as2.MochiServices = function()
            {
            }._servURL = "http://www.mochiads.com/static/lib/services/";
            mochi.as2.MochiServices = function()
            {
            }._services = "services.swf";
            mochi.as2.MochiServices = function()
            {
            }._mochiLC = "MochiLC.swf";
            mochi.as2.MochiServices = function()
            {
            }._listenChannelName = "__ms_";
            mochi.as2.MochiServices = function()
            {
            }._connecting = false;
            mochi.as2.MochiServices = function()
            {
            }._connected = false;
            mochi.as2.MochiServices = function()
            {
            }.netup = true;
            mochi.as2.MochiServices = function()
            {
            }.netupAttempted = false;
            mochi.as2.MochiServices = function()
            {
            }._dispatcher = new mochi.as2.MochiEventDispatcher();
            §§push((mochi.as2.MochiServices = function()
            {
            }).addProperty("childClip",mochi.as2.MochiServices = function()
            {
            }.__get__childClip,function()
            {
            }
            ));
            §§push((mochi.as2.MochiServices = function()
            {
            }).addProperty("clip",mochi.as2.MochiServices = function()
            {
            }.__get__clip,function()
            {
            }
            ));
            §§push((mochi.as2.MochiServices = function()
            {
            }).addProperty("comChannelName",function()
            {
            }
            ,mochi.as2.MochiServices = function()
            {
            }.__set__comChannelName));
            §§push((mochi.as2.MochiServices = function()
            {
            }).addProperty("connected",mochi.as2.MochiServices = function()
            {
            }.__get__connected,function()
            {
            }
            ));
            §§push((mochi.as2.MochiServices = function()
            {
            }).addProperty("id",mochi.as2.MochiServices = function()
            {
            }.__get__id,function()
            {
            }
            ));
            §§push((mochi.as2.MochiServices = function()
            {
            }).addProperty("isNetworkAvailable",mochi.as2.MochiServices = function()
            {
            }.__get__isNetworkAvailable,function()
            {
            }
            ));
            §§push(ASSetPropFlags(mochi.as2.MochiServices.prototype,null,1));
         }
         §§pop();
         break;
      }
      if(eval("\x01") == 669)
      {
         set("\x01",eval("\x01") - 97);
         §§push(eval(§§pop()));
      }
      else if(eval("\x01") == 890)
      {
         set("\x01",eval("\x01") + 101);
      }
      else if(eval("\x01") == 37)
      {
         set("\x01",eval("\x01") + 853);
         if(§§pop())
         {
            set("\x01",eval("\x01") + 101);
         }
      }
      else if(eval("\x01") == 787)
      {
         set("\x01",eval("\x01") + 11);
      }
      else
      {
         if(eval("\x01") == 940)
         {
            set("\x01",eval("\x01") - 940);
            break;
         }
         if(eval("\x01") == 138)
         {
            set("\x01",eval("\x01") + 87);
            var §§pop() = §§pop();
         }
         else if(eval("\x01") == 798)
         {
            set("\x01",eval("\x01") - 660);
            §§push("\x0f");
            §§push(1);
         }
         else if(eval("\x01") == 894)
         {
            set("\x01",eval("\x01") - 96);
         }
         else
         {
            if(eval("\x01") == 983)
            {
               set("\x01",eval("\x01") - 89);
               toggleHighQuality();
               tellTarget(§§pop() >> §§pop())
               {
                  tellTarget(§§pop() | §§pop() gt §§pop())
                  {
                     tellTarget(§§pop() >>> (§§pop() | §§pop()))
                     {
                        §§pop() extends §§pop();
                        tellTarget(§§pop() > §§pop())
                        {
                           tellTarget(§§pop() >> (§§pop() | §§pop()))
                           {
                              §§pop() extends §§pop() << (§§pop() ^ §§pop());
                              tellTarget(§§pop() > §§pop())
                              {
                                 §§push(§§pop() >>> (§§pop() | §§pop() === §§pop()));
                                 break;
                              }
                           }
                        }
                     }
                  }
               }
            }
            if(eval("\x01") != 73)
            {
               break;
            }
            set("\x01",eval("\x01") + 910);
            if(§§pop())
            {
               set("\x01",eval("\x01") - 89);
            }
         }
      }
   }
}
