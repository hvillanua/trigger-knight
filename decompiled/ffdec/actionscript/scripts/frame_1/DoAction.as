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
stop();
_root.kongregateServices.connect();
siteLock();
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
         this.gotoAndPlay("loader");
      }
   }
};
