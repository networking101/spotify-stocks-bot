/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var fs = require('fs');

var client_id = 'fa1b7b1aa2ca4555a4a16e5e5c33a889'; // Your client id
var client_secret_array = [98, 237, 169, 100, 145, 246, 236, 249,  43,  12, 182,  77, 101, 171, 104, 174]; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var createHexString = function(arr) {
  var result = "";
  var z;

  for (var i = 0; i < arr.length; i++){
      var x = arr[i] ^ 0xa0;
      var str = x.toString(16);
      z = 2-str.length +1;
      str = Array(z).join("0") + str;
      result += str;
  }

  return result;
}

client_secret = createHexString(client_secret_array)

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';
var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = "user-modify-playback-state playlist-read-collaborative playlist-read-private"
  
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        
        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: body.access_token,
            refresh_token: body.refresh_token
          }));
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

var get_playlists = function(offset, access_token){
  return new Promise(function (resolve, reject) {
    var authOptions = {
      url: 'https://api.spotify.com/v1/me/playlists',
      headers: { 'Authorization': 'Bearer ' + access_token },
      qs: { 'offset':  offset},
      json: true
    };

    request.get(authOptions, function (error, response, body) {
      if (!error){
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

app.get('/start_music', async function(req, res) {
  var up_playlist = {};
  var down_playlist = {};

  var total = 1;
  var offset = 0;

  while (offset < total){

    var body = await get_playlists(offset, req.query.access_token);

    total = body.total;
    offset += body.limit;

    for (var item in body.items) {
      if (body.items[item].name.toLowerCase() === req.query.up_playlist.toLowerCase()) {
        up_playlist = body.items[item];
      }
      if (body.items[item].name.toLowerCase() === req.query.down_playlist.toLowerCase()) {
        down_playlist = body.items[item];
      }
    }

    if (!(Object.keys(up_playlist).length && Object.keys(down_playlist).length)) {
      if (offset >= total) {
        var return_dict = {'status': 'failed', 'up_playlist': '', 'down_playlist': ''};
        if (!(up_playlist.uri)) {
          return_dict.up_playlist = req.query.up_playlist;
        }
        if (!(down_playlist.uri)) {
          return_dict.down_playlist = req.query.down_playlist;
        }
        res.send(return_dict);
      }
      continue;
    }
    else {
      res.send({
        'status': 'passed',
        'up_playlist': up_playlist.uri,
        'down_playlist': down_playlist.uri
      });
      console.log("Starting a player for user " + req.query.display_name)
      change_playlist(req.query.access_token, up_playlist.uri);
      break;
    }
  }  
});

app.get('/trigger_interval', function(req, res) {
  var market_value = [];
  var current_trend = req.query.current_trend;

  if (req.query.market_value) req.query.market_value.forEach(element => market_value.push(parseFloat(element)));

  var url = 'https://finance.yahoo.com/quote/' + req.query.stock_symbol
  var authOptions = {
    url: url
  }
  request.get(authOptions, function(error, reponse, body) {
    var search_string = "D(ib)\" data-reactid=\"50\">";
    var x = body.indexOf(search_string);
    search_string = body.substring(x + search_string.length, x + search_string.length + 12).replace(',','');
    x = search_string.indexOf(".")
    market_value.push(parseFloat(search_string.substring(0,x+3)))
    console.log(market_value)

    var direction = {"upwards": false, "downwards": false}
    if (market_value.length >= 5){
      direction = trending(market_value);
      console.log(direction);
      market_value.shift();
    }

    if (direction.upwards == true){
      current_trend = "up"
      if (current_trend === "down"){
        change_playlist(req.query.access_token, req.query.up_playlist);
      }
    }
    if (direction.downwards == true && current_trend !== "down"){
      current_trend = "down"
      change_playlist(req.query.access_token, req.query.down_playlist);
    }
    console.log(current_trend)

    res.send({
      'status': "passed",
      'market_value': market_value,
      'current_trend': current_trend
    });
  })
});

var trending = function(market_value){
  upwards = true;
  downwards = true;

  for (var i = 0; i < 4; i++){
    if (market_value[i] <= market_value[i+1]){
      downwards = false
    }
    if (market_value[i] >= market_value[i+1]){
      upwards = false
    }
  }

  return {"upwards": upwards, "downwards": downwards};
}

var change_playlist = function(access_token, playlist) {
  
  var authOptions = {
    url: 'https://api.spotify.com/v1/me/player/play',
    headers: { 'Authorization': 'Bearer ' + access_token },
    json: {
      context_uri: playlist
    }
  };

  request.put(authOptions, function(error, response, body) {
    if (error){
      console.log(error)
    }
  });

  return "done";
};

console.log('Listening on 8888');
app.listen(8888);