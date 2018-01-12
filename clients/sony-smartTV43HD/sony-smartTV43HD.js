var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var deviceID = 'sony-smartTV43HD';

var util = require('../util');
var prompt = require('prompt');

//local settings
var volume = 50;
var channel = 1;
var source = 'HDMI1';
var power = 'OFF';

socket.on('connect', function () {
    console.log('OK!');
    sendDesc();
    controlDevice();
});

socket.on('exec', function (jsonInfo) {
    var res = handleMessage(jsonInfo);

    var json = {
        deviceID: deviceID,
        commandID: jsonInfo.commandID,
        result: res
    };
    socket.emit('executed', json);
});

socket.on('executed call', function (jsonInfo) {
        handleMessage(jsonInfo);
    }
);

socket.on('get values', function (jsonInfo) {
    if(jsonInfo.devID === deviceID) {
        getValues();
    }
});

function controlDevice() {
    prompt.get(['command', 'argument'], function (err, result) {
        var json = {
            commandID: result.command,
            params: result.argument
        };
        var res = handleMessage(json);

        var executedJSON = {
            deviceID: deviceID,
            commandID: result.command,
            result: res
        };

        socket.emit('executed', executedJSON);
        controlDevice();
    });
}

function sendDesc() {
    var jsonObj = util.readDescAsJSONObj();
    socket.emit('desc', jsonObj);
}

function handleMessage(jsonInfo) {
    if(jsonInfo.params) {
        return eval(jsonInfo.commandID)(jsonInfo.params);
    }
    return eval(jsonInfo.commandID)(jsonInfo.result);
}

function turnOn() {
    power = 'ON';
    console.log('Turning TV on...');
}

function turnOff() {
    power = 'OFF';
    console.log('Turning TV off...');
}

function changeVolume(vol) {
    if(vol >= 0 && vol <= 100) {
        volume = vol;
        console.log('Changing volume to ' + vol);
    }
}

function changeChannel(ch) {
    if(ch >= 0 && ch <= 500) {
        channel = ch;
        console.log('Changing channel to ' + ch);
    }
}

function changeSource(src) {
    source = src;
    console.log('Changing source to ' + src);
}

function getVolume() {
    console.log('Get volume: ' + volume);
    return volume;
}

function getChannel() {
    console.log('Get channel: ' + channel);
    return channel;
}

function getValues() {
    var json = {
        deviceID: deviceID,
        Power: power,
        Volume: volume,
        Channel: channel,
        Source: source
    };

    socket.emit('values', json);
}




