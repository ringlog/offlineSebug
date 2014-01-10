var $ = require("jQuery"),
    http = require("http"),
    os = require("os"),
    crypto = require('crypto'),
    fs = require("fs"),
    sqlite3 = require('sqlite3').verbose(),
    phantom = require('phantom'); //用来生成pdf

//爬行区间
var range = {
    begin: 0,
    end: Infinity
};

var db = require("./db");
//@TODO: exit process and clean up

/*
    constant
*/
var URL = {
    base: "http://sebug.net/",
    entry: "http://sebug.net/appdir/",
    search: "http://sebug.net/search?wd={$t}&start={$p}",
    list: "http://sebug.net/vuldb/vulnerabilities?start={$p}",
    single: "http://sebug.net/vuldb/ssvid-{$id}",
    jump: "http://sebug.net/lto?url="
};

//queue
var pageCount = {};
var queue = [];

/*
    build appdir
*/
var sebugCrawler = {};
var ph;
console.log("Initializing...");
phantom.create(function(instance) {
    ph = instance;
    console.log("PhamtomJS ready.");
});

sebugCrawler.setRange = function(begin, end) {
    range = { begin:begin, end:end };
};

sebugCrawler.userAgent = function() {
    var UA = [
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.69 Safari/537.36",
        "Mozilla/5.0 (Windows NT 6.1; Win64; x64; Trident/7.0; Media Center PC 6.0; .NET4.0C; .NET4.0E; rv:11.0) like Gecko",
        "Mozilla/5.0 (iPad; U; CPU OS 3_2_1 like Mac OS X; en-us) AppleWebKit/531.21.10 (KHTML, like Gecko) Mobile/7B405",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/536.5 (KHTML, like Gecko) Chrome/19.0.1084.56 Safari/536.5",
        "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/535.1 (KHTML, like Gecko) Chrome/13.0.782.107 Safari/535.1",
        "Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/533.4 (KHTML, like Gecko) Chrome/5.0.375.99 Safari/533.4 ChromePlus/1.4.1.0alpha1",
        "Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/533.1 (KHTML, like Gecko) Chrome/5.0.336.0 Safari/533.1 ChromePlus/1.3.8.1"
    ];
    return UA[Math.floor(Math.random() * UA.length)];
};

sebugCrawler.get = function(url, callback) {
    $.ajax({
        url: url,
        type: "GET",
        success: callback,
        error: function(data) {
            //wait and retry
            console.log("Fetching", url, "failed, retry");
            fs.appendFile("error.log", url + os.EOL);
            queue.push({url: url, callback: function() {
                sebugCrawer.get(url, callback);
            }});
            setTimeout(sebugCrawler.queueHandler, 20);
            //setTimeout(function() {sebugCrawler.get(url, callback)}, 1000);			
        },
        beforeSend: function(xhr) {
            xhr.setRequestHeader("User-Agent", sebugCrawler.userAgent());
        }
    });
}

sebugCrawler.appdir = function () {
    sebugCrawler.get(URL.entry, function(res) {
        var dom = $(res);
        db.run("DELETE FROM dir");
        var stmt = db.prepare("INSERT INTO dir(key, title, appdir, nid) VALUES (?,?,?,'ROWID');");
        dom.find(".applists").each(function() {
            var key = this.id.substring(0, 1);
            $(this).find("li > a").each(function() {
                var appdir = this.href, title = this.innerHTML;
                appdir = appdir.substring(appdir.lastIndexOf("/") + 1);
                stmt.run(key, title, appdir);
                console.log("Creating directory:", title);
            });	
        });
        stmt.finalize();
        console.log("AppDir Finished.");
    });
};

sebugCrawler.single = function(ssvid) {
    var url = URL.single.replace("{$id}", ssvid);
    console.log("Fetching: ", url);
    sebugCrawler.get(url, function(res) {
        setTimeout(sebugCrawler.queueHandler, 200);

        fs.appendFile("crawler.log", "[Info]Parsing: " + url);

        //过滤非法标签
        res = res.replace(/\<\*| \*\>/g, '');

        //构建DOM树
        var dom = $(res);
        dom.find("#isad").remove();

        //ssv, appdir, title, content, pubdate
        var rule = {
            1: parseInt(ssvid),
            2: /http:\/\/sebug.net\/appdir\/(\S+)\"/,
            3: ".article_title",
            4: "#content",
            5: /发布时间: (\d{4}\-\d{2}\-\d{2})/
        };

        var data = {};
        //assign values
        for(var i in rule) {
            var r = rule[i];
            if(typeof r === "string") {
                data[i] = dom.find(r).html(); //perfodms better than text() in theory
            } else if(r instanceof RegExp) {
                var match = res.match(r);
                data[i] = match && match.length >= 2 ? match[1] : "";
            } else {
                data[i] = r;
            }
        }

        //插入文档库
        db.insertVul(data);

        //抓取外链
        dom.find("#content a[href^='" + URL.jump + "']").each(function(i, e) {
            var outerUrl = this.href;
            outerUrl = outerUrl.substring(outerUrl.indexOf(URL.jump) + URL.jump.length);

            var hash = crypto.createHash('md5').update(outerUrl).digest('hex');
            var pdfFile = config.pdf + hash + '.pdf';
            if(fs.existsSync(pdfFile)) return; //跳过已存在文件

            if(!ph) {
                throw new Error("PhamtomJS not ready!");
            }
            ph.createPage(function(page) {
                page.open(outerUrl, function(status) {
                    if(status === "success") {
                        //插入附件列表
                        db.insertPdf({
                            1: hash, 2: outerUrl, 3: page.evaluate(function() { return document.title;})
                        });

                        //渲染PDF
                        page.render(pdfFile, function() {
                            console.log(outerUrl, ' Rendered');
                        });
                    }
                    page.release();
                    page = null;
                });
            });
        });

        // @TODO:使用MongoDB的GridFS功能存取exp
        // dom.find(".article pre").each(function(i, e) {
        // 	if(this.innerHTML.length === 0) return;
        // 	var path = storage.payload + ssvid + "/";
        // 	if(!fs.existsSync(path)) fs.mkdirSync(path);
        // 	fs.writeFile(path + i + ".txt", this.innerHTML);
        // });
    });
}

sebugCrawler.search = function(key, page) {
    //convert "织梦(DedeCMS)" to "DedeCMS" to match all results
    var match = key.match(/\((\S+)\)/);
    if(match && match.length === 2) key = match[1];

    page = page || 1;
    var url = URL.search.replace(/\{\$(\w)\}/g, function($0, $1) {return {"t": key, "p": page}[$1];});

    console.log("URL:", url);
    sebugCrawler.get(url, function(data) {
        var dom = $(data);
        console.log("Current: ", page);

        if(page === 1) {
            pageCount[key] = total = parseInt(dom.find(".pages > a").last().text());
            console.log("Total: ", total);
        }

        dom.find(".li_list > ul > li").each(function(i, e) {
            var match = $(this).find("a").attr("href").match(/vid-(\d+)/);
            if(match.length !== 2) return;

            queue.push({url: match[1], callback: function() {
                sebugCrawler.single(match[1]);
            }});

            // setTimeout(function() {
            // 	sebugCrawler.single(match[1]);
            // }, i * 1000);
            
            //WARNING: If match result is null, an exception would be thrown
            //item.title = this.innerHTML; //For better performance, do not use a.text()
            //_single(ssvid);
        });

        if(page < pageCount[key]) 
            setTimeout(function() {
                sebugCrawler.search(key, page + 1);
            }, 20);
        else 
            sebugCrawler.queueHandler();
    });
};

sebugCrawler.craw = function(page) {
    page = page || range.begin;
    var url = URL.list.replace("{$p}", page);

    console.log("page ", page, ", url: ", url);

    sebugCrawler.get(url, function(data) {
        var dom = $(data);

        if(page === 1) 
            console.log("Total: ", pageCount[''] = parseInt(dom.find(".pages > a").last().text()));

        dom.find(".li_list > ul > li").each(function(i, e) {
            var match = $(this).find("a").attr("href").match(/vid-(\d+)/);
            if(match.length !== 2) return;

            queue.push({url: match[1], callback: function() {
                sebugCrawler.single(match[1]);
            }});
            // setTimeout(function() {
            // 	sebugCrawler.single(match[1]);
            // }, i * 1000);
            //WARNING: If match result is null, an exception would be thrown
        });

        //@TODO:
        if(page < range.end && page < pageCount['']) //pageCount['']	
            setTimeout(function() {
                sebugCrawler.craw(page + 1);
            }, 20);
        else 
            sebugCrawler.queueHandler();
    });
}

sebugCrawler.queueHandler = function() {
    var item = queue.pop();
    if(item)
        item['callback'](item.url);
    else
        console.log(new Date, "Empty queue.");
}

module.exports = sebugCrawler;