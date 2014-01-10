﻿# 离线Sebug

![image](https://raw.github.com/ChiChou/offlineSebug/master/screenshot.png)

这是一个可以整站抓取SEBUG漏洞库的脚本，并支持保存漏洞信息中的外链为PDF快照。
分为抓取和WEB展示两个组件。

** 2013-12-20 补充 由于数据库比较大，压缩后放在百度网盘。
http://pan.baidu.com/s/1i3iIfQX
下载后解压到result目录即可。

## 配置
运行npm install安装所需组件
下载phantomjs(http://phantomjs.org/)的二进制程序（如phantomjs.exe），放到程序目录中
运行`node app.js --setup`准备数据库
按需修改配置（默认也可）

## 抓取
* 运行`node app.js --full` 抓取整站
* 运行`node app.js --range 1 100` 抓取前1~100页
* 运行`node app.js --keyword dedecms` 抓取仅包含关键字的漏洞结果
* 程序将把抓取到的内容保存在result/sebug.db中
* 整个抓取时间取决于您的网络环境和抓取区间范围，如我在抓取整站内容的时候耗时约7小时

## WEB界面
抓取完成后，运行`node app.js --web`即可。
