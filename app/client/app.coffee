# Client-side Code

# Bind to socket events
SS.socket.on 'disconnect', ->  $('#message').text('SocketStream server is down :-(')
SS.socket.on 'reconnect', ->   $('#message').text('SocketStream server is up :-)')

# This method is called automatically when the websocket connection is established. Do not rename/delete
exports.init = ->

  # Make a call to the server to retrieve a message
  SS.server.app.init (response) ->
    $('#message').text(response)

  SS.server.mpd.getPlaylists (playlists) ->
    $('playlists').text('<ul>')
    playlists.forEach (playlist) ->
      $('#playlists').append("<li>#{playlist}</li>")
    $('playlists').append('</ul>')

  
  # Start the Quick Chat Demo
  SS.client.demo.init()
