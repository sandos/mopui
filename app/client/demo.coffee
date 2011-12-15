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

  # Show the chat form and bind to the submit action
  # Note how we're passing the message to the server-side method as the first argument
  # If you wish to pass multiple variable use an object - e.g. {message: 'hi!', nickname: 'socket'}
  $('#demo').show().submit ->
    message = $('#myMessage').val()
    if message.length > 0
      SS.server.apa.reconnect(->)
    else
      alert('Oops! You must type a message first')
