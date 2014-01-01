module.exports = function(grunt) {
	grunt.initConfig({
		sass: {
		    dist: {
				files: [{
					expand: true,
					cwd: '.',
					src: ['*.scss'],
					dest: '.',
					ext: '.css'
				}]
		    }
		},

		watch: {
			files: ['*.scss'],
			tasks: ['sass']
		}
	});

	grunt.loadNpmTasks('grunt-contrib-sass');
	grunt.loadNpmTasks('grunt-contrib-watch');

	grunt.registerTask('default', ['sass']);
};