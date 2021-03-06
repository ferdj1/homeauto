var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var deviceID = 'heatingSystems-homeHeatingC2';

var util = require('../util');
var prompt = require('prompt');

//local settings
var power = 'OFF';

var powerHeater1 = 'OFF';
var powerHeater2 = 'OFF';
var powerHeater3 = 'OFF';

var valueHeater1 = 21;
var valueHeater2 = 21;
var valueHeater3 = 21;


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
    if (jsonInfo.params) {
        return eval(jsonInfo.commandID)(jsonInfo.params);
    }
    return eval(jsonInfo.commandID)(jsonInfo.result);
}

function turnOn() {
    power = 'ON';
    console.log('Turning heating system on...');
}

function turnOff() {
    power = 'OFF';
    console.log('Turning heating system off...');
}

function turnOn1() {
    powerHeater1 = 'ON';
    console.log('Turning heater 1 on...');
}

function turnOff1() {
    powerHeater1 = 'OFF';
    console.log('Turning heater 1 off...');
}

function turnOn2() {
    powerHeater2 = 'ON';
    console.log('Turning heater 2 on...');
}

function turnOff2() {
    powerHeater2 = 'OFF';
    console.log('Turning heater 2 off...');
}

function turnOn3() {
    powerHeater3 = 'ON';
    console.log('Turning heater 3 on...');
}

function turnOff3() {
    powerHeater3 = 'OFF';
    console.log('Turning heater 3 off...');
}

function changeValue1(heatValue) {
    if(heatValue >= 20 && heatValue <= 40) {
        valueHeater1 = heatValue;
        console.log('Changing value of heater 1 to ' + heatValue);
    }
}

function changeValue2(heatValue) {
    if(heatValue >= 20 && heatValue <= 40) {
        valueHeater2 = heatValue;
        console.log('Changing value of heater 2 to ' + heatValue);
    }
}

function changeValue3(heatValue) {
    if(heatValue >= 20 && heatValue <= 40) {
        valueHeater3 = heatValue;
        console.log('Changing value of heater 3 to ' + heatValue);
    }
}


function getValues() {
    var json = {
        deviceID: deviceID,
        Power: power,
        PowerHeater1: powerHeater1,
        PowerHeater2: powerHeater2,
        PowerHeater3: powerHeater3,
        ValueHeater1: valueHeater1,
        ValueHeater2: valueHeater2,
        ValueHeater3: valueHeater3
    };

    socket.emit('values', json);
}
