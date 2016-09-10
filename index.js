var mqtt = require('mqtt');

homeduino = require('homeduino')
Board = homeduino.Board
board = new Board("serialport", {serialDevice:'/dev/tty.wchusbserial14a20', baudrate: 115200})

var client  = mqtt.connect('mqtt://localhost:1883');

client.on('connect', function () {
  client.subscribe('input/#');
});

board.on("rfReceive", function(event){
  console.log ('received:', event.pulseLengths, event.pulses)
})
 
board.on("rf", function(event){
  var topic = event.protocol + "/" + event.values.id;
  console.log(event)
  if (event.values.state != undefined){
  	console.log(topic + " - " + event.values.state.toString())
  	client.publish(topic, event.values.state.toString());
  }
})
 
board.connect().then( function() {
  console.log ("board ready")
  board.rfControlStartReceiving(0).then( function(){
    console.log ("receiving...")
  }).done()
}).done()


client.on('message', function (topic, message) {
  // message is Buffer
  console.log(topic)
  var options = {'state': (message.toString().trim() === "true")}
  var protocol = topic.split("/")[1]
  options.id = topic.split("/")[2] 
  options.unit = topic.split("/")[3]
  
  console.log(options)
  board.rfControlSendMessage(4,3,protocol,options)
  console.log(message.toString());
});