
import DHTSpider from './dhtspider';
import BTClient from './btclient';

export default (options = {}, callback) => {

  if(typeof options === 'function'){
    callback = options;
    options = {};
  }

  let btclient = new BTClient({
    timeout: options.timeout
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
    maxConnectingSockets: options.maxConnectingSockets
  });
};

module.exports = exports.default;