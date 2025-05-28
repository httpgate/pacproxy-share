# pacproxy-share

a website module used to share blocked internet, it can be deployed inside pacproxy-server, Nginx, LiteSpeed, CDN. 

用于分享互联网的网站模块，可以部署在pacproxy-server, Nginx, Litespeed服务器或CDN内.


# 使用

运行pacproxy-share后，屏幕会显示根url, 如：https://localhost/sharepath

要翻墙访问某个网站，如 m.dongtaiwang.com , 则访问：https://localhost/sharepath/m.dongtaiwang.com

pacproxy-share适用于安全需求不是很高的人群，用于分享一些大众新闻。pacproxy-share禁用了cookie, 所以只支持网站读取，不支持登录发布信息等，也不搜集或泄露访问者信息。

一些javascript动态生成主页的网站可能无法正常显示和访问，如 youtube, twitter, facebook, ganjingworld 等。

# 运行

如果已安装Nodejs,可用npm直接安装运行：

```
sudo npm install -g pacproxy-share
sudo pacproxy-share
```


也可下载直接点击[绿色可执行文件](https://github.com/httpgate/resouces/tree/main/pacproxy-share)，或在命令行执行，按以下顺序加上可选参数:

sudo ./pacproxy-share  [DOMAIN]  [ROOT]  [PORT]  [IP]  [-v]  [-http]

sudo node ./runshare.js [DOMAIN]  [ROOT]  [PORT]  [IP]  [-v]  [-http]

用-h参数会显示可选参数定义: ./pacproxy-share -h 会显示：

```
Usage: pacproxy-share <domain> [<root>] [<port>] [<ip>] [-v] [-http]
  <domain>  : Domain name to use for the share
  <root>    : Root path of share URL (default: /sharepath )
  <port>    : Port number to listen on (default: 8080)
  <ip>      : IP address to bind to (default: all interfaces)
  -v        : Enable verbose logging
  -http     : Use HTTP instead of HTTPS
```

一般运行pacproxy-share后, 需要再利用加密反向代理服务（如Nginx,LiteSpeed等）将其转换成加密网站，或直接利用CDN转换成加密网站。 http模式仅用于测试用。


# 后台运行

* 建议用pm2后台运行

```
sudo npm install -g pm2
sudo pm2 start pacproxy-share -- [DOMAIN]  [ROOT]  [PORT] 
```

* 具体请参考[用pm2直接运行npm库](https://github.com/httpgate/resouces/tree/main/pm2_Run_Npm_Package.md)

## 推荐

推荐用pacproxy-share安全的访问以下网站：
* 明慧网：https://www.minghui.org
* 干净世界：https://www.ganjing.com
* 神韵作品: https://shenyunzuopin.com
* 大法经书: https://www.falundafa.org