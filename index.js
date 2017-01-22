var mqtt = require('mqtt');

homeduino = require('homeduino')
Board = homeduino.Board
board = new Board("serialport", {serialDevice:'/dev/serial/by-path/platform-3f980000.usb-usb-0:1.3:1.0-port0', baudrate: 115200})
var boardReady = false


config_json = require("./config.json")

var client  = mqtt.connect('mqtt://localhost:1883', {username:config_json.user, password:config_json.pass});

var baseTopic = "homeduino"
var homeduinoTimout = 5000
var hasDHT11 = false
var receivePin = 1
var sendPin = 11
var defaultRepeats = 7

function topicToProtocol (topic) {
  var topicIdx = 2
  var protocol = topic.split("/")[topicIdx++]

  var options = {}

  if (topic.split("/")[topicIdx] === "channel") {
    ++topicIdx
    options.channel = topic.split("/")[topicIdx++]
  }

  if (topic.split("/")[topicIdx] === "id") {
    ++topicIdx
    options.id = topic.split("/")[topicIdx++]
  }

  if (topic.split("/")[topicIdx] === "unit") {
    ++topicIdx
    options.unit = topic.split("/")[topicIdx++]
  }

  return {protocol: protocol, options: options}
}

function protocolToTopic (protocol, options)
{
  topic = baseTopic + "/rx/" + protocol

  if (options.channel != undefined) {
    topic += "/channel/" + options.channel
  }
  if (options.id != undefined) {
    topic += "/id/" + options.id
  }
  if (options.unit != undefined) {
    topic += "/unit/" + options.unit
  }

  return topic
}

client.on('connect', function () {
  client.subscribe(baseTopic + '/#');
});

board.on("rfReceive", function(event){
  //console.log ('received:', event.pulseLengths, event.pulses)
})

board.on("rf", function(event){

  try {
    //console.log(event)

    var topic = protocolToTopic(event.protocol, event.values);
    var payload = ""

    if (event.values.state != undefined) {
      payload = "{\"state\":" + event.values.state + "}"
    }

    if (event.values.command != undefined) {
      payload = "{\"command\":" + event.values.command + "}"
    }

    if (event.values.contact != undefined) {
      payload = "\"contact\":" + event.values.contact + "}"
    }

    //console.log(topic + " - " + payload)
    client.publish(topic, payload);
  } catch (e) { console.log(e)};
})

board.connect(homeduinoTimout).then( function() {
  console.log ("board ready")
  boardReady = true

  board.rfControlStartReceiving(receivePin).then( function(){
    console.log ("receiving...")
    if (hasDHT11) {
      tempInterval = setInterval(function() {
        try {
          board.readDHT(11, 13).then( function(ret) {
            client.publish("/dht11/temperature", ret.temperature.toString());
            client.publish("/dht11/humidity", ret.humidity.toString());
          })
        } catch (e) {};
      }, 5000);    
    }
  }).done()
}).done()


client.on('message', function (topic, message) {
  try {
    // message is Buffer
    //console.log("topic: " + topic)
    //console.log("message: " + message)

    if (!topic.startsWith(baseTopic + "/tx/") || topic.endsWith("/state") || !boardReady) 
    {
      //console.log("ignoring")
      return
    }

    payloadJson = JSON.parse(message)
    rfRepeats = defaultRepeats
    
    var protocolOptions = topicToProtocol(topic)

    if (payloadJson["state"] != undefined) {
      protocolOptions.options.state = payloadJson["state"]
    }

    if (payloadJson["command"] != undefined) {
      protocolOptions.options.command = payloadJson["command"]
    }

    if (payloadJson["rfRepeats"] != undefined) {
      rfRepeats = payloadJson["rfRepeats"]
    }

    //console.log("protocol: " + protocolOptions.protocol)
    //console.log(protocolOptions.options)
    //console.log("rfRepeats:" + rfRepeats)
    board.rfControlSendMessage(sendPin, rfRepeats, protocolOptions.protocol, protocolOptions.options).then( function() {
      statTopic = topic + "/state"

      //console.log("sending stat for " + statTopic)
      client.publish(statTopic, message, {retain: true})
    });
  } catch (e) { console.log(e)};
});

