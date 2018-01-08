var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var deviceID = 'philips-smartLightsRGB2';

var util = require('../util');

//local settings
var color = '#ffffff';
var intensity = 50;
var power = 'OFF';

socket.on('connect', function () {
    console.log('OK!');
    sendDesc();
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

function sendDesc() {
    var jsonObj = util.readDescAsJSONObj();
    socket.emit('desc', jsonObj);
}

function handleMessage(jsonInfo) {
    if (jsonInfo.params) {
        return eval(jsonInfo.commandID)(jsonInfo.params);
    }
    return eval(jsonInfo.commandID)(jsonInfo.result);
}

function turnOn() {
    power = 'ON';
    console.log('Turning lights on...');
}

function turnOff() {
    power = 'OFF';
    console.log('Turning lights off...');
}

function changeColor(col) {
    color = col;
    console.log('Changing color to ' + col);
}

function changeIntensity(intns) {
    if(intns >= 0 && intns <= 100) {
        intensity = intns;
        console.log('Changing intensity to ' + intns);
    }
}

function getColor() {
    return color;
}

function getIntensity() {
    console.log('Get intensity: ' + intensity);
    return intensity;
}


function getValues() {
    var json = {
        deviceID: deviceID,
        Power: power,
        Color: color,
        Intensity: intensity,
    };

    socket.emit('values', json);
}
