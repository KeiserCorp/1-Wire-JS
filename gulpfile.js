var gulp = require('gulp');
var watch = require('gulp-watch');
var source = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var browserify = require('browserify');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var owjs = './src/ow.js';
var mainjs = './test/main.js';

gulp.task('ow', function () {
	browserify(owjs, {
			standalone: 'ow'
		})
		.bundle()
		.pipe(source(owjs))
		.pipe(rename({
			dirname: "/"
		}))
		.pipe(gulp.dest('./dist'));
});

gulp.task('ow-min', function () {
	browserify(owjs, {
			standalone: 'ow'
		})
		.bundle()
		.pipe(source(owjs))
		.pipe(streamify(uglify()))
		.pipe(rename({
			dirname: "/",
			suffix: ".min"
		}))
		.pipe(gulp.dest('./dist'));
});

gulp.task('bundle', function () {
	browserify(mainjs)
		.bundle()
		.pipe(source(mainjs))
		.pipe(rename({
			basename: "bundle"
		}))
		.pipe(gulp.dest('./'));
});

gulp.task('default', function () {
	gulp.start('ow', 'ow-min', 'bundle');
});

gulp.task('watch', function () {
	gulp.watch(owjs, ['ow', 'ow-min', 'bundle']);
	gulp.watch(mainjs, ['bundle']);
});
