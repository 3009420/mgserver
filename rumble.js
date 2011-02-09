var dgram = require("dgram");
var fs = require("fs");
var log = require("./logger").logger;
var jspack = require("./jspack").jspack;

function RumbleServer()
{
  var parent;
  var config = Array();
  var gameSocket;
  var initialized = false;
  var productcode=0x404;
  
  var started = false
  
  var send_queue = Array();
  var queue_interval;
  
  
//Opcodes:
// Much guesswork here.
// 0x40 Ping
// 0x20 Resend ??
// 0x10 Request for Something??
// 0x01 ack??

  function handle_packet(msg,rinfo)
  {

    var header= jspack.Unpack("!HHL",msg,0);
    var slot_id=header[0];
    var slot = parent.slots[slot_id];
    if(!slot)
    {
      log.error("Slot wrong","Rumble")
      return
    }
    if(slot.rumble_data==undefined)
      slot.rumble_data={"packet_next":0x400,"packet_queue":[]};
    var opcode=(header[2]>>24);
    var n = new Date().getTime();
    slot.timeout = n+10000;
    var opcode_response=0x00;
    var packet_this=0x00;
    var packet_ack=0x00;
    var reply = Buffer([0,0,0,0,0,0,0,0]); //u16,u16,c8_opcode,3byte_packetids
    var handled=false;
    var read_ofs=8; //set read pointer after header
    
    
    if(opcode & 0x40)
    {
      handled=true;
      var data = jspack.Unpack("!HH",msg,read_ofs);
      read_ofs+=4;
      log.log("Got 0x40, seq nr "+data[0],"Rumble",36);
      if(slot.rumble_data.ping==undefined || data[0]==0)
        slot.rumble_data.ping=n;
      var diff = (n - slot.rumble_data.ping);
//       log.log(diff,"Rumble","36;1")

      opcode_response |= 0x40;
      var reply_buf=new Buffer(reply.length+8);
      reply.copy(reply_buf,0,0);
      
      jspack.PackTo("!LHH",reply_buf,reply.length,[diff,0x3ff,data[0]])
      reply=reply_buf
//         log.prettyPrintHex(reply);
    }
    if(opcode & 0x10)
    {
      handled=true;
      log.log("Got 0x10","Rumble",36);
      packet_ack=(header[2] & 0xFFF000)>>12
      opcode_response |= 0x01;
      var command_code = jspack.Unpack("!HH",msg,read_ofs);
      //command_code[1] seems to be the actual code.
      read_ofs+=4;
      
      //Command codes:
      //C = Client, S = Server, +X = how many additional bytes
      //C 0x2101 +4 -> unknown
      //C 0x4003 +8 -> Send list of arenas
      //C 0x4100 +8 -> details on specific arena
      //C 0x0002 +0 -> bye bye?
      

      switch(command_code[1])
      {
        case 0x2101:
        case 0x0002:
          log.log("Got 0x2101 or 0x0002","Rumble",36);
          
          opcode_response |= 0x10;
          packet_this = slot.rumble_data.packet_next;
          slot.rumble_data.packet_next++
          
          var reply_buf=new Buffer(reply.length+4);
          reply.copy(reply_buf,0,0);
          reply_buf = jspack.PackTo("!HH",reply_buf,reply.length,[0,100])
          reply=reply_buf
          break;
          
        case 0x4003:
          log.log("Got 0x4003","Rumble",36);
            for(var i=0;i<config.arenas.length;i++)
            {
              packet_this = slot.rumble_data.packet_next;
              slot.rumble_data.packet_next++
              
              var reply_buf = new Buffer(96);
              reply_buf = jspack.PackTo("!LL HH HBB HH 32s L HBB HH 32s",reply_buf,0,[0,(0x10 << 24 | packet_this << 12),0,0xa268,6,1,i,1,0,config.arenas[i].name,0xFFFFFFFF,6,1,i,0xd0,0x2a,"server"])
              send_queue.push({"port":rinfo.port,"address":rinfo.address,"packet":reply_buf})
            }
              packet_this = slot.rumble_data.packet_next;
              slot.rumble_data.packet_next++
              var reply_buf = new Buffer(12);
              reply_buf = jspack.PackTo("!LL HH",reply_buf,0,[0,(0x10 << 24 | packet_this << 12),0,0x269])
              send_queue.push({"port":rinfo.port,"address":rinfo.address,"packet":reply_buf})
          
          break;
          
        case 0x4100:
          log.log("Got 0x4100","Rumble",36);
          opcode_response |= 0x10;
          packet_this = slot.rumble_data.packet_next;
          slot.rumble_data.packet_next++
          var r = jspack.Unpack("!LHBB",msg,read_ofs);
          console.log(r);
          var catl = config.arenas[r[3]].text.length;
          var reply_buf=new Buffer(reply.length+4+9+catl);
          reply.copy(reply_buf,0,0);
          reply_buf = jspack.PackTo("!HBB 9B "+catl+"s",reply_buf,reply.length,[2,0xb9,0,0,1,2,3,4,5,6,7,8,config.arenas[r[3]].text])
          reply=reply_buf
          
          packet_q = slot.rumble_data.packet_next;
          slot.rumble_data.packet_next++
          var reply_buf = new Buffer(12);
          reply_buf = jspack.PackTo("!LL HH",reply_buf,0,[0,(0x10 << 24 | packet_q << 12),0,0x64])
          send_queue.push({"port":rinfo.port,"address":rinfo.address,"packet":reply_buf})
          
          break;
        default:
          log.log("Unknown command code: "+command_code[1],"Rumble","35;1");
          log.Hex(msg);
          break;
      }
      
//       opcode_response |= 0x10;
//       
//       var reply_buf=new Buffer(reply.length+4);
//       reply.copy(reply_buf,0,0);      
//       reply = jspack.PackTo("!HH",reply_buf,reply.length,[0,100])

    }
    if(opcode & 0x4)
    {
      handled=true;
      log.log("Got 0x4","Rumble",36);
      opcode_response |= 0x4;
    }
    if(opcode & 0x1)
    {
      handled=true;
      ack=(header[2] & 0xFFF)

      log.log("Got Ack for "+ack,"Rumble",36);
    }
    
    if(!handled)
    {
      log.log("unknown opcode "+opcode,"Rumble","36;1")
      log.Hex(msg);
    }
    
    if(opcode_response!=0x00)
    {
//       reply[4]=opcode_response;
//       log.log(opcode_response+" "+packet_this+" "+packet_ack+"="+(opcode_response<<24 | packet_this << 12 | packet_ack),"Rumble",36)
      jspack.PackTo("!L",reply,4,[opcode_response<<24 | packet_this << 12 | packet_ack])
      gameSocket.send(reply, 0, reply.length, rinfo.port, rinfo.address);
      log.Hex(reply)
      
    }

  }
  
  function init()
  {

    try {
    var configFile = fs.readFileSync("./rumble.json").toString("utf8");
    config=JSON.parse(configFile);
    }
    catch (err)
    {
      log.error("Could not read config file:\n--> "+err,"Rumble")
    }
    
    if(config.port==undefined || config.port==0)
    {
      log.warning("Port not configured","Rumble")
      config.port=9050;
    }
    
    log.log("Found "+config.arenas.length+" Arenas in config","Rumble",36)
    for(var i=0;i<config.arenas.length;i++)
    {
      log.log("Arena "+i+": "+config.arenas[i].name,"Rumble",36)
    }
    
    log.log("RumbleServer initialized","Rumble",36)
    initialized=true;
  }

  function setup_socket()
  {
    gameSocket = dgram.createSocket("udp4");
    
    gameSocket.on("message", function (msg, rinfo) 
    {
      handle_packet(msg,rinfo)
    });

    gameSocket.on("listening", function () 
    {
      var address = gameSocket.address();
      log.log("RumbleServer listening " +
      address.address + ":" + address.port,"Rumble",36);
    });

    gameSocket.on("close", function () 
    {
      log.log("RumbleServer closed","Rumble",36);
    });

    gameSocket.bind(config.port);
    
  }
  
  function send_queued_packets()
  {
    if(send_queue.length==0)
      return
    while(send_queue.length>0)
    {
      p=send_queue.shift();
      gameSocket.send(p.packet, 0, p.packet.length, p.port, p.address);
    }
  }
  
  
  this.start = function()
  {
    if(!initialized)
      init()
    if(!started)//crude, needs improvement
      {
      setup_socket()
      queue_interval=setInterval(function(){send_queued_packets()},50);
      }
    started = true;
  }

  this.stop = function()
  {
    if(started)
    {
      gameSocket.close();
      clearInterval(queue_interval);
    }
    started=false;
  }


  this.register = function(_parent)
  {
    parent = _parent;
    parent.ports[productcode]=config.port;
  }
  
  init();
  
}

exports.rumble=new RumbleServer();