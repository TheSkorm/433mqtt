var mqtt = require('mqtt');
var nconf = require('nconf');
homeduino = require('homeduino')


nconf.argv()
  .env()
  .file('user', '/etc/433mqtt.json')
  .file('default', './config.default.json');

Board = homeduino.Board
board = new Board("serialport", {serialDevice: nconf.get('port'), baudrate:  nconf.get('baud')})
var boardReady = false



var client  = mqtt.connect('mqtt://core-mosquitto:1883',  nconf.get('mqtt'));

var baseTopic = nconf.get('basetopic');
var homeduinoTimout = 5000
var receivePin = nconf.get('rf:receivepin')
var sendPin = nconf.get('rf:sendpin')
var defaultRepeats = nconf.get('rf:repeats')

// input/switch15/124333/0
function topicToProtocol (topic) {
  var topicIdx = 1
  var protocol = topic.split("/")[0]

  var options = {}

  if (topic.split("/")[2] === "channel") {
    options.channel = topic.split("/")[3]
  }
  else if (topic.split("/")[1] === "id") {
    options.id = topic.split("/")[2]
  } else {
    options.id = topic.split("/")[1]
  }

  if (topic.split("/")[topicIdx] === "unit") {
    ++topicIdx
    options.unit = topic.split("/")[topicIdx++]
  }
  return {protocol: protocol, options: options}
}

function protocolToTopic (protocol, options)
{
  topic = baseTopic + nconf.get('rf:rxsuffix') +"/" + protocol

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
})

board.on("rf", function(event){

  try {

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
    if (!(nconf.get('rf:legacyrx'))){
      client.publish(topic, payload);
    } else {
      client.publish(event.protocol + "/" + event.values.id, event.values.state.toString());
    }
  } catch (e) { console.log(e)};
})

board.connect(homeduinoTimout).then( function() {
  console.log ("board ready")
  boardReady = true

  board.rfControlStartReceiving(receivePin).then( function(){
    console.log ("receiving...")
    if ( nconf.get('dht')) {
      tempInterval = setInterval(function() {
        try {
          board.readDHT( nconf.get('dht:model'),  nconf.get('dht:pin')).then( function(ret) {
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

    if (!topic.startsWith(baseTopic + nconf.get('rf:statesuffix')) || topic.endsWith("/state") || !boardReady) 
    {
      return
    }

    payloadJson = JSON.parse(message)
    rfRepeats = defaultRepeats

    var r = new RegExp("^" + baseTopic +"/");
    var protocolOptions = topicToProtocol(topic.replace(r,""))

    if (payloadJson["state"] != undefined) {
      protocolOptions.options.state = payloadJson["state"]
    }

    if (payloadJson["command"] != undefined) {
      protocolOptions.options.command = payloadJson["command"]
    }

    if (payloadJson["command"] == undefined && payloadJson["state"] == undefined){
      protocolOptions.options.state = payloadJson
    }

    if (payloadJson["rfRepeats"] != undefined) {
      rfRepeats = payloadJson["rfRepeats"]
    }

    board.rfControlSendMessage(sendPin, rfRepeats, protocolOptions.protocol, protocolOptions.options).then( function() {
      statTopic = topic + "/state"
      client.publish(statTopic, message, {retain: true})
    });
  } catch (e) { console.log(e)};
});

