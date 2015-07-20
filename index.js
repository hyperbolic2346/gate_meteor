// Data is read from select statements published by server
var time = Session.get('time') || new Date();

videos = new MysqlSubscription('video_list', time);
gate_controls = new MysqlSubscription('gate_controls');

//players = new MysqlSubscription('allPlayers');
//myScore = new MysqlSubscription('playerScore', 'Maxwell');

//myScore.addEventListener('update', function(index, msg){
//  console.log(msg.fields.score);
//});

if (Meteor.isClient) {

  // Provide a client side stub
  Meteor.methods({
    'delete_video': function(id){
      var originalIndex;
      var originalDeleted;
      videos.forEach(function(video, index){
        if (video.id === id) {
          originalIndex = index;
          originalDeleted = video[index].deleted;
          video[index].deleted = true;
          videos.changed();
        }
      });

      // Reverse changes if needed (due to resorting) on update
      videos.addEventListener('update.delete_video_stub', function(index, msg){
        if(originalIndex !== index){
          videos[originalIndex].deleted = originalDeleted;
        }
        videos.removeEventListener('update.delete_video_stub');
      });
    }
  });

  Template.video.events({
    'click .delete': function(id){
      Meteor.call('delete_video', id);
    }
  });
}

if (Meteor.isServer) {
  var liveDb = new LiveMysql({
    host: 'mysql.burntsheep.com',
    user: 'motion',
    password: 'zTpvxKUFCYTGEZc7',
    database: 'motion'
  });

  var closeAndExit = function() {
    liveDb.end();
    process.exit();
  };
  // Close connections on hot code push
  process.on('SIGTERM', closeAndExit);
  // Close connections on exit (ctrl + c)
  process.on('SIGINT', closeAndExit);

  Meteor.publish('gate_controls', function(){
    return liveDb.select(
      'SELECT TIME(event_time_stamp) as timefield, '.
      'security_events.event_id, security_events.camera, filename, file_type '.
      'FROM security_file LEFT JOIN security_events ON security_events.event_id = security_file.event_id '.
      'WHERE event_time_stamp >= '.time.'000000 AND event_time_stamp <= '.time.'235959 ',
      [ { table: 'security_events', table: 'security_file' } ]
    );
  });

  Meteor.methods({
    'delete_video': function(id){
      if (typeof id === 'number') {
        liveDb.db.query(
          'UPDATE security_events SET deleted="1" WHERE event_id = "?"'
          [ id ]
        );
      }
    }
  });
}
