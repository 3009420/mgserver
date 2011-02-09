// 30  set black foreground
// 31  set red foreground
// 32  set green foreground
// 33  set brown foreground
// 34  set blue foreground
// 35  set magenta foreground
// 36  set cyan foreground
// 37  set white foreground


function logger()
{
  this.log =function (str,src,c)
  {
    if(c==undefined)
      c=37
    if(src==undefined)
      src="Log"
    var n=new Date();
    var h=n.getHours();
    var m=n.getMinutes();
    var s=n.getSeconds();
    h = (h<10)?"0"+h:h;
    m = (m<10)?"0"+m:m;
    s = (s<10)?"0"+s:s;
    console.log(h+":"+m+":"+s+' \033['+c+'m['+src+']\033[0m '+str);
  };
  
  this.debug=function(s,src)
  {
    this.log(s,"DEBUG->"+src,34);
  };
  this.warning=function(s,src)
  {
    this.log(s,"WARNING->"+src,35);
  };  
  this.error=function(s,src)
  {
    this.log(s,"ERROR->"+src,31);
  };
  
  this.prettyPrintHex=function(buf)
  {
    console.log("00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F | 0123456789ABCDEF");
    console.log("------------------------------------------------+-----------------");
    this.Hex(buf);
  };
  
  this.Hex = function(buf)
  {
    var out = "";
    var out2 = "";
    var n = 0;
    var i = 0;
    for (i;i<buf.length;i++)
    {
      if(buf[i]<31)
      {
        out2+=".";
      }
      else
      {
        out2+=buf.toString("utf8",i,i+1);
      }
      if(i==4)
        out += "\033[36;1m"
      if(i==5)
        out += "\033[33;1m"
               
      out += (buf[i]<16?"0":"")+buf[i].toString(16)+" ";

      if(i==7 || i==buf.length-1)
        out += "\033[0m"
      n++;
      if(n==16)
      {
        n=0;
        console.log(out+"| "+out2);
        out ="";
        out2="";
      }
    }
    if(n>0)
    {
      for(n;n<16;n++)
        out+="   ";
      console.log(out+"| "+out2);
    }
  };
}

exports.logger=new logger()