/**
* TriviaBot Module
*
* Description
*/
var TriviaBot = angular.module('TriviaBot', []);

TriviaBot.controller('TriviaBotController', function($scope, $sce) {
	var socket = '';
	if (location.href.indexOf('nikhilbaliga') > -1) {
		socket = io.connect('http://www.nikhilbaliga.com:8888');
	} else {
		socket = io.connect('http://localhost:8888');
	}

	$scope.all_msgs = [];

	$scope.to_trusted = function(html_code) {
    	return $sce.trustAsHtml(html_code);
    };

	socket.on('connect', function() {
		socket.on('riddler_msg', function(data) {
			// Highlight my nick
			var mynick = new RegExp($scope.nick, 'g');
			if (!nullOrEmpty($scope.nick)) {
				data.msg = data.msg.replace(mynick, '<span class="my_nick">' + $scope.nick + '</span>');
			}

			data.msg = put_smileys(data.msg);

			$scope.all_msgs.push(data);
			$scope.$apply();

			document.getElementById('message_list').scrollByPages(100);

			// Keep only recent x messages
			if ($scope.all_msgs.length > 100) {
				$scope.all_msgs.splice(0, 1);
			}
		});

		socket.on('user_joined', function(data) {
			$scope.all_users = data;
			$scope.$apply();
		});

		socket.on('set_nick', function(data) {
			if (data.error !== '') {
				alert(data.error);
				return;
			}

			$scope.nick = $scope.nick_field;
			hide_popup();
		});
	});

	$scope.set_nick = function() {
		var nick = $scope.nick_field;

		socket.emit('set_nick', {nick: nick});
	};

	$scope.validate_nick = function() {
		return !($scope.nick_has_space() || $scope.nick_too_long());
	};

	$scope.nick_has_space = function() {
		var nick = $scope.nick_field;

		if (nick && nick.indexOf(' ') > -1) {
			return true;
		} else {
			return false;
		}
	};

	$scope.nick_too_long = function() {
		var nick = $scope.nick_field;

		if (nick && nick.length > 12) {
			return true;
		} else {
			return false;
		}
	};

	$scope.submit_msg = function() {
		var msg = $scope.my_msg;

		if (nullOrEmpty(msg)) {
			return false;
		}

		var payload = {nick: $scope.nick, msg: msg};

		socket.emit('submit_msg', payload);

		$scope.prev_msg = $scope.my_msg;
		$scope.my_msg = undefined;
	};

	$scope.is_riddler = function(nick) {
		return nick == 'Riddler';
	};

	$scope.key_pressed = function(e) {
		if (e.which == 38) {
			$scope.my_msg = $scope.prev_msg;
		}
	};

});

function nullOrEmpty(input) {
	return ['', undefined, null].indexOf(input) > -1;
}

function hide_popup() {
	document.getElementById('modal_backdrop').className += ' hide'
	document.getElementById('popup').className += ' hide'
}

function put_smileys(input) {

	input = input.replace(/ :(\-)?\)/g, gen_smiley(':)'));
	input = input.replace(/ :(\-)?\(/g, gen_smiley(':('));
	input = input.replace(/ ;(\-)?\)/g, gen_smiley(';)'));
	input = input.replace(/ :(\-)?P/g, gen_smiley(':P'));
	input = input.replace(/ :(\-)?\//g, gen_smiley(':/'));
	input = input.replace(/ :(\-)?D/g, gen_smiley(':D'));
	input = input.replace(/ x(\-)?\(/g, gen_smiley('x('));
	input = input.replace(/ B(\-)?\)/g, gen_smiley('B)'));
	input = input.replace(/ \*ban\*/g, gen_smiley('*ban*'));
	input = input.replace(/ o\.O/g, gen_smiley('o.O'));

	return input;
}

function gen_smiley(smiley) {
	var base_url = '//www.freesmileys.org/smileys/smiley-basic/';
	var img_url = '';

	switch (smiley) {
		case ':)':
			img_url = 'smile.gif';
			break;

		case ':(':
			img_url = 'sad.gif';
			break;

		case ':P':
			img_url = 'tongue.gif';
			break;

		case ':D':
			img_url = 'biggrin.gif';
			break;

		case ';)':
			img_url = 'wink.gif';
			break;

		case ':/':
			img_url = 'dry.gif';
			break;

		case 'B)':
			img_url = 'cool.gif';
			break;

		case 'x(':
			img_url = 'mad.gif';
			break;

		case '*ban*':
			img_url = 'banned.gif';
			break;

		case 'o.O':
			img_url = 'blink.gif';
			break;
	}

	return '<img src="' + base_url + img_url + '" title="freesmileys.org"/>';
}
