exports.sendHighLevel = (command) ->
  if client != null
    if state == 'sendIdle'
      client.write 'noidle\n'
      state = 'sentNoIdle';
      queuedCommand = command;

plRe = /playlist: (.*)/
exports.parseLists = (data) ->
  index = 0
  playlists = []
  while index < data.length
    #console.log data[index]
    m = plRe.exec(data[index])
    if m != null
      playlists.push m[1]
    index+=2
  return playlists

  
String::beginsWith = (str) -> if @match(new RegExp "^#{str}") then true else false
String::endsWith = (str) -> if @match(new RegExp "#{str}$") then true else false
exports.checkIfCmdEnd = (commandBuffer) ->
  cmds = (s for s in commandBuffer when s.length > 0)
  if cmds.length == 0 || cmds[cmds.length-1] == undefined || cmds[cmds.length-1] == null
    return
  String last = cmds[cmds.length-1]
  console.log "Last:" + last
  if last.beginsWith("OK") || last.beginsWith("ACK")
    return 1
  else
    return 0
    
exports.logcommands = (commandBuffer )->
  console.log commandBuffer[0..17]


exports.addAll = (songs, queueCommand) ->
  for song in songs
    console.log song.file
    queueCommand('addid "' + song.file + '"\n', '')
  queueCommand('status\n', 'getStatus')

exports.skipToTrack = (id, playing, queueCommand) ->
  for song in playing
    console.log song.id
    if(song.id != id)
      queueCommand('deleteid "' + song.id + '"\n', '')
    else
      queueCommand('deleteid "' + song.id + '"\n', '')
      return

exports.commandList = (commandQueue, client) ->
  console.log 'Using commandlists'
  client.write 'command_list_begin\n'
  index = 0
  newQueue = commandQueue
  for cmd in commandQueue
    client.write cmd[0]
    newQueue = newQueue.splice(index, index)
    index++
  client.write 'command_list_end\n'
  return newQueue

exports.parseCurrent = (data) ->
  index = 0
  songs = []
  curr = {}
  while index < data.length
    String s = data[index]
    if s.beginsWith('file: ')
      if curr.file != undefined && curr.file != null
        songs.push(curr)
      curr = {}
      curr.file = s[6..s.length-1]
    else if s.beginsWith('Title: ')
      curr.title = s[6..s.length-1]
    else if s.beginsWith('Artist: ')
      curr.artist = s[8..s.length-1]
    else if s.beginsWith('Id: ')
      curr.id = s[4..s.length-1]
    else if s.beginsWith('Track: ')
      curr.track = s[7..s.length-1]
    else if s.beginsWith('Pos: ')
      curr.pos = s[5..s.length-1]
    else if s.beginsWith('Time: ')
      curr.time = s[6..s.length-1]
    index += 1
  if curr != null && curr.file != undefined
    songs.push(curr)
  return songs
