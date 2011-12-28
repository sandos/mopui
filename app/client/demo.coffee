### QUICK CHAT DEMO ####

# Delete this file once you've seen how the demo works

exports.init = ->

  # Listen for new messages and append them to the screen
  SS.events.on 'newMessage', (message) ->
    $("<p>#{message}</p>").hide().appendTo('#chatlog').slideDown()

  SS.events.on 'state', (message) ->
    $("#status").text(message)

  SS.events.on 'newsong', (message) ->
    $("#title").text(message[2])
    $("#artist").text(message[1])
    $("#album").text(message[3])

  SS.events.on 'playlists', (playlists) ->
    $('#playlists').html('<ul>')
    playlists.forEach (playlist) ->
      $('#playlists').append("<li class=\"track\" onclick='SS.server.mpd.addPlaylist(\"#{playlist}\")'>#{playlist}</li>")
    $('#playlists').append('</ul>')

  SS.events.on 'status', (status) ->
    if(status.random == '1')
      $('#rand').css({'font-weight' : 'bold'})
    else
      $('#rand').css({'font-weight' : 'normal'})
    if(status.consume == '1')
      $('#consume').css({'font-weight' : 'bold'})
    else
      $('#consume').css({'font-weight' : 'normal'})
    if(status.state == 'play')
      $('#play').css({'font-weight' : 'bold'})
    else
      $('#play').css({'font-weight' : 'normal'})
    if(status.repeat == '1')
      $('#repeat').css({'font-weight' : 'bold'})
    else
      $('#repeat').css({'font-weight' : 'normal'})
    
  SS.events.on 'currentlyPlaying', (songs) ->
    $('#playingInfo').html("#{songs.length} songs in playlist")
    $('#playing').html("<ul>")
    songs.forEach (song) ->
      $('#playing').append("<li class=\"currentitem\">")
      $('#playing').append("<div class=\"deletetrack\" onclick='SS.server.mpd.deleteTrack(\"#{song.id}\")'>DEL&nbsp;</div>")
      $('#playing').append("<div class=\"skiptotrack\" onclick='SS.server.mpd.skipToTrack(\"#{song.id}\")'>SKIP&nbsp;</div>")
      $('#playing').append("<div class=\"song\"><div class=\"currentartist\">#{song.artist}</div>")
      $('#playing').append("<div class=\"currentsong\">#{song.title}</div></div></li>")
    $('#playing').append('</ul>')


  # Show the chat form and bind to the submit action
  # Note how we're passing the message to the server-side method as the first argument
  # If you wish to pass multiple variable use an object - e.g. {message: 'hi!', nickname: 'socket'}
  $('#demo').show().submit ->
    message = $('#myMessage').val()
    if message.length > 0
      SS.server.apa.reconnect(->)
    else
      alert('Oops! You must type a message first')

