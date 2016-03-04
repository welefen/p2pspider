
import DHTSpider from './dhtspider';
import BTClient from './btclient';

export default (options = {}, callback) => {

  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  let btclient = new BTClient({
    timeout: options.timeout,
    maxConnectingSockets: options.maxConnectingSockets
  });

  btclient.on('complete', (metadata, infohash, rinfo) => {
    let data = metadata;
    data.address = rinfo.address;
    data.port = rinfo.port;
    data.infohash = infohash.toString('hex');
    data.magnet = 'magnet:?xt=urn:btih:' + data.infohash;

    if(callback){
      callback(data);
    }else{
      console.log(data.name, data.magnet);
    }
  });

  DHTSpider.start({
    btclient: btclient,
    address: options.address,
    port: options.port,
    interval: options.interval,
    nodesMaxSize: options.nodesMaxSize  // 值越大, 网络, 内存, CPU 消耗就越大, 收集速度会变慢.
  });
};

module.exports = exports.default;