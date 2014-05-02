
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();
//var server = http.createServer(app);

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

var glob = require("glob");
options = null;

//ここ重要
//こうしないとsocket.ioの読み込み失敗する
var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

var BinaryServer = require('binaryjs').BinaryServer;
var bs = BinaryServer({server: server});

// app.get('/', routes.index);
app.get('/', function(req,res) {
    res.render('index', { title: 'GHS - FileBrowser'});
});
app.get('/users', user.list);


var fs = require('fs');
var currentDir;

//WebSocketのコネクションはられるとこのイベント発生
bs.on('connection', function (client) {
        console.log('WebSocket Connected !');

　　　　//streamはられるとこのイベント発生
        client.on('stream', function(stream, meta) {
                console.log('Stream Connected !');
                
                //stream流れてくるとこの中
                stream.on('data', function(data) {
                    console.log(data);

                    if(data != "oneOn") {

                        //statSyncで対象の情報取得
                        //ディレクトリ移動
　　　　　　　　　　    //クライアントから絶対パスが送られているので、それのケツに*つけて全ファイル取得
　　　　　　　　　　    //カレントディレクトリは保持しとく
                        var stat = fs.statSync(data);
                        if(stat.isDirectory()) {
                            console.log(data + " is directory...");
                            var targetDir = data + "/*";
                            glob(targetDir, options, function (er, files) {
                                fileListUpdate(files, stream, data);
                                currentDir = data;
                            });

                        //対象がファイルならstream使ってファイル吸い上げて、
                        //パイプ使って逐一クライアントにぶん投げる
                        } else if(stat.isFile()) {
                            stream.write({size: stat.size, flag: "true"});
                            var rs = fs.createReadStream(data);
                            rs.pipe(stream);
                            console.log("StreamID -> " + stream.id);
                            console.log("Send To -> " + data);
                            console.log("Size -> " + stat.size);
                            console.log("send...");
                        }

                    //1つ階層上にあがる
　　　　　　　　　  //保持してたカレントディレクトリから/で区切って最後を削除
                    //ファイル名に/は使えないはずだから、これで問題ないはず
                    } else if(data == "oneOn") {
                        var oneOnDir = currentDir.slice(0, currentDir.lastIndexOf("/"));
                        console.log("currentDir >> " + currentDir);
                        console.log("oneOnDir >> " + oneOnDir);

                        var targetDir = oneOnDir + "/*";
                        glob(targetDir, options, function (er, files) {
                            fileListUpdate(files, stream);
                            currentDir = oneOnDir;
                        })
                    }
                       
                });
        });
});

//ファイルリストのアップデート関数
//fs使って取得したファイルリストをforEach使って、
//逐一タイプとサイズを取得してArrayにぶち込む
//それぞれのArrayはjson形式でクライアントに投げる
function fileListUpdate(files, stream, data) {
    var fileType = new Array();
    var fileSize = new Array();
    var i = 0;
    files.forEach(function(file) {
        var fileStat = fs.statSync(file);

        if(fileStat.isDirectory()) {
            fileType[i] = "Directory";
        } else if(fileStat.isFile()) {
            fileType[i] = "File";
        }
        fileSize[i] = fileStat.size;
        i++;
    });
    stream.write({fileList: files, type: fileType, size: fileSize, flag: "false"});

    console.log(files);
    console.log(fileType);
    console.log(fileSize);
    console.log("currentDir >> " + currentDir);
    console.log("StreamID -> " + stream.id);
}
