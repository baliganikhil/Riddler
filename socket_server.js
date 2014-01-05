var io = require('socket.io').listen(8888);
var fs = require('fs');

/***********************************/
var mongoose = require('mongoose');
var User = '';
var Question = '';
var db_connection = 'mongodb://localhost/riddler';
/***********************************/

var all_users = {};

var game_started = false;
var RIDDLER = 'Riddler';

/*
    Phase 0: Ask question
    Phase 1: Hint 1
    Phase 2: Hint 2
*/

var total_question_count = 0;


var phase = 0;
var category = '';
var question = '';
var answer = '';
var hint = '';
var is_answered = false;

var streak = {nick: '', streak: 0};
var MAX_STREAK = 3;

String.prototype.replaceAt = function(index, character) {
  return this.substr(0, index) + character + this.substr(index + character.length);
}

var questions = [];

// Initialising Functions
(function() {
    init_mongoose_schema();
    get_question_count();

})();


/************************************************/
// Reload questions once in every x hours
var time_to_load_questions = 3 * 60 * 60 * 1000;
setInterval(function() {
    save_players_data(all_users);
    get_question_count();
}, time_to_load_questions);
/************************************************/


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

        // Check if user exists
        function callback(nick, msg) {
            console.log('Inside call back');
            riddler_broadcast(nick, msg);
            send_user_info();
        };

        get_player_data(nick, callback);

        allClients.push(socket);
    });

    function obfuscate(input) {
        return input.replace(/ /g, '<span class="junk_data">i</span>');
    };

    socket.on('submit_msg', function(data) {
        var msg = data.msg;
        var nick = socket.nick;

        if (swearing_detected(msg)) {
            var payload = {nick: RIDDLER, msg: "Don\'t use offensive words... Wash your mouth with soap x-("};
            socket.emit('riddler_msg', payload);
            return false;
        }


        riddler_broadcast(nick, msg);

        // Check if answer is correct
        if ([1, 2, 3].indexOf(phase) > -1) {
            if (msg.toLowerCase().trim() === answer) {
                all_users[nick] += 1;
                var reply = 'Correct! The answer is ' + answer + '. ' + nick + ' got it right. Score: ' + all_users[nick] + '. ';

                if (streak.nick == nick) {
                    streak.streak += 1;

                    if (streak.streak >= MAX_STREAK) {
                        reply += streak.nick + ' is on a streak with ' + streak.streak + ' consecutive points!';
                    }
                } else {
                    if (streak.streak >= MAX_STREAK) {
                        reply += streak.nick + '\'s streak of ' + streak.streak + ' has been broken!';
                    }

                    streak.nick = nick;
                    streak.streak = 1;
                }

                riddler_broadcast(RIDDLER, reply);
                check_milestone(nick);
                send_user_info();
                is_answered = true;

                phase = 4;
            }
        }
    });

    socket.on('disconnect', function() {
        var nick = socket.nick;
        var score = all_users[nick];

        if (score > 0) {
            var payload = {};
            payload[nick] = score;
            save_players_data(payload);
        }

        delete all_users[nick];

        var i = allClients.indexOf(socket);
        allClients.splice(i, 1);

        if (nick != undefined) {
            riddler_broadcast(RIDDLER, nick + ' has left...');
        }

        send_user_info();

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

    function check_milestone(nick) {
        var milestones = [5, 10, 25, 50, 75];
        var score = all_users[nick];

        if (milestones.indexOf(score) > -1 || score % 100 === 0) {
            var congrats = 'Congratulations ' + nick + '! You have reached a milestone with ' + score + ' points. Let\'s see how far you can go';
            riddler_broadcast(RIDDLER, congrats);
        }

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

            function callback(doc) {
                is_answered = false;

                try {
                    category = doc.category.replace(/_/g, ' ');
                    question = doc.question;
                    answer = doc.answer;

                    answer = answer.toLowerCase().trim().replace(/[ ]+/g, ' ');
                } catch (e) {
                    riddler_broadcast(RIDDLER, 'I hope you are excited');
                    return;
                }

                var msg = 'Category: ' + category + '...   ' + obfuscate(question);
                riddler_broadcast(RIDDLER, msg);

                hint = generate_hint();
                riddler_broadcast(RIDDLER, 'Hint: ' + hint);

                phase += 1;
            }

            get_question(callback);

        } else if (phase == 1 || phase == 2) {
            hint = generate_hint();
            riddler_broadcast(RIDDLER, 'Hint: ' + hint);
            phase += 1;
        } else if (phase == 3) {
            var msg = 'Nobody got that one. The answer is ' + answer + '. ';

            if (streak.streak >= MAX_STREAK) {
                msg += streak.nick + ' was on a streak with ' + streak.streak + ' consecutive points! Too bad...';
            }

            streak = {nick: '', streak: 0};
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

function init_mongoose_schema() {
    var userSchema = mongoose.Schema({
        nick: String,
        score: Number
    });

    var questionSchema = mongoose.Schema({
        qid: Number,
        category: String,
        question: String,
        answer: String,
    });

    User = mongoose.model('User', userSchema);
    Question = mongoose.model('Question', questionSchema);
}

function save_players_data(usergroup) {
    mongoose.connect(db_connection);

    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {

        for (nick in usergroup) {
            User.findOneAndUpdate({nick: nick}, {score: usergroup[nick]}, {upsert: true}, function(err, doc) {
                if (err) {
                    console.log(err);
                }

                console.log('Saved: User - ' + nick);
            });
        }

        db.close();
    });
}

function get_player_data(nick, callback) {
    mongoose.connect(db_connection);

    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
        User.findOne({nick: nick}, function(err, doc) {
            if (doc == null) {
                // New user
                all_users[nick] = 0;

                var welcome = 'Hey ' + nick + '! Welcome to The Riddler. Play nice and no Googling!'
                callback(RIDDLER, welcome);
                console.log('New user');
            } else {
                // Existing user
                all_users[nick] = doc.score;
                var welcome = 'Hey ' + nick + '! Welcome back. Your score is ' + all_users[nick];
                callback(RIDDLER, welcome);
                console.log('Existing user');
            }

            db.close();

        });
    });
}

function get_question(callback) {
    var qno = Math.round(Math.random() * total_question_count * 100) % total_question_count;
    qno = qno == 0 ? 1 : qno;

    mongoose.connect(db_connection);
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
        Question.findOne({qid: qno}, function(err, doc) {
            console.log(doc);

            if (doc == null) {

            } else {
                callback(doc);
            }

            db.close();

        });
    });
}

function get_question_count() {
    mongoose.connect(db_connection);

    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    db.once('open', function() {
        Question.count(function(err, count) {

            console.log('Found ' + count + ' questions');
            total_question_count = count;
            db.close();

        });
    });
}

function swearing_detected(input) {
    var swear_words = ['shit', 'fuck', 'dick', 'cunt', 'bitch', 'penis', 'cock', 'whore'];

    var split_input = input.split(' ');
    var found_swear = false;
    split_input.forEach(function(each_word) {
        if (swear_words.indexOf(each_word) > -1) {
            found_swear = true;
            return false;
        }
    });

    return found_swear;
}