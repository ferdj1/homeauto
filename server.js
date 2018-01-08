var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/homedb');

var sessionSocketMap = new Map();

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
        res.render('index', {title: 'SmartHome', devices:docs, socketMap: sessionSocketMap});
    });

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

    console.log(reqBody);

    var observer = reqBody.observer;
    var executedCall = reqBody.executedCall;
    var observed = reqBody.observed;
    var observedCall = reqBody.observedCall;
    var optCheckInt = reqBody.optCheckInt;
    var optCheckString = reqBody.optCheckString;
    var optCheckBool = reqBody.optCheckBool;

    var optTypeInt = reqBody.optTypeInt;
    var optTypeString = reqBody.optTypeString;
    var optTypeBool = reqBody.optTypeBool;
    var signInt = reqBody.signInt;
    var signBool = reqBody.signBool;
    var compValInt = reqBody.compValueInt;
    var compValString = reqBody.compValueString;

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
                        optCheckInt: optCheckInt,
                        optTypeInt: optTypeInt,
                        signInt: signInt,
                        compValueInt: compValInt,
                        optCheckString : optCheckString,
                        optCheckBool: optCheckBool,
                        optTypeString : optTypeString,
                        optTypeBool : optTypeBool,
                        signBool: signBool,
                        compValueString : compValString
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
                        optCheckInt: optCheckInt,
                        optTypeInt: optTypeInt,
                        signInt: signInt,
                        compValueInt: compValInt,
                        optCheckString : optCheckString,
                        optCheckBool: optCheckBool,
                        optTypeString : optTypeString,
                        optTypeBool : optTypeBool,
                        signBool: signBool,
                        compValueString : compValString
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
    console.log('OK!');

    socket.on('desc', function (jsonObj) {
        var deviceID = jsonObj.deviceID;
        sessionSocketMap.set(deviceID, socket);

        var devices = db.collection("devices").findOne({deviceID: deviceID}, function (err, result) {
            if(err) {
            } else if(result == null) {
                db.collection("devices").insert(jsonObj);
            }
        });
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
                    var optCheckInt = observerList[i].optCheckInt;
                    var optCheckString = observerList[i].optCheckString;
                    var optCheckBool = observerList[i].optCheckBool;
                    if(optCheckInt !== 'on' && optCheckString !== 'on' && optCheckBool !== 'on') {
                        alertObserver(observerList[i], res);
                    } else {
                        var optTypeInt = observerList[i].optTypeInt;
                        var optTypeString = observerList[i].optTypeString;
                        var optTypeBool = observerList[i].optTypeBool;
                        var optType;
                        if(optTypeInt) {
                            optType = 'intOpt';
                        } else if(optTypeString) {
                            optType = 'stringOpt';
                        } else if(optTypeBool) {
                            optType = 'boolOpt';
                        }
                        if(optType === 'intOpt') {
                            var sign = observerList[i].signInt;
                            switch (sign) {
                                case 'less than':
                                    var compVal = observerList[i].compValueInt;
                                    if(res < compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'less or equal to':
                                    var compVal = observerList[i].compValueInt;
                                    if(res <= compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'equal':
                                    var compVal = observerList[i].compValueInt;
                                    if(res === compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'greater or equal to':
                                    var compVal = observerList[i].compValueInt;
                                    if(res >= compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case 'greater than':
                                    var compVal = observerList[i].compValueInt;
                                    if(res > compVal) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                            }

                        } else if(optType === 'stringOpt') {
                            if(res === observerList[i].compValueString) {
                                alertObserver(observerList[i], res);
                            }
                        } else if(optType === 'boolOpt') {
                            var sign = observerList[i].signBool;
                            switch (sign) {
                                case false:
                                    if(res === false) {
                                        alertObserver(observerList[i], res);
                                    }
                                    break;
                                case true:
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
        for(let [key, value] of sessionSocketMap) {
            if(value === socket) {
                sessionSocketMap.delete(key);
            }
        }
    });
});


server.listen(process.env.PORT || 3000);

