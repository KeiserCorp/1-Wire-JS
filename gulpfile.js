var gulp = require('gulp');
var watch = require('gulp-watch');
var source = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var browserify = require('browserify');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

gulp.task('ow', function () {	
	gulp.src('ow.js')
		.pipe(uglify())
		.pipe(rename({suffix: ".min"}))
		.pipe(gulp.dest('./'));
});

gulp.task('bundle', function () {
	var mainjs = './test/main.js';
	browserify(mainjs).bundle()
		.pipe(source(mainjs))
		.pipe(rename({basename: "bundle"}))
		.pipe(gulp.dest('./'));
});

gulp.task('default', function () {
	gulp.start('ow', 'bundle');
});

gulp.task('watch', function() {
    gulp.watch('ow.js', ['ow', 'bundle']);
	gulp.watch('./test/main.js', ['bundle']);
});