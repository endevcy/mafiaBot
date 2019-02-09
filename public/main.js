

let CONST_GUESS_CITIZEN = '1';
let CONST_GUESS_MAFIA = '2';
let CONST_LIVE = '1';
let CONST_KILL = '2';

//role
let CONST_MAFIA = 0;
let CONST_CITIZEN = 1;
let CONST_POLICER = 2;
let CONST_DOCTOR = 3;

$(function() {
    var FADE_TIME = 150; // ms
    var TYPING_TIMER_LENGTH = 400; // ms
    var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
    ];

    // Initialize variables
    var $window = $(window);
    var $usernameInput = $('.usernameInput'); // Input for username
    var $messages = $('.messages'); // Messages area
    var $inputMessage = $('.inputMessage'); // Input message input box

    var $loginPage = $('.login.page'); // The login page
    var $chatPage = $('.chat.page'); // The chatroom page

    // Prompt for setting a username
    var username;
    var connected = false;
    var typing = false;
    var lastTypingTime;
    var $currentInput = $usernameInput.focus();

    var socket = io();

    const addParticipantsMessage = (data) => {
        var message = '';
        if (data.numUsers === 1) {
            message += "there's 1 participant";
        } else {
            message += "there are " + data.numUsers + " participants";
        }
        log(message);
    }

    // Sets the client's username
    const setUsername = () => {
        username = cleanInput($usernameInput.val().trim());

        // If the username is valid
        if (username) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off('click');
            $currentInput = $inputMessage.focus();

            // Tell the server your username
            socket.emit('add user', username);
        }
    }

    // Sends a chat message
    const sendMessage = () => {
        var message = $inputMessage.val();
        // Prevent markup from being injected into the message
        message = cleanInput(message);
        // if there is a non-empty message and a socket connection

        if (message == '/help' || message == '/도움말') {
            help();
            $inputMessage.val('');
        } else {
            if (message && connected) {
                $inputMessage.val('');
                addChatMessage({
                    username: username,
                    message: message
                });
                // tell server to execute 'new message' and send along one parameter
                socket.emit('new message', message);
            }
        }
    }

    // Log a message
    const log = (message, options) => {
        var $el = $('<li>').addClass('log').text(message);
        addMessageElement($el, options);
    }

    // print help manual
    const help = () => {
        log('지목 : /닉네임/');

        log('투표 할지 말지 결정');
        log('찬성 : /1');
        log('반대 : /2');

        log('죽일지 말지 결정');
        log('살리기 : /1');
        log('죽이기 : /2');

        log('밤에 의사가 살리기 : /닉네임');
        log('밤에 경찰이 확인하기 : /닉네임');
        log('밤에 마피아가 죽이기 : /닉네임');

        //    log('현재 상태 확인 : /현재');
    }


    // Adds the visual chat message to the message list
    const addChatMessage = (data, options) => {
        // Don't fade the message in if there is an 'X was typing'
        var $typingMessages = getTypingMessages(data);
        options = options || {};
        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }

        var $usernameDiv = $('<span class="username"/>')
            .text(data.username)
            .css('color', getUsernameColor(data.username));
        var $messageBodyDiv = $('<span class="messageBody">')
            .text(data.message);

        var typingClass = data.typing ? 'typing' : '';
        var $messageDiv = $('<li class="message"/>')
            .data('username', data.username)
            .addClass(typingClass)
            .append($usernameDiv, $messageBodyDiv);

        addMessageElement($messageDiv, options);
    }

    // Adds the visual chat typing message
    const addChatTyping = (data) => {
        data.typing = true;
        data.message = 'is typing';
        addChatMessage(data);
    }

    // Removes the visual chat typing message
    const removeChatTyping = (data) => {
        getTypingMessages(data).fadeOut(function() {
            $(this).remove();
        });
    }

    // Adds a message element to the messages and scrolls to the bottom
    // el - The element to add as a message
    // options.fade - If the element should fade-in (default = true)
    // options.prepend - If the element should prepend
    //   all other messages (default = false)
    const addMessageElement = (el, options) => {
        var $el = $(el);

        // Setup default options
        if (!options) {
            options = {};
        }
        if (typeof options.fade === 'undefined') {
            options.fade = true;
        }
        if (typeof options.prepend === 'undefined') {
            options.prepend = false;
        }

        // Apply options
        if (options.fade) {
            $el.hide().fadeIn(FADE_TIME);
        }
        if (options.prepend) {
            $messages.prepend($el);
        } else {
            $messages.append($el);
        }
        $messages[0].scrollTop = $messages[0].scrollHeight;
    }

    // Prevents input from having injected markup
    const cleanInput = (input) => {
        return $('<div/>').text(input).html();
    }

    // Updates the typing event
    const updateTyping = () => {
        if (connected) {
            if (!typing) {
                typing = true;
                socket.emit('typing');
            }
            lastTypingTime = (new Date()).getTime();

            setTimeout(() => {
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit('stop typing');
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }

    // Gets the 'X is typing' messages of a user
    const getTypingMessages = (data) => {
        return $('.typing.message').filter(function(i) {
            return $(this).data('username') === data.username;
        });
    }

    // Gets the color of a username through our hash function
    const getUsernameColor = (username) => {
        // Compute hash code
        var hash = 7;
        for (var i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        // Calculate color
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }

    // Keyboard events

    $window.keydown(event => {
        // Auto-focus the current input when a key is typed
        if (!(event.ctrlKey || event.metaKey || event.altKey)) {
            $currentInput.focus();
        }
        // When the client hits ENTER on their keyboard
        if (event.which === 13) {
            if (username) {
                sendMessage();
                socket.emit('stop typing');
                typing = false;
            } else {
                setUsername();
            }
        }
    });

    $inputMessage.on('input', () => {
        updateTyping();
    });

    // Click events

    // Focus input when clicking anywhere on login page
    $loginPage.click(() => {
        $currentInput.focus();
    });

    // Focus input when clicking on the message input's border
    $inputMessage.click(() => {
        $inputMessage.focus();
    });

    // Socket events

    // Whenever the server emits 'login', log the login message
    socket.on('login', (data) => {
        connected = true;
        // Display the welcome message
        var message = "Welcome to Mafia world!";
        log(message, {
            prepend: true
        });
        addParticipantsMessage(data);
    });

    // Whenever the server emits 'new message', update the chat body
    socket.on('new message', (data) => {
        addChatMessage(data);
    });

    // Whenever the server emits 'user joined', log it in the chat body
    socket.on('user joined', (data) => {
        log(data.username + ' joined');
        addParticipantsMessage(data);
    });

    // Whenever the server emits 'user left', log it in the chat body
    socket.on('user left', (data) => {
        log(data.username + ' left');
        addParticipantsMessage(data);
        removeChatTyping(data);
    });

    // Whenever the server emits 'typing', show the typing message
    socket.on('typing', (data) => {
        addChatTyping(data);
    });

    // Whenever the server emits 'stop typing', kill the typing message
    socket.on('stop typing', (data) => {
        removeChatTyping(data);
    });

    socket.on('full', () => {
        log('현재 방이 다 찼습니다.');
    });


    socket.on('game ready', () => {
        log('곧 게임이 시작 됩니다.');
        setTimeout(function() {
            log('3초 후 게임이 시작 됩니다.');
            setTimeout(function() {
                log('2초 후 게임이 시작 됩니다.');
                setTimeout(function() {
                    log('1초 후 게임이 시작 됩니다.');
                    setTimeout(function() {
                        log('아침이 되었습니다.');
                        log('현재 마피아 3명, 시민5명입니다. 마피아를 찾아주세요.');
                    }, 1000);
                }, 1000);
            }, 1000);

        }, 1000);

        //    for (var i = 3; i > 0; i--) {
        //            sleep(1000);
        //            log(i+' 초 후 게임이 시작 됩니다.');
        //    (function(index) {
        //     setTimeout(function() { log(index+' 초 후 게임이 시작 됩니다.'); }, 1000);
        //     })(i);
        //    }

    });

    socket.on('role notice', (data) => {
        log('당신의 역할은 ' + getRole(data.roleInfo) + '입니다');
    });

    socket.on('mafia notice', (data) => {
        log('마피아 팀의 멤버는  ' + data.mafiaInfo + '입니다');
    });


    socket.on('become night', () => {
        log('밤이 되었습니다.');
    });

    socket.on('become day', (data) => {
        log('낮이 되었습니다.');
        if (data.report.isSomeoneDead) {
            log('지난밤 선량한 시민 ' + data.report.who + '님이 죽었습니다.');
        } else {
            log('지난밤 죽은 사람이 없습니다.');
        }
    });


    socket.on('point mafia', (data) => {
        log(data.pointerName + ' 님께서 ' + data.pointedUserName + ' 님을 마피아로 지목하였습니다. ' + data.pointedUserName + ' 님을 어떻게 생각하는지 알려주세요');
        log('다수결에 부쳐 과반 이상 마피아라고 생각하면 최후의 변론을 하게 됩니다.');
        log('/1 : 마피아가 아니라고 생각함');
        log('/2 : 마피아라고 생각함');
    });


    socket.on('vote feedback', (data) => {
        var voted = '';
        if(data.vote==CONST_GUESS_CITIZEN){
          voted = '마피아가 아니라고';
        }else{
          voted = '마피아라고';
        }
        log(data.voterName + ' 님이 ' + data.pointedUserName + ' 님을 '+voted + ' 투표 하였습니다.');
        log('현재까지 투표 결과 입니다.');
        log('마피아라고 생각함 : '+data.currentMafiaGuess);
        log('마피아가 아니라고 생각함 : '+data.currentCitizenGuess);
    });

    socket.on('kill feedback', (data) => {
        var voted = '';
        if(data.vote==CONST_KILL){
          voted = '죽이는데';
        }else{
          voted = '살리는데';
        }
        log(data.voterName + ' 님이 ' + data.pointedUserName + ' 님을 '+voted + ' 투표 하였습니다.');
        log('현재까지 투표 결과 입니다.');
        log('살린다 : '+data.currentLive);
        log('죽인다 : '+data.currentKill);
    });



    socket.on('thumb updown', (data) => {
        log('다수결 결과에 의해 최종 투표를 하겠습니다.');
        log(data.lastSpeakUser + ' 를 살릴지 죽일지 투표 해 주세요.');
        log('/1 : 살린다');
        log('/2 : 죽인다');
    });

    socket.on('last speak', (data) => {
        log('1분 후 살리기/죽이기 투표가 진행됩니다.');
        log(data.lastSpeakUser + ' 님은 최후의 변론을 해주세요.');
        log('최후의 변론 동안 다른 플레이어는 말을 할 수 없습니다.');
    });

    socket.on('notice alive', (data) => {
        log('살리기/죽이기 투표 최종 결과를 발표합니다.');
        log('살리자 :' + data.result.liveResult);
        log('죽이자 :' + data.result.killResult);
        log(data.aliveUser + ' 님이 투표 결과 살았습니다.');
        log('다시 마피아를 찾아주세요.');
    });

    socket.on('notice dead', (data) => {
        log('살리기/죽이기 투표 최종 결과를 발표합니다.');
        log('살리자 :' + data.result.liveResult);
        log('죽이자 :' + data.result.killResult);
        log(data.deadUser + ' 인 ' + data.name + ' 님이 투표 결과 죽었습니다.');
    });

    socket.on('guess fail', (data) => {
        log('다수결 최종 결과를 발표합니다.');
        log('마피아일 것이다 :' + data.result.mafiaResult);
        log('시민일 것이다 :' + data.result.citizenResult);
        log('마피아 표결 진행에 실패하였습니다. 다시 마피아를 찾아주세요.');
    });

    socket.on('guess ok', (data) => {
        log('다수결 최종 결과를 발표합니다.');
        log('마피아일 것이다 :' + data.result.mafiaResult);
        log('시민일 것이다 :' + data.result.citizenResult);
        log('마피아 표결 진행에 성공하였습니다.');
    });

    socket.on('user nonexist', () => {
        log('존재하지 않거나 이미 죽은 사용자 입니다.');
    });

    socket.on('invalid vote', () => {
        log('투표 입력에 오류가 있습니다. 아래와 같이 입력해주세요.');
        log('/1 : 마피아가 아니라고 생각함');
        log('/2 : 마피아라고 생각함');
    });

    socket.on('invalid kill', () => {
        log('최종 투표 입력에 오류가 있습니다. 아래와 같이 입력해주세요.');
        log('/1 : 살린다');
        log('/2 : 죽인다');
    });

    socket.on('doctor work', (data) => {
        log('의사는 밤사이 한명을 지정하여 살릴 수 있습니다.');
        log('현재 살아있는 플레이어는 ' + data.aliveNames + '입니다.');
        log('살릴 플레이어를 아래와 같이 입력해주세요.');
        log('/닉네임');
    });

    socket.on('police work', (data) => {
      log('경찰은 밤사이 한명을 지정하여 마피아인지 확인할 수 있습니다.');
      log('현재 살아있는 플레이어는 ' + data.aliveNames + '입니다.');
      log('확인하고 싶은 플레이어를 아래와 같이 입력해주세요.');
      log('/닉네임');
    });

    socket.on('mafia work', (data) => {
      log('마피아는 밤사이 한명을 지정하여 죽일 수 있습니다.');
      log('현재 살아있는 플레이어는 ' + data.aliveNames + '입니다.');
      log('현재는 마피아들끼리 서로 다른 닉네임을 지정할 경우 다수결에 의해 결정됩니다.');
      log('죽일 플레이어를 아래와 같이 입력해주세요.');
      log('/닉네임');
    });


    socket.on('mafia win', () => {
        log('마피아의 승리로 게임이 종료되었습니다.');
    });


    socket.on('citizen dead', (data) => {
        log('시민의 승리로 게임이 종료되었습니다.');
    });


    socket.on('not allowed', () => {
        log('밤에는 대화를 할 수 없습니다.');
    });

    socket.on('doctor confirm', (data) => {
        log(data.protectedName + ' 님을 살리기로 지목하였습니다.');
    });

    socket.on('police confirm', (data) => {
        log('그 사람은 ' + data.role + ' 입니다.');
    });


    socket.on('mafia feedback', (data) => {
        log('마피아 ' + data.mafiaName + '님은 '+ data.pointedName+' 님을 죽이길 원합니다.');
    });

    socket.on('disconnect', () => {
        log('you have been disconnected');
    });

    socket.on('need wait', () => {
        log('마피아 지목 이후 최소 1분 이후 다시 지목 가능합니다.');
    });

    socket.on('alive users', (data)=>{
      log('현재 살아있는 플레이어는 '+ data.names +' 입니다.');
      log('현재 살아있는 마피아는 총 '+ data.mafiaCnt +' 명 입니다.');
    });

    socket.on('one only', () => {
        log('한 밤동안 의사는 한명만 살리고, 경찰은 한명만 확인할 수 있습니다.');
    });

    socket.on('reconnect', () => {
        log('you have been reconnected');
        if (username) {
            socket.emit('add user', username);
        }
    });

    socket.on('reconnect_error', () => {
        log('attempt to reconnect has failed');
    });

});

function sleep(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay);
}

function getRole(role) {
    if (role === CONST_MAFIA) {
        return '마피아';
    } else if (role === CONST_CITIZEN) {
        return '시민';
    } else if (role === CONST_POLICER) {
        return '경찰';
    } else if (role === CONST_DOCTOR) {
        return '의사';
    }
}
