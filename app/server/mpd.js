var mpd = require('./mpdd');

var net = require('net');

var status;
var state = 'init';
var queuedCommand;
var queuedState;
var statusRe = /state: (.+)/;
var randomRe = /random: (.+)/;
var songIdRe = /songid: (.+)/;
var songRe = /song: (.+)/;
var consumeRe = /consume: (.+)/;
var repeatRe = /repeat: (.+)/;
var playlistIdRe = /playlist: (.+)/;
var playlistinfoRe = /Time: (.+)[^]Artist: (.+)[^]Title: (.+)[^]Album: (.+)[^]Date:.*/;
var lastState;
var lastRandom;
var lastSongId;
var lastSong;
var lastConsume;
var lastRepeat;
var client;
var playlistId;
var commandBuffer;
var rawCommandBuffer = "";
var playlists = null;
var lastPlaylistRefresh;
var playing = null;

var commandQueue = [];

var currentTitle;
var currentAlbum;
var currentTime;
var currentArtist;

//Queue this command, regardless of whether it is a duplicate
var queueCommand = function(command, s) {
    console.log('Queueing ' + command + ' and ' + s)
    commandQueue.push([command, s]);
}

var activateQueue = function() {
    if(state == 'sentIdle') {
        client.write('noidle\n');
        state = 'sentNoIdle';
    }
}

//Called from end of handler, where we know we are free to write command (we are not idle)
var handleQueue = function() {
    if(commandQueue.length > 0) {
        if(commandQueue.length > 10) {
            //Use command lists
            commandQueue = mpd.commandList(commandQueue, client);
        } else {
            var cmd = commandQueue.shift()
            console.log("Writing queued command " + cmd[0] + ' ' + cmd[1]);
            client.write(cmd[0]);
            state = cmd[1];
        }
    } else {
        console.log('Queue was empty');
        client.write('idle\n');
        state = 'sentIdle';
    }
}

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
        console.log("State " + state + " rcb.l:" + rawCommandBuffer.length + " d.l:" + data.length + " >" + rawCommandBuffer.charAt(rawCommandBuffer.length-1));
        if(rawCommandBuffer.length > 0)
        {
            console.log('Raw: ' + rawCommandBuffer.substring(0, 10));
            console.log("No newline");
            rawCommandBuffer = rawCommandBuffer.concat(data);
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
        
        rawCommandBuffer = "";
        mpd.logcommands(commandBuffer);
        console.log(commandQueue);
        
        status = "Data " + data.substring(0, 30);
        SS.publish.broadcast('state', status);
        if(data.indexOf('OK MPD') == 0) {
            console.log('logged in');
            client.write('password "getoutlozer"\n');
            return;
        }
        if(data == 'OK\n') {
            console.log('just OK ' + state + ' ' + queuedCommand);
            if(state == 'sentNoIdle') {
                console.log('high-level is ' + queuedCommand);
                if(queuedCommand == undefined || queueCommand == null) {
                    handleQueue();
                    return;
                } else if(queuedCommand == 'play') {
                    queuedCommand = null;
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
                    queuedCommand = null;
                    client.write('next\n');
                    state = 'sentCustomCommand';
                    return;
                } else if(queuedCommand == 'prev') {
                    queuedCommand = null;
                    client.write('previous\n');
                    state = 'sentCustomCommand';
                    return;
                } else if(queuedCommand == 'random') {
                    queuedCommand = null;
                    if(lastRandom != null) {
                        if(lastRandom == '1') {
                            client.write('random 0\n');
                        } else {
                            client.write('random 1\n');
                        }
                        state = 'sentCustomCommand';
                    }
                    return;
                } else if(queuedCommand == 'consume') {
                    queuedCommand = null;
                    if(lastConsume != null) {
                        if(lastConsume == '1') {
                            client.write('consume 0\n');
                        } else {
                            client.write('consume 1\n');
                        }
                        state = 'sentCustomCommand';
                    }
                    return;
                } else if(queuedCommand == 'repeat') {
                    queuedCommand = null;
                    if(lastRepeat != null) {
                        if(lastRepeat == '1') {
                            client.write('repeat 0\n');
                        } else {
                            client.write('repeat 1\n');
                        }
                        state = 'sentCustomCommand';
                    }
                    return;
                } else {
                    console.log("Writing queued generic command " + queuedCommand + ' ' + queuedState);
                    client.write(queuedCommand);
                    queuedCommand = null;
                    state = queuedState;
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

            handleQueue();
        } else if(state == 'sentListplaylists') {
            console.log('Got all playlists');
            playlists = mpd.parseLists(commandBuffer);
            lastPlaylistRefresh = new Date().getTime();
            SS.publish.broadcast('playlists', playlists)
            handleQueue();
        } else if(state == 'sentPlaylistinfoEntire') {
            var match = playlistinfoRe.exec(data);
            if(match != null){
                console.log("GOT current playing");
                playing = mpd.parseCurrent(commandBuffer);
                SS.publish.broadcast('currentlyPlaying', playing);
            } else {
                console.log('duh');
            }
            handleQueue();
        } else if(state == 'sentIdle' && data.indexOf('changed:') == 0) {
            console.log('got idle status ' + data);
            if(data.indexOf('playlist') != -1 ) {
                //We want to refresh currently playing
                console.log("Regetting currently playing");
                queueCommand('playlistinfo\n', 'sentPlaylistinfoEntire');
            }
            if(data.indexOf('player') != -1 || data.indexOf('mixer') != -1 || data.indexOf('options')) {
                queueCommand('status\n', 'sentStatus');
            }
            handleQueue();
        } else if(state == 'sentStatus' && data.indexOf('volume:') != -1) {
            console.log('got status');
            var match = statusRe.exec(data);
            lastState = match[1];
            var match = randomRe.exec(data);
            lastRandom = match[1];
            var match = playlistIdRe.exec(data);
            playlistId = match[1];
            var match = consumeRe.exec(data);
            lastConsume = match[1];
            var match = repeatRe.exec(data);
            lastRepeat = match[1];
            var match = songIdRe.exec(data);
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
            var match = songRe.exec(data);
            if(match != null) {
                var lastSong = match[1];
            }
            status = {}
            status.song = lastSong;
            status.songId = lastSongId;
            status.playlistId = playlistId;
            status.random = lastRandom;
            status.state = lastState;
            status.repeat = lastRepeat;
            status.consume = lastConsume;
            SS.publish.broadcast('status', status);
            if(state != 'sentPlaylistinfo'){
                handleQueue();
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
            //if(playing == null) {
                // console.log("Done with current song, also fetching currently playing")
                // SS.publish.broadcast('state', "fetching currently playing");
                // client.write('playlistinfo\n');
                // state = 'sentPlaylistinfoEntire';
            /*} else {
                console.log("Done with current song, not fetching currently playing")
                client.write('idle\n');
                state = 'sentIdle';
            }*/
            handleQueue();
        } else if(state == 'addAll') {
            songs = mpd.parseCurrent(commandBuffer);
            mpd.addAll(songs, queueCommand);
            handleQueue();
        } else {
            handleQueue();
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
    consume : function(cb) {
        sendHighlevel('consume');
    },
    repeat : function(cb) {
        sendHighlevel('repeat');
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
        console.log('got next ' + state);
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
                SS.publish.broadcast('playlists', playlists)
            } else {
                SS.publish.broadcast('state', "fetching all playlists");
                client.write('listplaylists\n');
                state = 'sentListplaylists';
            }
        }
    },
    refreshState : function(cb) {
        console.log('got refresh');
        if(client != null) {
            queueCommand('status\n', 'sentStatus');
            d = new Date();
            if(lastPlaylistRefresh != undefined && lastPlaylistRefresh != null) {
                if(lastPlaylistRefresh < d.getTime() - 1000*300) {
                    console.log("Playlists were old, refreshing");
                    queueCommand('listplaylists\n', 'sentListplaylists');
                } else {
                    console.log("Playlists were fresh, not refreshing");
                    SS.publish.broadcast('playlists', playlists)
                }
            } else {
                console.log("Playlists were never fetched, refreshing");
                queueCommand('listplaylists\n', 'sentListplaylists');
            }
            
            if(currentArtist != null && currentTitle != null && currentAlbum != null) {
                SS.publish.broadcast('newsong', [currentTime, currentArtist, currentTitle, currentAlbum]);
            }
            queueCommand('playlistinfo\n', 'sentPlaylistinfoEntire');
            queueCommand('status\n', 'sentStatus');
            activateQueue();
            console.log(commandQueue);
        }
    },
    addPlaylist : function(playlist, cb) {
        console.log("Adding playlist " + playlist);
        queueCommand('listplaylist "' + playlist + '"\n', 'addAll');
        activateQueue();
    },
    deleteTrack : function(id, cb) {
        console.log("Deleting track " + id);
        queueCommand('deleteid "' + id + '"\n', 'unknown');
        queueCommand('playlistinfo\n', 'sentPlaylistinfoEntire');
        activateQueue();
    },
    skipToTrack : function(id, cb) {
        if(playing == null) {
            refreshState();
            return;            
        }
        console.log("Skipping to track " + id);
        mpd.skipToTrack(id, playing, queueCommand);
        activateQueue();
    }

};
