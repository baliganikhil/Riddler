var mongoose = require('mongoose');
var fs = require('fs');

var db_connection = 'mongodb://localhost/riddler';
var folder = './questions';

var files = fs.readdirSync(folder);

// Connect to mongo
var connection = mongoose.connect(db_connection);
var db = connection.connection;
db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function() {
	console.log('Connection Opened');

	// Schema
	var questionSchema = mongoose.Schema({
		qid: Number,
		category: String,
		question: String,
		answer: String
	});

	var Question = mongoose.model('Question', questionSchema);

	var question_counter = 0;

	files.forEach(function(filename) {
		console.log('Processing file: ' + filename);
		var split_string = filename.split('.');

	    if (split_string[split_string.length - 1] != 'csv') {
	        return true;
	    } else {
	        filename = folder + '/' + filename;
	    }

	    var contents = fs.readFileSync(filename, 'utf-8');
        var questions = contents.split(/\r?\n/);

        questions.forEach(function(question) {
        	var category;
			var question;
			var answer;

        	try {
        		var split_question = question.split('^');
	        	category = split_question[0];
	        	question = split_question[1];
	        	answer = split_question[2];
        	} catch (e) {
        		console.log('Problem encountered in File: ' + filename + ' -> String: ' + question);
        		return true;
        	}

        	var new_question = new Question({qid: question_counter, category: category, question: question, answer: answer});
        	new_question.save(function(err, doc) {

        		if (err) {
        			return console.error("Error while saving data to MongoDB");
        		}

        	});

        	question_counter += 1;

        });


	});

	db.close();
});

