var crawler = require("./crawler")
  , db = require("./db")
  , os = require("os")
  ;

var usage = function () {
    console.log([
      "OfflineSebug v0.1",
      "Usage:node " + process.argv[1] + "[OPTIONS]",
      "Mandatory arguments to long options are mandatory for short options too.",
      "",
      "-S,  --setup              Prepare SQLite database.",
      "-A,  --appdir             Fetch application directory.",
      "-R,  --range [from] [to]  Fetch pages in the given range.",
      "-F,  --full               Fetch the whole site.",
      "-K,  --keyword            Fetch items match given keyword.",
      "-W,  --web                Start web UI.",
      "-H,  --help               To display manual."
    ].join(os.EOL));
    process.exit();
};

if (process.argv.length >= 3) {
    switch (process.argv[2]) {
        case "--setup":
        case "-S":
            //创建数据库
            db.setup();
            break;
        case "--appdir":
        case "-A":
            //应用程序目录
            crawler.appdir();
            break;
        case "--range":
        case "-R":
            if (process.argv.length !== 5) {
                usage();
            }
            var begin = parseInt(process.argv[4]) || 1,
                end = parseInt(process.argv[5]) || Infinity;
            console.log("Crawling page", begin, "-", end);
            crawler.setRange(begin, end);
            crawler.craw();
            break;
        case "--full":
        case "-F":
            //整站抓取
            crawler.craw();
            break;
        case "--keyword":
        case "-K":
            //针对关键字的爬取
            if (index !== array.length - 2) {
                console.log("Keyword missing.");
                usage();
            }
            crawler.search(array[index + 1]);
            break;
            break;
        case "--web":
        case "-W":
            //显示一个网站
            require("./web");
            break;
        case "--help":
        case "-H":
        default:
            //命令行参考            
            usage();
    }
}
