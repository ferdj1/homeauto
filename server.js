var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/homedb');

var sessionSocketMap = new Map();
var timersList = [];

var timerID = setInterval(periodicallyExecute, 1000);

var tempDeviceInfo;

app.use(express.json());
app.use(express.urlencoded());


app.use(function (req, res, next) {
    req.db = db;
    next();
});

app.use(express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');
app.set('view engine', 'pug');

app.locals.pretty = true;


app.get('/', function (req, res) {
    var db = req.db;

    var devices = db.get('devices');

    devices.find({}, {}, function (e, docs) {
        db.collection("scenes").find({}, {}, function (e, docs2) {
            res.render('index', {title: 'SmartHome', devices:docs, scenes: docs2, socketMap: sessionSocketMap});
        });
    });

});

app.post('/sceneNew', function (req, res) {
    var body = req.body;
    if(body.name.trim() !== '') {
        db.collection("scenes").findOne({sceneName: body.name}, {}, function (e, docs) {
            if(!docs) {
                db.collection("scenes").insert({
                    sceneName: body.name,
                    commands: []
                });
            }
        });

        res.redirect('/');

    }
});

app.get('/sceneEdit/:sceneName', function (req, res) {
    var name = req.params.sceneName;

    db.collection("scenes").findOne({sceneName: name}, {}, function (e, docs) {
        db.collection("devices").find({}, {}, function (e, docs2) {
            res.render('sceneEdit', {title: 'Edit scene', devices:docs2, sceneObj: docs});
        });
    });
});


app.post('/sceneEdit/:sceneName', function (req, res) {
    var name = req.params.sceneName;

    db.collection("devices").findOne({deviceID: req.body.deviceSelector}, {}, function (e, docs) {
        var command;

        for(let i = 0; i < docs.commands.length; i++) {
            if(docs.commands[i].commandID === req.body.commandSelector) {
                command = docs.commands[i];
            }
        }

        db.collection("scenes").update({sceneName: name}, {
            $addToSet: {
                commands: {
                    device: docs,
                    command: command,
                    params: req.body.paramVal
                }
            }
        }, function (err, doc) {
            if(err) {
                res.render('error', {
                    title: 'Error',
                    error_message: 'Couldn\'t add.'
                });
            } else {
                res.redirect('/sceneEdit/' + name);
            }
        });
    });
});

app.post('/scene/:sceneName', function (req, res) {
    var name = req.params.sceneName;

    db.collection("scenes").findOne({sceneName: name}, {}, function (e, docs) {
        for(let i = 0; i < docs.commands.length; i++) {
            var command = docs.commands[i];

            var json = {
                deviceID: command.device.deviceID,
                commandID: command.command.commandID,
                params: command.params
            };
            var id = json.deviceID;

            var socketObj = sessionSocketMap.get(id);
            if(socketObj != null && socketObj !== undefined) {
                socketObj.emit('exec', json);
            } else {
            }
        }
    });

    res.redirect('/');
});

app.post('/removeSceneCommand', function (req, res) {
    var name = req.body.sceneName;
    var deviceID = req.body.deviceID;
    var commandID = req.body.commandID;
    var params = req.body.params;


    db.collection("devices").findOne({deviceID: deviceID}, {}, function (e, docs) {
        var command;

        for(let i = 0; i < docs.commands.length; i++) {
            if(docs.commands[i].commandID === commandID) {
                command = docs.commands[i];
            }
        }

        db.collection("scenes").update({sceneName: name}, {
                $pull: {commands: {device: docs, command: command, params: params}}},
            {multi: true}
        );
        if(params === null || params.length === 0) {
            db.collection("scenes").update({sceneName: name}, {
                    $pull: {commands: {device: docs, command: command}}
                },
                {multi: true}
            );
        }
    });

    res.redirect('/sceneEdit/' + name);
});

app.post('/removeScene', function (req, res) {
    var name = req.body.sceneName;


    db.collection("scenes").remove({sceneName: name});

    res.redirect('/');
});

app.get('/scheduler', function (req, res) {
    db.collection("devices").find({}, {}, function (e, docs) {
        db.collection("timers").find({}, {}, function (e, docs2) {
            res.render('scheduler', {title: 'Scheduler', devices: docs, timers: docs2});
        });
    });
});

app.post('/schedule', function (req, res) {
    var body = req.body;

    db.collection("timers").insert({
        deviceID: body.deviceSelector,
        commandID: body.commandSelector,
        params: body.paramVal,
        interval: body.interval
    }, function (err, doc) {
        if(err) {
            res.render('error',
                {title: 'Error',
                    error_message: 'Cannot set timer.'});
        } else {
            res.redirect('/scheduler');
        }
    });

    findTimers(callback, body.deviceSelector);
});

app.get('/subscriptions', function (req, res) {
    db.collection("devices").find({}, {}, function (err, result) {
        if(err || result == null) {
            res.render('error',
                {title: 'Error',
                    error_message: 'Cannot find devices.'});
        } else {
            db.collection("observerMapCollection").find({}, {}, function (err, result2) {
                if(err || result2 == null) {
                    res.render('error',
                        {title: 'Error',
                            error_message: 'Cannot find subscriptions.'});
                } else {
                    setTimeout(function () {
                        res.render('subscriptions', {title: 'Subscriptions', devices: result, subscriptions: result2});
                    }, 100);
                }
            });
        }
    });
});

app.post('/subscriptions', function (req, res) {
    var reqBody = req.body;
    var db = req.db;


    var observer = reqBody.observer;
    var executedCall = reqBody.executedCall;
    var observed = reqBody.observed;
    var observedCall = reqBody.observedCall;

    var optCheck = reqBody.optCheck;
    var optType = reqBody.optType;
    var sign = reqBody.sign;
    var compVal = reqBody.compValue;

    var observerMapCollection = db.get('observerMapCollection');
    observerMapCollection.findOne({
        observedDeviceID: observed,
        observedCommandID: observedCall
    }, function (err, result) {
        if(result) {
            observerMapCollection.update({
                observedDeviceID: observed,
                observedCommandID: observedCall
            }, {
                $addToSet: {
                    observerList: {
                        observerDeviceID: observer,
                        executedCommandID: executedCall,
                        optCheck: optCheck,
                        optType: optType,
                        sign: sign,
                        compValue: compVal
                    }
                }
            }, function (err, doc) {
                if(err) {
                    res.render('error', {
                        title: 'Error',
                        error_message: 'Couldn\'t subscribe.'
                    });
                } else {
                    res.redirect('/subscriptions');
                }
            });

        } else {
            observerMapCollection.insert({
                observedDeviceID: observed,
                observedCommandID: observedCall,
                observerList: [
                    {
                        observerDeviceID : observer,
                        executedCommandID : executedCall,
                        optCheck: optCheck,
                        optType: optType,
                        sign: sign,
                        compValue: compVal
                    }
                ]
            }, function (err, doc) {
                if(err) {
                    res.render('error', {
                        title: 'Error',
                        error_message: 'Couldn\'t subscribe.'
                    });
                } else {
                    res.redirect('/subscriptions');
                }
            });
        }
    });



});

app.get('/rooms', function (req, res) {
    db.collection("rooms").find({}, {}, function (err, result) {
        if(err) {
            res.render('error', {
                title: 'Error',
                error_message: 'Couldn\'t find rooms.'
            });
        } else {
            db.collection("devices").find({}, {}, function (err, result2) {
               if (err) {
                   res.render('error', {
                       title: 'Error',
                       error_message: 'Couldn\'t find devices.'
                   });
               } else {
                   res.render('rooms', {
                       title: 'Rooms',
                       rooms: result,
                       devices: result2,
                       socketMap: sessionSocketMap
                   });
               }
            });
        }
    });
});

app.post('/rooms', function (req, res) {
    var body = req.body;
    if(body.roomName.trim() !== '') {
        db.collection("rooms").insert({
            roomName: body.roomName,
            roomType: body.roomType,
            devices: []
        });
    }
    res.redirect('/rooms');
});

app.post('/addDevToRoom', function (req, res) {
    var body = req.body;

    db.collection("devices").findOne({deviceID: body.roomDevID}, function (err, result) {
        if(err || result == null) {
            res.render('error', {
                title: 'Error',
                error_message: 'Couldn\'t add device.'
            });
        } else {
            db.collection("rooms").update({
                roomName: body.roomName
            }, {
                $addToSet: {
                    devices: result
                }
            }, function (err, doc) {
                if(err) {
                    res.render('error', {
                        title: 'Error',
                        error_message: 'Couldn\'t add device.'
                    });
                } else {
                    res.redirect('/rooms');
                }
            });
        }
    });


});


app.get('/device/:deviceID', function (req, res) {
    var db = req.db;
    var devID = req.params.deviceID;
    var devices = db.collection("devices").findOne({deviceID: devID}, function (err, result) {
        if(err || result == null) {
            res.render('error',
                {title: 'Error',
                error_message: 'Cannot find device'});
        } else {
            io.emit('get values', {devID: devID});
            setTimeout(function () {
                res.render('device', {title: result.deviceName, device: result, info: tempDeviceInfo, socketMap: sessionSocketMap});
            }, 100);
            tempDeviceInfo = null;
        }
    });

});

app.post('/removeDevice', function (req, res) {
    var deviceID = req.body.deviceID;
    db.collection("devices").remove({deviceID: deviceID});
    db.collection("timers").remove({deviceID: deviceID});
    db.collection("observerMapCollection").remove({observedDeviceID: deviceID});
    db.collection("rooms").update({}, {
        $pull: {devices: {deviceID: deviceID}}},
        {multi:true});
    db.collection("observerMapCollection").update({}, {
        $pull: {observerList: {observerDeviceID: deviceID}}},
        {multi:true});

    res.redirect('/');
});

app.post('/removeFromRoom', function (req, res) {
    var deviceID = req.body.deviceID;
    db.collection("rooms").update({}, {
        $pull: {devices: {deviceID: deviceID}}},
        {multi: true}
    );

    res.redirect('/rooms');
});

app.post('/removeSubAll', function (req, res) {
    var deviceID = req.body.deviceID;
    db.collection("observerMapCollection").remove({observedDeviceID: deviceID});

    res.redirect('/subscriptions');
});

app.post('/removeSubOne', function (req, res) {
    var deviceID = req.body.deviceID;
    var observerDeviceID = req.body.observerDeviceID;
    var executedCommandID = req.body.executedCommandID;

    db.collection("observerMapCollection").update({observedDeviceID: deviceID}, {
            $pull: {observerList: {observerDeviceID: observerDeviceID, executedCommandID: executedCommandID}}},
        {multi: true}
    );

    res.redirect('/subscriptions');
});

app.post('/removeTimer', function (req, res) {
    var tID = req.body.id;
    db.collection("timers").remove({_id: tID});


    for(var i = timersList.length - 1; i >= 0; i--) {
        if(timersList[i]._id === tID) {
            timersList.splice(i, 1);
        }
    }

    res.redirect('/scheduler');
});

app.post('/exec', function (req, res) {
    var json = req.body;
    var id = json.deviceID;

    var socketObj = sessionSocketMap.get(id);
    if(socketObj != null && socketObj !== undefined) {
        socketObj.emit('exec', json);
        res.redirect('/device/' + id);
    } else {
        res.render('error', {
            title: 'Error',
            error_message: 'Socket error'
        });
    }
});


app.get('*', function (req, res) {
    res.render('error', {
        title: '404 Not found',
        error_message: '404 Not found'
    });
});

io.sockets.on('connection', function (socket) {

    socket.on('desc', function (jsonObj) {
        var deviceID = jsonObj.deviceID;
        sessionSocketMap.set(deviceID, socket);

        console.log(deviceID + ' connected.');

        var devices = db.collection("devices").findOne({deviceID: deviceID}, function (err, result) {
            if(err) {
            } else if(result == null) {
                db.collection("devices").insert(jsonObj);
            }
        });

        //setup scheduler
        findTimers(callback, deviceID);
    });

    socket.on('values', function (jsonObj) {
        tempDeviceInfo = jsonObj;
    });

    socket.on('executed', function (jsonObj) {
        var deviceID = jsonObj.deviceID;
        var commandID = jsonObj.commandID;
        var res = jsonObj.result;

        function alertObserver(observer, result) {
            var socket = sessionSocketMap.get(observer.observerDeviceID);
            if (socket) {
                var execJson = {
                    commandID: observer.executedCommandID,
                    result: result
                };
                socket.emit('executed call', execJson);
            }
        }

        var observerMapCollection = db.get('observerMapCollection');
        observerMapCollection.findOne({
            observedDeviceID: deviceID,
            observedCommandID: commandID
        }, function (err, result) {
            if(result) {
                var observerList = result.observerList;
                for(i = 0; i < observerList.length; i++) {
                    var optCheck = observerList[i].optCheck;
                    if(optCheck !== 'on') {
                        alertObserver(observerList[i], res);
                    } else {
                        var optType = observerList[i].optType;
                        if(optType === 'numOpt') {
                            var sign = observerList[i].sign;
                            switch (sign) {
                                case 'less than':
                                    var compVal = observerList[i].compValue;
                                    if(res < compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'less or equal to':
                                    var compVal = observerList[i].compValue;
                                    if(res <= compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'equal':
                                    var compVal = observerList[i].compValue;
                                    if(res === compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'greater or equal to':
                                    var compVal = observerList[i].compValue;
                                    if(res >= compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'greater than':
                                    var compVal = observerList[i].compValue;
                                    if(res > compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                            }

                        } else if(optType === 'stringOpt') {
                            if(res === observerList[i].compValue) {
                                alertObserver(observerList[i], res);
                            }
                        } else if(optType === 'boolOpt') {
                            var sign = observerList[i].sign;
                            switch (sign) {
                                case 'false':
                                    if(res === false) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'true':
                                    if(res === true) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                            }
                        }
                    }
                }

            } else {
            }
        });
    });

    socket.on('disconnect', function () {
        var deviceID;

        for(let [key, value] of sessionSocketMap) {
            if(value === socket) {
                deviceID = key;
                sessionSocketMap.delete(key);
            }
        }

        //remove timers for offline device
        for(var i = timersList.length - 1; i >= 0; i--) {
            if(timersList[i].deviceID === deviceID) {
                timersList.splice(i, 1);
            }
        }

        console.log(deviceID + ' disconnected.');
    });
});

function callback(timers) {
    if(timers && timers.length > 0) {
        for (var i = 0; i < timers.length; i++) {
            var timer = timers[i];

            timer.counter = 0;

            timersList.push(timer);
        }
    }
}

function findTimers(callback, devID) {
    db.collection("timers").find({deviceID: devID}, {}, function (err, docs) {
        if(err) {

        } else {
            callback(docs);
        }
    });
}

function periodicallyExecute() {
    for(var i = 0; i < timersList.length; i++) {
        timersList[i].counter++;
        if (timersList[i].counter === parseInt(timersList[i].interval)) {
            timersList[i].counter = 0;
            var json = {
                deviceID: timersList[i].deviceID,
                commandID: timersList[i].commandID,
                params: timersList[i].params
            };

            var socketObj = sessionSocketMap.get(timersList[i].deviceID);
            if (socketObj != null && socketObj !== undefined) {
                socketObj.emit('exec', json);
            }
        }
    }
}


server.listen(process.env.PORT || 3000);

