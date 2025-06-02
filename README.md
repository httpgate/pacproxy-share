# pacproxy-share

a website module used to share blocked internet, it can be deployed inside pacproxy-server, Nginx, LiteSpeed, CDN. 

用于分享互联网的网站模块，可以部署在pacproxy-server, Nginx, Litespeed服务器或CDN内.


# 使用

运行pacproxy-share后，屏幕会显示根url, 如：https://localhost/sharepath

要翻墙访问某个网站，如 m.dongtaiwang.com , 则访问：https://localhost/sharepath/m.dongtaiwang.com

pacproxy-share适用于安全需求不是很高的人群，用于分享一些大众新闻。pacproxy-share一般情况下禁用了cookie, 所以只基本只支持网站读取，不支持登录发布信息等。但干净世界和神韵作品网站可以正常登录观看。

一些javascript动态生成主页的网站可能无法正常显示和访问，如 youtube, twitter, facebook 等。

# 运行

如果已安装Nodejs,可用npm直接安装运行：

```
sudo npm install -g pacproxy-share
sudo pacproxy-share
```


也可下载直接点击[绿色可执行文件](https://github.com/httpgate/resouces/tree/main/pacproxy-share)，或在命令行执行，按以下顺序加上可选参数:

sudo pacproxy-share  [DOMAIN]  [ROOT]  [PORT]  [IP]  [-v]  [-http]

sudo node ./runshare.js [DOMAIN]  [ROOT]  [PORT]  [IP]  [-v]  [-http]

用-h参数会显示可选参数定义: pacproxy-share -h 会显示：

```
Usage: pacproxy-share <domain> [<root>] [<port>] [<ip>] [-v] [-http]
  <domain>  : Domain name to use for the share
  <root>    : Root path of share URL (default: /sharepath )
  <port>    : Port number to listen on (default: 8080)
  <ip>      : IP address to bind to (default: all interfaces)
  -v        : Enable verbose logging
  -http     : Use HTTP instead of HTTPS
```


# 后台运行

* 建议用pm2后台运行

```
sudo npm install -g pm2
sudo pm2 start pacproxy-share -- [DOMAIN]  [ROOT]  [PORT] 
```

* 具体请参考[用pm2直接运行npm库](https://github.com/httpgate/resouces/tree/main/pm2_Run_Npm_Package.md)


# 安全设置

一般运行pacproxy-share后, 需要再利用加密反向代理服务（如Nginx,LiteSpeed等）将其转换成加密网站，或直接利用CDN转换成加密网站。 http模式仅用于测试用。

[pacproxy-server](https://github.com/httpgate/pacproxy-server)集成了pacproxy-share模块，可根据需要选用。

可利用一些短网址功能指向一些常用网址，并用带背景的图片传播。尽量避开微信浏览器，微信直接打开链接时是用微信浏览器。

建议用CDN加速，如果被屏蔽只需要变更CDN域名即可。 可用CDN的URL Redirect Rule功能将一些常用网址映射成短网址，方便输入。

如果用CDN加速，运行时domain参数为CDN Domain. Cloudfront CDN默认关闭了POST method, 需要启用。

## 推荐

推荐用pacproxy-share访问以下网站：

* 明慧网：https://www.minghui.org
* 干净世界：https://www.ganjing.com
* 神韵作品: https://shenyunzuopin.com
* 大法经书: https://www.falundafa.org
