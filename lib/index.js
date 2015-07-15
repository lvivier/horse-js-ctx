
/**
 * Dependencies
 */

var Bing = require('node-bing-api')
var Twit = require('twit')
var fmt = require('util').format
var debug = require('debug')('horse')
var env = process.env

/**
 * HorseJS context helper
 */

exports = module.exports = function () {
  var twit = new Twit({
    consumer_key: env.TWITTER_CONSUMER_KEY,
    consumer_secret: env.TWITTER_CONSUMER_SECRET,
    access_token: env.TWITTER_ACCESS_TOKEN,
    access_token_secret: env.TWITTER_ACCESS_TOKEN_SECRET
  })
  var bing = new Bing({accKey: env.BING_ACCESS_KEY})

  return new HorseContext(twit, bing)
}

exports.HorseContext = HorseContext

function HorseContext (twit, bing) {
  this.twit = twit
  this.bing = bing
}

/**
 * Get recent HorseJS tweets
 * @param {number}   n
 * @param {function} cb
 */

HorseContext.prototype.getRecentTweets = function (n, cb) {
  debug('getting %s recent tweets', n)
  this.twit.get('/search/tweets', q('from:horse_js', n), function (err, data) {
    if (err) return cb(err)
    cb(null, data.statuses
      .filter(function(t){ return t.text.indexOf('@') !== 0 }))
  })
}

/**
 * Get a stream of HorseJS tweets
 */

HorseContext.prototype.stream = function () {
  return this.twit.stream('statuses/filter', {track:'from:horse_js'})
}

/**
 * Try to find what inspired a given HorseJS-ism
 * @param {string}   str
 * @param {function} cb
 */

HorseContext.prototype.findSource = function (str, cb) {
  var self = this
  debug('finding inspiration')
  this.findTweetSource(str, function(err, tweet){
    if (err) return cb(err)
    if (tweet) debug('tweet source: %s', tweet.text)
    if (tweet) {
      cb(null, {
        text: tweet.text,
        url: fmt('https://twitter.com/%s/status/%s', tweet.user.screen_name, tweet.id_str),
        date: new Date(tweet.created_at).toISOString()
      })
    }
    else {
      self.findWebSource(str, function(err, src){
        if (err) return cb(err)
        if (src) cb(null, src)
        else cb(null, null)
      })
    }
  })
}

/**
 * Try to find a tweet
 * @api private
 */

HorseContext.prototype.findTweetSource = function (str, cb) {
  this.twit.get('/search/tweets', q(fmt('"%s"', str)), function (err, data) {
    if (err) return cb(err)
    cb(null, data.statuses
      .map(function(s){ return ('retweeted_status' in s) ? s.retweeted_status : s })
      .filter(function(s){ return 'horse_js' !== s.user.screen_name })
      .sort(function(s){ return (~s.text.indexOf(str)) ? -1 : 1 })
      .shift())
  })
}

/**
 * Try to find a web page
 * @api private
 */

HorseContext.prototype.findWebSource = function (str, cb) {
  this.bing.web(fmt('"%s"', str), {top:3}, function (err, res, body) {
    if (err) return cb(err)
    // TODO exclude stuff from twitter
    cb(null, body.d.results
      .filter(function(r){ return !~r.Url.indexOf('twitter.com') })
      .sort(function(r){ return (~r.Description.indexOf(str)) ? -1 : 1 })
      .map(function(r){ return {text:r.Description, url:r.Url} })
      .shift())
  })
}

function q (str, count) {
  return {
    q: str,
    lang: 'en',
    result_type: 'recent',
    count: count || 10
  }
}
