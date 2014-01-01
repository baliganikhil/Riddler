var io = require('socket.io').listen(8888);
var fs = require('fs');

var all_users = {};
var game_started = false;
var RIDDLER = 'Riddler';

var inactive_users = {};

/*
    Phase 0: Ask question
    Phase 1: Hint 1
    Phase 2: Hint 2
*/

var phase = 0;
var category = '';
var question = '';
var answer = '';
var hint = '';
var is_answered = false;

var streak = {nick: '', streak: 0};

String.prototype.replaceAt = function(index, character) {
  return this.substr(0, index) + character + this.substr(index + character.length);
}

var questions = [];
generate_questions();

var allClients = [];

io.sockets.on('connection', function(socket) {

    socket.on('set_nick', function(data) {
        var nick = data.nick;

        if (nick.length > 12) {
            nick = nick.slice(0, 12);
        }

        // Check if nick already exists
        var nick_exists = false;
        allClients.forEach(function(client) {
            if (client.nick == nick) {
                nick_exists = true;
                return false;
            }
        });

        if (nick_exists) {
            socket.emit('set_nick', {error: 'Nick ' + nick + ' is being used. Choose a different nick'});
            return false;
        } else {
            socket.emit('set_nick', {error: ''});
            socket.nick = nick;
        }


        if (inactive_users.hasOwnProperty(nick)) {
            // Returning user
            all_users[nick] = inactive_users[nick] == undefined ? 0 : inactive_users[nick];
            var welcome = 'Hey ' + nick + '! Welcome back. Your score is ' + all_users[nick];
            riddler_broadcast(RIDDLER, welcome);

        } else if (!all_users.hasOwnProperty(nick)) {
            all_users[nick] = 0;

            var welcome = 'Hey ' + nick + '! Welcome to The Riddler. Play nice and no Googling!'
            riddler_broadcast(RIDDLER, welcome);
        }

        send_user_info();

        allClients.push(socket);
    });

    socket.on('submit_msg', function(data) {
        var msg = data.msg;
        var nick = socket.nick;
        riddler_broadcast(nick, msg);

        // Check if answer is correct
        if ([1, 2, 3].indexOf(phase) > -1) {
            if (msg.toLowerCase().trim() === answer) {
                all_users[nick] += 1;
                var reply = 'Correct! The answer is ' + answer + '. ' + nick + ' got it right. Score: ' + all_users[nick] + '. ';

                if (streak.nick == nick) {
                    streak.streak += 1;

                    if (streak.streak >= 3) {
                        reply += streak.nick + ' is on a streak with ' + streak.streak + ' consecutive points!';
                    }
                } else {
                    streak.nick = nick;
                    streak.streak = 1;
                }

                riddler_broadcast(RIDDLER, reply);

                send_user_info();
                is_answered = true;

                phase = 4;
            }
        }
    });

    socket.on('disconnect', function() {
        var nick = socket.nick;

        inactive_users[nick] = all_users[nick];
        delete all_users[nick];

        var i = allClients.indexOf(socket);
        allClients.splice(i, 1);

        riddler_broadcast(RIDDLER, nick + ' has left...');

    });

    function riddler_broadcast(nick, msg) {
        var payload = {nick: nick, msg: msg};

        socket.broadcast.emit('riddler_msg', payload);
        socket.emit('riddler_msg', payload);
    }

    function send_user_info() {
        socket.broadcast.emit('user_joined', all_users);
        socket.emit('user_joined', all_users);
    }

    /**************************************************/
    /* The following code runs ONLY ONCE */
    if (game_started) {
        return;
    } else {
        game_started = true;
    }

    setInterval(function() {
        var question_ctr = 0;
        if (phase === 0) {
            question_ctr = Math.round(Math.random() * questions.length * 100) % questions.length;
            is_answered = false;

            var raw_question = questions[question_ctr]
            var split_string = raw_question.split('^');

            category = split_string[0].replace('_', ' ');
            question = split_string[1];
            answer = split_string[2].toLowerCase().trim();

            answer = answer.replace(/[ ]+/g, ' ');

            var msg = 'Category: ' + category + '...   ' + question;
            riddler_broadcast(RIDDLER, msg);

            hint = generate_hint();
            riddler_broadcast(RIDDLER, 'Hint: ' + hint);

            phase += 1;

        } else if (phase == 1 || phase == 2) {
            hint = generate_hint();
            riddler_broadcast(RIDDLER, 'Hint: ' + hint);
            phase += 1;
        } else if (phase == 3) {
            var msg = 'Nobody got that one. The answer is ' + answer;
            riddler_broadcast(RIDDLER, msg);
            phase = 0;
        } else {
            phase = 0;
        }

    }, 10000);

});

function generate_hint() {
    if (phase === 0) {
        return answer.replace(/[^ \.]/g, '*');
    }

    var uncovered_count = 0;
    var covered_count = 0;
    var max_uncover = 3;

    for (var i = 0; i < hint.length; i++) {
        if (hint.charAt(i) === '*') {
            covered_count += 1;
        }
    }

    if (covered_count - max_uncover <= 0) {
        return hint;
    }

    do {
        var index =  Math.round(Math.random() * 100) % hint.length;
        if (hint.charAt(index) == '*') {
            hint = hint.replaceAt(index, answer[index]);
            uncovered_count += 1;
        }

    } while(uncovered_count !== 3);

    return hint;

}

function generate_questions() {
    questions = [];
    var folder = './questions';

    var question_files = fs.readdirSync(folder);
    question_files.forEach(function(filename) {
        var split_string = filename.split('.');

        if (split_string[split_string.length - 1] != 'csv') {
            return true;
        } else {
            filename = folder + '/' + filename;
        }

        fs.readFile(filename, 'utf-8', function(err, data) {

            if (err !== null) {
                console.log(err);
                return true;
            }

            questions = questions.concat(data.split('\r\n'));

            console.log('Loading ' + filename + '...');
            console.log('Rejoice! We have ' + questions.length + ' questions');
        });
    });


}