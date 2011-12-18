var mpd = require('./mpdd');

var net = require('net');

var status;
var state = 'init';
var queuedCommand;
var lastStatus;
var statusRe = /state: (.+)/;
var randomRe = /random: (.+)/;
var songIdRe = /songid: (.+)/;
var songRe = /song: (.+)/;
var playlistIdRe = /playlist: (.+)/;
var playlistinfoRe = /Time: (.+)[^]Artist: (.+)[^]Title: (.+)[^]Album: (.+)[^]Date:.*/;
var lastState;
var lastRandom;
var lastSongId;
var lastSong;
var client;
var playlistId;
var commandBuffer;
var rawCommandBuffer = "";
var playlists = null;
var playing = null;

var currentTitle;
var currentAlbum;
var currentTime;
var currentArtist;

var conn = function() {
    if(client != null) {
        client.destroy();
    }

    console.log('reconn')
    client = net.connect(6600, 'htpc', function() {
        console.log('connected');
        client.setEncoding('utf8');
        status = "Connected";
        state = 'init';
        SS.publish.broadcast('state', status);
    });

    client.setKeepAlive(enable = true, 10000);

    client.on('data', function(data) {
        if(rawCommandBuffer.length > 0)
        {
            if(rawCommandBuffer.charAt(rawCommandBuffer.length-1) != '\n')
            {
                console.log("No newline");
                rawCommandBuffer = rawCommandBuffer.concat(data);
            }
            else
            {
                console.log("Using straight away");
                rawCommandBuffer = data;
            }
        }
        else
        {
            rawCommandBuffer = data;
        }
        if(data.charAt(data.length-1) != "\n")
        {
            return;
        }
        
        commandBuffer = rawCommandBuffer.split("\n");
        
        if(mpd.checkIfCmdEnd(commandBuffer) == 0){
            //We need more data...
            return;
        }
        
        mpd.logcommands(commandBuffer);
        
        status = "Data " + data;
        SS.publish.broadcast('state', status);
        if(data.indexOf('OK MPD') == 0) {
            console.log('logged in');
            client.write('password "getoutlozer"\n');
        }
        if(data == 'OK\n') {
            console.log('just OK');
            if(state == 'sentNoIdle') {
                console.log('high-level is ' + queuedCommand);
                if(queuedCommand == 'play') {
                    if(lastState != null) {
                        console.log('state is now ' + lastState);
                        if(lastState == 'stop') {
                            client.write('play\n');
                        } else {
                            client.write('pause\n');
                        }
                        state = 'sentCustomCommand';
                        return;
                    } else {
                        client.write('status\n');
                        state = 'sentStatus';
                        return;
                    }
                } else if(queuedCommand == 'next') {
                    client.write('next\n');
                    state = 'sentCustomCommand';
                    return;
                } else if(queuedCommand == 'prev') {
                    client.write('previous\n');
                    state = 'sentCustomCommand';
                    return;
                } else if(queuedCommand == 'random') {
                    if(lastRandom != null) {
                        if(lastRandom == '1') {
                            client.write('random 0\n');
                        } else {
                            client.write('random 1\n');
                        }
                        state = 'sentCustomCommand';
                    }
                    return;
                }
            } else if(state == 'init') {
                if(playlists == null) {
                    console.log("Fetching playlists")
                    client.write('listplaylists\n')
                    state = 'sentListplaylists'
                } else {
                    console.log('sending STATUS');
                    client.write('status\n');
                    state = 'sentStatus';
                }
                return;
            }
 
            client.write('idle\n');
            state = 'sentIdle';
 
        } else if(state == 'sentListplaylists') {
            playlists = mpd.parseLists(commandBuffer);
            SS.publish.broadcast('playlists', playlists)
            if(playing == null)
            {
                client.write('playlistinfo\n');
                state = 'sentPlaylistinfoEntire';
            }
            else
            {
                client.write('idle\n');
                state = 'sentIdle';
            }
        } else if(state == 'sentPlaylistinfoEntire') {
            var match = playlistinfoRe.exec(data);
            if(match != null){
                console.log("GOT current playing");
            }
            client.write('idle\n');
            state = 'sentIdle';
        } else if(state == 'sentIdle' && data.indexOf('changed:') == 0) {
            console.log('got idle status ');
            if(data.indexOf('player') != -1 || data.indexOf('playlist') != -1 || data.indexOf('mixer') != -1 || data.indexOf('options')) {
                client.write('status\n');
                state = 'sentStatus';
            } else {
                client.write('idle\n');
                state = 'sentIdle';
            }
        } else if(state == 'sentStatus' && data.indexOf('volume:') != -1) {
            console.log('got status');
            lastStatus = data;
            var match = statusRe.exec(lastStatus);
            lastState = match[1];
            var match = randomRe.exec(lastStatus);
            lastRandom = match[1];
            var match = playlistIdRe.exec(lastStatus);
            playlistId = match[1];
            var match = songIdRe.exec(lastStatus);
            if(match != null)
            {
                var newSongId = match[1];
                if(lastSongId != null) {
                    if(lastSongId != newSongId) {
                        console.log('Songid changed');
                        lastSongId = newSongId;
                        client.write('playlistinfo "' + lastSongId + '"\n');
                        state = 'sentPlaylistinfo';
                    }
                } else {
                    lastSongId = newSongId;
                    client.write('playlistinfo "' + lastSongId + '"\n');
                    state = 'sentPlaylistinfo';
                }
            }
            var match = songRe.exec(lastStatus);
            if(match != null) {
                var lastSong = match[1];
            }
            if(state != 'sentPlaylistinfo'){
                client.write('idle\n');
                state = 'sentIdle';
            }
        } else if(state == 'sentPlaylistinfo'){
            var match = playlistinfoRe.exec(data);
            if(match != null){
                currentTime = match[1];
                currentArtist = match[2];
                currentTitle = match[3];
                currentAlbum = match[4];
                SS.publish.broadcast('newsong', [currentTime, currentArtist, currentTitle, currentAlbum]);
            }
            client.write('idle\n');
            state = 'sentIdle';
        }
    });
    var onDiss = function() {
        status = "Disconnected";
        SS.publish.broadcast('state', status);
        console.log('error, retrying...');
        setTimeout(function() { conn();
        }, 5000);
    };

    client.on('error', function() {
        onDiss();
    });

    client.on('end', function() {
        onDiss();
    });

    client.on('timeout', function() {
        onDiss();
    });
};

conn();

var sendHighlevel = function(command) {
    if(client != null) {
        if(state == 'sentIdle') {
            client.write('noidle\n');
            state = 'sentNoIdle';
            queuedCommand = command;
        }
    }
};

exports.actions = {
    state : function(cb) {
        cb(status);
    },
    reconnect : function(cb) {
        conn();
    },
    random : function(cb) {
        sendHighlevel('random');
    },
    play : function(where, cb) {
        SS.publish.broadcast('state', 'PLAY');
        console.log('got play ' + where + ' ' + client);
        if(client != null) {
            if(where == null) {
                if(state != null && state != undefined && state == 'sentIdle') {
                    client.write('noidle\n');
                    state = 'sentNoIdle';
                    queuedCommand = 'play';
                }
            } else {
                client.write('play ' + parseInt(where) + '\n');
            }
        }
    },
    next : function(cb) {
        console.log('got next');
        if(client != null) {
            if(state != null && state != undefined && state == 'sentIdle') {
                client.write('noidle\n');
                state = 'sentNoIdle';
                queuedCommand = 'next';
            }
        }
    },
    prev : function(cb) {
        console.log('got prev');
        if(client != null) {
            if(state != null && state != undefined && state == 'sentIdle') {
                client.write('noidle\n');
                state = 'sentNoIdle';
                queuedCommand = 'prev';
            }
        }
    },
    getPlaylists : function(cb) {
        console.log('got getPlaylists');
        if(client != null) {
            if(playlists != null) {
                cb(playlists)
            }
        }
    }

};
