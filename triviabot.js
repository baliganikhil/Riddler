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

    function obfuscate(input) {
		return input.replace(/ /g, '<span class="junk_data">i</span>');
	};

	socket.on('connect', function() {
		socket.on('riddler_msg', function(data) {
			data.msg = obfuscate(data.msg);

			// Highlight my nick
			var mynick = new RegExp($scope.nick, 'g');
			data.msg = data.msg.replace(mynick, '<span class="my_nick">' + $scope.nick + '</span>');

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

			hide_popup();
		});
	});

	$scope.set_nick = function() {
		var nick = $scope.nick;

		if (nullOrEmpty(nick)) {
			return false;
		} else if (nick.length > 12) {
			alert('Your nick is too long. Max 12 characters allowed');
			return false;
		}

		socket.emit('set_nick', {nick: nick});

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