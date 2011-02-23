var dgram = require("dgram");
var fs = require("fs");
var path = require("path");
var log = require("./shared/logger").logger;
var buffer_id=0;

global.confdir=path.resolve(".")+"/conf/"

function Server()
{
  //Public vars
  //Array linking App IDs to port numbers for Auth.
  this.ports=Object();
  this.slots=Object();
  
  
  //Private Vars
  var config=Array();
  var modules = Object();
  var initialized = false;
  var that = this; //gotta love certain hacks
  var freeslots = Array();

  var checker;
  
  //CLI
  var stdin = process.openStdin();
  stdin.setEncoding('utf8');

  stdin.on('data', function (chunk) 
  {
    chunk = chunk.replace(/^\s+|\s+$/g, '').split(" ")
    if(modules[chunk[0]]!=undefined)
    {
      if(chunk[1]==undefined)
        log.log("Options for module "+chunk,"Main",32)
      else
      {
        try
        {
          modules[chunk[0]][chunk[1]]()
        }
        catch (err)
        {
          log.error(err,chunk[0])
        }
      }
    }
    else
    {
      switch(chunk[0])
      {
        case "exit":
          stdin.destroy();
          that.stop();
          break;
        case "list":
          log.log("Loaded modules:","Main",32)
          for (i in modules)
            log.log('\t'+i,"Main",32)
          break;  
        case "help":
          log.log("Possible commands:\n\thelp\n\tlist\n\texit","Help","33;1");
          break;
        default:
          log.log("Unknown command. Type \"help\" for command reference","Main",32)
      }
    }
    
  });

  stdin.on('end', function () {
    that.stop();
  });  
  
  process.on('SIGINT', function () {
    stdin.destroy();
    that.stop();
  });

  
  

  ///////////////////
  // Initialization
  
  function init()
  {
    try {
      var configFile = fs.readFileSync(global.confdir+"config.json").toString("utf8");
      config=JSON.parse(configFile);
    }
    catch (err)
    {
      log.error("Could not read config file:\n--> "+err,"Main")
      return;
    }

    
    if(config.modules.length>0)
    {
      var l =config.modules.length;
      var m = config.modules;
      
      log.log("Loading "+l+" modules...","Main",32);
      for(var i = 0;i<l;i++)
      {
        log.log("Loading module \""+m[i]+"\"","Main",32);
        modules[m[i]]=require("./modules/"+m[i])[m[i]]
        modules[m[i]].register(that);
      }
    }
    else
    {
      log.warning("No Modules loaded?!");
    }
    
    
    if(config.slots ==0 || config.slots==undefined)
    {
      log.warning("Player slots not set. Defaulting to 4","Main");
      config.slots=4
    }
    for(var i = 0; i < config.slots;i++)
    {
      freeslots.push(i);
    }
    
    log.log("Init done","Main",36);
    initialized=true;
  };
  
  function checkFreeSlots()
  {
    log.log("Checking for timed out sessions","Main",32)
    var n= new Date().getTime();
    for (var i in that.slots)
    {
      if (n> that.slots[i].timeout)
      {
        freeslots.push(i);
        delete that.slots[i]
      }
    }
    
  }
  
  
  /////////////////
  // Start Server
  
  this.run =function()
  {
    if(!initialized)
    {
      init();
    }
    for(i in modules)
    {
      modules[i].start();
    }
    checker=setInterval(function(){checkFreeSlots()},20000)
  }
  
  this.stop = function()
  {
    for(i in modules)
    {
      modules[i].stop();
    }
    clearInterval(checker);
    log.log("Shutdown complete","Main",36);

  }
  
  this.getFreeSlot = function()
  {
    if(freeslots.length>0)
      return freeslots.pop();
    else 
      return -1;
    
  }

  init();
}





s = new Server();

s.run();



// s.stop();