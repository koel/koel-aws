require('dotenv').config();

const fs = require('fs');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const mm = require('musicmetadata');
const async = require('async');
const request = require('request');

exports.handler = function (e, ctx, cb) {
	const record = e.Records[0];

	/**
	 * Types (extensions) that we supported - for now
	 * @type {Array}
	 */
	const supportTypes = ['mp3', 'm4a', 'ogg'];

	const bucket = record.s3.bucket.name;
	const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

	// Check the media type.
	const typeMatch = key.match(/\.([^.]*)$/);
	if (!typeMatch) {
		cb('Could not determine the media type.');
		return;
	}

	const type = typeMatch[1];
	if (supportTypes.indexOf(type) === -1) {
		cb(`Unsupported media type: ${type}`);
		return;
	}

	if (record.eventName === 'ObjectCreated:Put') {
		return handlePut(bucket, key, cb);
	} else if (record.eventName === 'ObjectRemoved:Delete') {
		return handleDelete(bucket, key, cb);
	}

	cb(`Unsupported event type: ${record.eventName}`);
};

/**
 * Download the new/modified file from S3, read its tags, and post to Koel.
 * @param  {string}   bucket The bucket name
 * @param  {string}   key    The object key
 * @param  {Function} cb
 * @return {[type]}          [description]
 */
function handlePut(bucket, key, cb) {
	'use strict';

	let tags = {};
	let lyrics = ''; // Lyrics is handled differently

	async.waterfall([
		function fetch(next) {
			s3.getObject({
				Bucket: bucket,
				Key: key
			}, (err, data) => {
				if (err) {
					return cb(`Failed to fetch object from S3: ${err}`);
				}

				// In order to get the duration properly, we must write the buffer to a file.
				const fileName = `/tmp/${Math.random().toString(36)}`;
				fs.writeFileSync(fileName, data.Body);
				const parser = mm(fs.createReadStream(fileName), {duration: true}, (err, rawTags) => {
					if (err) {
						console.error(`Error reading tags: ${err}.`);
						return;
					}

					tags = rawTags;
					next();
				});

				parser.on('ULT', result => {
					lyrics = result.text;
				});
			});
		},

		/**
		 * Format the tags into something Koel can handle.
		 * @param  {Function} next
		 */
		function formatTags(next) {
			tags.lyrics = lyrics;
			tags.artist = tags.artist.length ? tags.artist[0] : '';
			tags.albumartist = tags.albumartist.length ? tags.albumartist[0] : '';
			tags.track = tags.track.no;

			if (tags.picture.length) {
				tags.cover = {
					extension: tags.picture[0].format,
					data: tags.picture[0].data.toString('base64')
				};
			}
			delete tags.picture;

			next();
		},

		function postToKoel() {
			request.post({
				url: `${process.env.KOEL_HOST}/api/os/s3/song`,
				form: {
					bucket,
					key,
					tags,
					appKey: process.env.KOEL_APP_KEY
				}
			}, err => {
				if (err) {
					console.log(`Error posting to Koel: ${err}.`);
				}
			});
		}
	], function (err) {
		if (err) {
			console.error(`Error: ${err}.`);
		} else {
			console.log(`Successfully sync ${key}`);
		}

		cb(null, 'Successful.');
	});
}

/**
 * Delete a song from Koel.
 * @param  {string}   bucket The bucket name
 * @param  {string}   key    The object key
 * @param  {Function} cb
 */
function handleDelete(bucket, key, cb) {
	request.delete({
		url: `${process.env.KOEL_HOST}/api/os/s3/song`,
		form: {
			bucket,
			key,
			appKey: process.env.KOEL_APP_KEY
		}
	}, err => {
		if (err) {
			console.log(`Error deleting song from Koel: ${err}.`);
		} else {
			cb(null, 'Successful.');
		}
	});
}
