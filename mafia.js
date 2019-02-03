var express = require('express');
var app = express();
var path = require('path');
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, () => {
    console.log('Server listening at port %d', port);
});

app.use(express.static(path.join(__dirname, 'public')));

// Chatroom
let maximumUserCount = 8;

//mafia play for 8 people
let mafiaCnt = 3;
let citizenCnt = 3;
let policerCnt = 1;
let doctorCnt = 1;


//role
let CONST_MAFIA = 0;
let CONST_CITIZEN = 1;
let CONST_POLICER = 2;
let CONST_DOCTOR = 3;

//day or night
let CONST_NIGHT = 0;
let CONST_DAY = 1;

//guess
let CONST_GUESS_CITIZEN = '1';
let CONST_GUESS_MAFIA = '2';

//live or kill
let CONST_LIVE = '1';
let CONST_KILL = '2';

//wait for last speak time
let lastSpeakTime = 3;


//wait for next guess
let guessWaitTime = 3;


var numUsers = 0;
var gameisOn = false;
var players = [];
var dayOrNight = 1;

var aliveUser = 8;

var mafiaPointTarget = '';
var mafiaPoint = false;
var mafiaPointCnt = 0;
var mafiaPointReceived = new Map();

var thumbUpDownTarget = '';
var thumbUpDown = false;
var thumbUpDownCnt = 0;
var thumbUpDownReceived = new Map();

var currentMafiaCnt = 3;
var currentCitizenCnt = 5;

var policeChance = false;
var doctorChance = false;
var doctorSaveUser = '';

var mafiaKill = false;
var mafiaKillCnt = 0;
var mafiaKillReceived = new Map();


io.on('connection', (socket) => {
    var addedUser = false;

    console.log('client connected! socket.id : ' + socket.id);

    socket.on('new message', (data) => {
        console.log('new message from  [' + socket.id + ']');

        if (isNight()) {

            if (getRole(socket.username) == CONST_CITIZEN) {
                nightSleep(socket);
            } else if (getRole(socket.username) == CONST_DOCTOR) {
                if (doctorChance) {
                    if (data.startsWith('/')) {
                        doctorSaveUser = data.substring(1);
                        doctorChance = false;
                    } else {
                        nightSleep(socket);
                    }
                } else {
                    ;
                }

            } else if (getRole(socket.username) == CONST_POLICER) {
                if (policeChance) {
                    if (data.startsWith('/')) {
                        var policeCheckUser = data.substring(1);
                        var policeCheckUserRole = '시민';

                        if (getRole(policeCheckUser) == CONST_MAFIA) {
                            policeCheckUserRole = '마피아';
                        }
                        policeChance = false;
                        policeConfirm(socket, policeCheckUserRole);
                    } else {
                        nightSleep(socket);
                    }
                } else {
                    ;
                }
            } else {
                if (data.startsWith('/')) {
                    if (mafiaKill) {
                        var pointedUser = data.substring(1);

                        if (typeof mafiaKillReceived.get(pointedUser) !== 'undefined') {
                            mafiaKillReceived.set(pointedUser, mafiaKillReceived.get(pointedUser) + 1);
                        } else {
                            mafiaKillReceived.set(pointedUser, 1);
                        }

                        mafiaKillCnt++;
                        var mafiaKillingUser;
                        if (mafiaKillCnt === currentMafiaCnt) {
                            var maxPoint = 0;
                            for (var [key, value] of mafiaKillReceived) {
                                if (value > maxPoint) {
                                    mafiaKillingUser = key;
                                }
                            }

                            mafiaKill = false;
                            var nightReport;
                            if (mafiaKillingUser == doctorSaveUser) {
                                nightReport = {
                                    isSomeoneDead: false
                                };
                            } else {
                                nightReport = {
                                    isSomeoneDead: true,
                                    who: mafiaKillingUser
                                };
                            }
                            becomeDay(nightReport);
                        }
                    }
                } else {
                    nightSleep(socket);
                }
            }

        } else {
            if (data.startsWith('/') && data.endsWith('/')) {

                if (mafiaPoint) {
                    socket.emit('need wait');
                } else {
                    var pointedUser = data.substring(1, data.length - 1);
                    var user = getPlayer(socket.id);
                    var currentTime = new Date().getTime();
                    if (currentTime - user.pointTime > guessWaitTime * 1000) {
                        mafiaPointTarget = pointedUser;
                        user.pointTime = currentTime;
                        mafiaPointReceived.set(CONST_GUESS_CITIZEN, 0);
                        mafiaPointReceived.set(CONST_GUESS_MAFIA, 0);
                        pointMafia(pointedUser);
                    } else {
                        socket.emit('need wait');
                    }
                }
            } else if (data.startsWith('/') && mafiaPoint && !thumbUpDown) {

                var result = data.substring(1);
                if (typeof mafiaPointReceived.get(result) !== 'undefined') {
                    mafiaPointReceived.set(result, mafiaPointReceived.get(result) + 1);
                } else {
                    mafiaPointReceived.set(result, 1);
                }

                mafiaPointCnt++;
                if (mafiaPointCnt === aliveUser) {

                    var citizenGuessCnt = mafiaPointReceived.get(CONST_GUESS_CITIZEN);
                    var mafiaGuessCnt = mafiaPointReceived.get(CONST_GUESS_MAFIA);

                    var guessResult = {
                        mafiaResult: mafiaGuessCnt,
                        citizenResult: citizenGuessCnt
                    };
                    if (mafiaGuessCnt >= citizenGuessCnt) {
                        lastSpeak(mafiaPointTarget, guessResult);
                        mafiaPointCnt = 0;
                    } else {
                        mafiaPoint = false;
                        mafiaPointTarget = '';
                        guessFail(guessResult);
                    }
                }

            } else if (data.startsWith('/') && thumbUpDown) {
                var result = data.substring(1);
                thumbUpDownReceived.set(result, thumbUpDownReceived.get(result) + 1);
                thumbUpDownCnt++;
                if (thumbUpDownCnt === aliveUser) {

                    var liveCnt = thumbUpDownReceived.get(CONST_LIVE);
                    var killCnt = thumbUpDownReceived.get(CONST_KILL);

                    var voteResult = {
                        liveResult: liveCnt,
                        killResult: killCnt
                    };
                    if (killCnt > liveCnt) {
                        noticeDead(thumbUpDownTarget, voteResult);
                    } else {
                        noticeAlive(thumbUpDownTarget, voteResult);
                    }
                    thumbUpDown = false;
                    mafiaPoint = false;
                    thumbUpDownCnt = 0;
                    thumbUpDownTarget = '';
                    mafiaPointTarget = '';
                }
            } else {
                socket.broadcast.emit('new message', {
                    username: socket.username,
                    message: data
                });
            }
        }
    });

    socket.on('add user', (username) => {

        if (addedUser) return;
        if (numUsers == maximumUserCount) {
            socket.emit('full');
            socket.disconnect(true);
        } else {
            addedUser = userJoined(socket, username);
        }
    });

    socket.on('disconnect', () => {
        if (addedUser) {
            --numUsers;
            userLeft(socket);
        }
    });
});

function userLeft(socket) {
    console.log('disconnect  [' + socket.id + ']');
    socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
    });
}

function userJoined(socket, username) {
    console.log('add user from  [' + socket.id + ']');
    var player = {
        role: -1,
        socketId: socket.id,
        name: username,
        isAlive: true,
        pointTime: new Date().getTime()
    };
    players.push(player);

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    socket.emit('login', {
        numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
        username: socket.username,
        numUsers: numUsers
    });

    if (!gameisOn && numUsers == maximumUserCount) {
        (function(s) {
            setTimeout(function() {
                startGame(s);
            }, 5000);
        })(socket);
    }

    return true;
}

function startGame(socket) {
    console.log('startGame');
    gameisOn = true;
    socket.broadcast.emit('game ready');
    socket.emit('game ready');
    setRoles();
}

function setRoles() {

    console.log('setRoles');
    var roles = [CONST_MAFIA, CONST_MAFIA, CONST_MAFIA, CONST_CITIZEN, CONST_CITIZEN, CONST_CITIZEN, CONST_POLICER, CONST_DOCTOR];
    var shuffledRole = shuffle(roles);

    var mafiaMembers = '';
    var mafias = [];
    for (var i = 0; i < players.length; i++) {
        players[i].role = shuffledRole[i];
        if (shuffledRole[i] == CONST_MAFIA) {
            mafias.push(players[i]);
            mafiaMembers = mafiaMembers + players[i].name + ',';
        }
    }

    mafiaMembers = mafiaMembers.substring(0, mafiaMembers.length - 1);
    for (var i = 0; i < players.length; i++) {
        roleNotice(players[i].socketId, players[i].role);
    }

    for (var i = 0; i < mafias.length; i++) {
        mafiaNotice(mafias[i].socketId, mafiaMembers);
    }
}

function roleNotice(socketId, role) {
    console.log(socketId + " is " + role);
    io.sockets.connected[socketId].emit('role notice', {
        roleInfo: role
    });
}

function mafiaNotice(socketId, mafiaMembers) {
    console.log(socketId + " is " + mafiaMembers);
    io.sockets.connected[socketId].emit('mafia notice', {
        mafiaInfo: mafiaMembers
    });
}


function shuffle(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;

    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }
    return array;
}


function becomeNight() {
    dayOrNight = CONST_NIGHT;

    policeChance = true;
    doctorChance = true;
    mafiaKill = true;

    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('become night');
    }
}

function becomeDay(nightReport) {
    dayOrNight = CONST_DAY;

    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('become day', {
            report: nightReport
        });
    }

    if (nightReport.isSomeoneDead) {
        var deadUser;
        var deadUserRole;
        for (var i = 0; i < players.length; i++) {
            if (players[i].name == nightReport.who) {
                deadUser = players[i];
            }
        }
        aliveUser--;
        deadUser.isAlive = false;
        if (deadUser.role == CONST_MAFIA) {
            deadUserRole = '마피아';
            currentMafiaCnt--;
        } else {
            deadUserRole = '선량한 시민';
            currentCitizenCnt--;
        }
        if (currentCitizenCnt == currentMafiaCnt) {
            for (var i = 0; i < players.length; i++) {
                io.sockets.connected[players[i].socketId].emit('mafia win');
            }
        } else if (currentMafiaCnt == 0) {
            for (var i = 0; i < players.length; i++) {
                io.sockets.connected[players[i].socketId].emit('citizen win');
            }
        }
    }
}


function lastSpeak(mafiaPointTarget, guessResult) {
    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('guess ok', {
            result: guessResult
        });
    }
    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('last speak', {
            lastSpeakUser: mafiaPointTarget
        });
    }
    setTimeout(function() {
        thumbUpDown = true;
        thumbUpDownCnt = 0;
        thumbUpDownTarget = mafiaPointTarget;
        thumbUpDownReceived.set(CONST_LIVE, 0);
        thumbUpDownReceived.set(CONST_KILL, 0);
        for (var i = 0; i < players.length; i++) {
            io.sockets.connected[players[i].socketId].emit('thumb updown', {
                lastSpeakUser: mafiaPointTarget
            });
        }
    }, lastSpeakTime * 1000);
}

function pointMafia(pointedUser) {
    mafiaPoint = true;
    mafiaPointCnt = 0;
    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('point mafia', {
            pointedUserName: pointedUser
        });
    }
}

function getPlayer(socketId) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].socketId == socketId) {
            return players[i];
        }
    }
}


function getRole(username) {
    var user;
    for (var i = 0; i < players.length; i++) {
        if (players[i].name == username) {
            user = players[i];
        }
    }

    return user.role;
}

function noticeDead(username, voteResult) {
    var deadUser;
    var deadUserRole;
    for (var i = 0; i < players.length; i++) {
        if (players[i].name == username) {
            deadUser = players[i];
        }
    }
    aliveUser--;
    deadUser.isAlive = false;
    if (deadUser.role == CONST_MAFIA) {
        deadUserRole = '마피아';
        currentMafiaCnt--;
    } else {
        deadUserRole = '선량한 시민';
        currentCitizenCnt--;
    }
    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('notice dead', {
            name: username,
            deadUser: deadUserRole,
            result: voteResult
        });
    }

    if (currentCitizenCnt == currentMafiaCnt) {
        for (var i = 0; i < players.length; i++) {
            io.sockets.connected[players[i].socketId].emit('mafia win');
        }
    } else if (currentMafiaCnt == 0) {
        for (var i = 0; i < players.length; i++) {
            io.sockets.connected[players[i].socketId].emit('citizen win');
        }
    } else {
        becomeNight();
    }
}

function noticeAlive(username, voteResult) {
    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('notice alive', {
            aliveUser: username,
            result: voteResult
        });
    }
}

function guessFail(guessResult) {
    for (var i = 0; i < players.length; i++) {
        io.sockets.connected[players[i].socketId].emit('guess fail', {
            result: guessResult
        });
    }
}


function isNight() {
    if (dayOrNight == CONST_NIGHT) {
        return true;
    } else {
        return false;
    }
}


function status(socket) {
    var currentStatus = {
        mafia: currentMafiaCnt,
        citizen: currentCitizenCnt
    };
    socket.emit('status', {
        status: currentStatus
    });
}

function nightSleep(socket) {
    socket.emit('not allowed');
}

function policeConfirm(socket, policeCheckUserRole) {
    socket.emit('police confirm', {
        role: policeCheckUserRole
    });
}

function sendHelpManual(socket) {
    socket.emit('help  manual');
}
