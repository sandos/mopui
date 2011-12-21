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
  if last.beginsWith("OK") || last.beginsWith("ACK")
    return 1
  else
    return 0
    
exports.logcommands = (commandBuffer )->
  console.log commandBuffer[0..35]


exports.parseCurrent = (data) ->
  index = 0
  songs = []
  curr = null
  while index < data.length
    String s = data[index]
    if s.beginsWith('file: ')
      if curr != null
        songs.push(curr)
      curr = {}
      curr.file = s[6..s.length-1]
    else if s.beginsWith('Title: ')
      curr.title = s[6..s.length-1]
    index += 1
  return songs
