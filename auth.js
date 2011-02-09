var dgram = require("dgram");
var fs = require("fs");
var log = require("./logger").logger;
var jspack = require("./jspack").jspack;

function AuthServer()
{
  var authSocket;
  var parent = null;
  
  var initialized = false;
  var config="bla";
  var started=false;
  
  function handle_packet(msg,rinfo)
  {
    log.debug("server got: " + msg.length + " bytes from " +
    rinfo.address + ":" + rinfo.port,"Auth");
//     prettyPrintHex(msg);
    var header= jspack.Unpack("!HHL",msg,0);
    if(header[2] & 0x08000000)
    {
      log.debug("Tis a login packet","Auth");
      var data=jspack.Unpack("!HH",msg,8)
      var port=data[1];
      var authstuff=jspack.Unpack("!32s32s256s256s4L",msg,44)
      log.debug("user auth "+authstuff[1]+" on server "+authstuff[2]+" game "+authstuff[4],"Auth");
      log.debug("Reply on port "+data[1],"Auth");
      
      var n= new Date().getTime();
      var gameport=parent.ports[authstuff[4]]
      var slot_id = parent.getFreeSlot();
      var go = true;
      if(gameport==undefined)
      {
        log.error("Unknown game identifier","Auth")
        go=false;
      }
      if(slot_id==-1)
      {
        go=false;
        log.log("No free slot","Auth",36)
      }
      else
      {
        parent.slots[slot_id]={"timeout":n+10000,"user":authstuff[1]}
      }
      
      
      if(go)
      {
      var reply=new Buffer(48);
      
      var time_sec = Math.floor(n/1000)+2208988800; //Seconds 01.01.1900 - 01.01.1970
      var time_frac = (n%1000) / 1000 * 0xFFFFFFFF;

      reply = jspack.PackTo("!HHLHH 4B 4L HHL HHL",reply,0,[0,0,0x98000000,2,gameport, 192,168,0,1,  0,0,time_sec,time_frac,0,slot_id,0,0x50,0x2066,0])

//       log.prettyPrintHex(reply);
      authSocket.send(reply, 0, reply.length, port, rinfo.address);
      }
    }
    
    log.log(header);
  }

  
  function init()
  {

    try {
    var configFile = fs.readFileSync("./auth.json").toString("utf8");
    config=JSON.parse(configFile);
    }
    catch (err)
    {
      log.error("Could not read config file:\n--> "+err,"Auth")
    }
    
    if(config.port==undefined || config.port==0)
    {
      log.warning("Port not configured","Auth")
      config.port=8999;
    }

    initialized=true;
    log.log("AuthServer init","Auth",36)
    
  }

  function setup_socket()
  {
    authSocket = dgram.createSocket("udp4");
    
    authSocket.on("message", function (msg, rinfo) 
    {
      handle_packet(msg,rinfo)
    });

    authSocket.on("listening", function () 
    {
      var address = authSocket.address();
      log.log("AuthServer listening " +
      address.address + ":" + address.port,"Auth",36);
    });

    authSocket.on("close", function () 
    {
      log.log("AuthServer closed","Auth",36);
    });

    authSocket.bind(config.port);
    
  }
  
  this.start = function()
  {
    if(!initialized)
      init()
    if(!started)//crude, needs improvement
      setup_socket()
    started = true;
  }

  this.stop = function()
  {
    if(started)
      authSocket.close();
    started=false;
  }


  this.register = function(_parent)
  {
    parent = _parent;
  }
  
  init();
  
}

exports.auth=new AuthServer()