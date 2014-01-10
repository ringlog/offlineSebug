var sqlite3 = require('sqlite3')
  , config  = require('./config').default
  ;

var db = new sqlite3.Database(config.db.database);
var SQL = {
	insertVul: "INSERT INTO vul(ssv, appdir, title, content, pubdate) VALUES (?,?,?,?,?);",
	insertPdf: "INSERT INTO pdf(md5, url, title) VALUES (?,?,?);",
};

//创建数据库
exports.setup = function(callback) {
    //创建表结构
    [
		"CREATE TABLE [dir] ([key] [CHAR(1)], [appdir] [varchar(50)], [title] [VARCHAR(50)], [nid] INTEGER);",
		"CREATE INDEX [dir_id] ON [dir] ([nid]);",
		"CREATE TABLE [pdf] ([md5] [CHAR(32)], [url] [VARCHAR(1024)], [title] [VARCHAR(128)]);",
		"CREATE TABLE [vul] ([ssv] INT, [appdir] [VARCHAR(50)], [title] [VARCHAR(200)], [content] VARCHAR, [pubdate] DATE);"
	].forEach( function(val, index, array) {
        db.run(val);
    });
    ( callback || function(){} )();
}

//存储漏洞
exports.insertVul = function(data, callback) {
	db.run(SQL.insertVul, data, callback);
}
//存储外链
exports.inserPdf = function(data, callback) {
    db.run(SQL.insertPdf, data, callback);
}

//字母目录
exports.dir = function(alphabet, callback) {
	alphabet = alphabet.match(/^\w$/) ? alphabet.toUpperCase() : "0";
	db.all("select appdir as id, appdir, title from [dir] where key=?", [alphabet], function(err, rows) {
		callback({
			prefix: "app",
			title: alphabet,
			page: 0,
			list: err ? [] : rows
		});
	});
}

//读取单独APP
exports.app = function(title, page, callback) {
	var start = parseInt(page);
	start = start < 0 ? 0 : start * 20 ;
	db.all("select ssv as id, appdir, title, pubdate from [vul] where appdir=? order by pubdate desc limit ?, 20",
		[title, start], function(err, rows) {
		callback({
			search: title,
			prefix: "vul",
			title: title + "的漏洞目录",
			page: page,
			list: err ? [] : rows
		});
	});
}

//模糊检索
exports.search = function(keyword, page, callback) {
	keyword = keyword.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5\' ']/g, "");	
	var start = parseInt(page)
	start = start < 0 ? 0 : start * 20 ;
	var where = "content like '%" + keyword.replace(/\s{1,}/g, "%' and content like '%") + "%'";
	db.all("select ssv as id, ssv, title, appdir, pubdate from [vul] where "
		+ where + " order by pubdate desc limit ?, 20", [start], function(err, rows) {
		callback({
			search: keyword,
			prefix: "vul",
			title: keyword + "的搜索结果",
			page: page,
			list: err ? [] : rows
		});
	})
}

//读取漏洞
exports.vul = function(ssvid, callback) {
	db.get("select ssv as id, * from [vul] where ssv = ? limit 1", [ssvid], function(err, row) {
		callback(err ? {} : row);
	})
}