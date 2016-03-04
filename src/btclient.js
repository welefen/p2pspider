'use strict';

import net from 'net';
import EventEmitter from 'events';
import Wire from './wire';
import utils from './utils';
import thinkit from 'thinkit';

export default class BTClient extends EventEmitter {
  /**
   * constructor
   * @param  {Object} options [description]
   * @return {[type]}         [description]
   */
  constructor(options = {}){
    super();
    this.timeout = options.timeout || 5000;
  }
  /**
   * format meta data
   * @param  {[type]} metadata [description]
   * @return {[type]}          [description]
   */
  formatMetaData(metadata){
    let info = metadata.info;
    let name = (info['utf-8.name'] || info.name);
    if(!name){
      return;
    }
    name = utils.toUtf8String(name);

    let data = {
      name,
      size: info.length
    };
    if(info.private){
      data.private = info.private;
    }
    if(info.files){
      let total = 0;
      data.files = info.files.map(item => {
        item.path = item.path.map(it => {
          return utils.toUtf8String(it);
        }).join('/');
        total += item.length;
        return {
          size: item.length,
          path: item.path
        };
      }).sort((a, b) => {
        return a.size > b.size ? -1 : 1;
      });
      data.size = total;
    }else{
      data.files = [{
        size: data.size,
        path: data.name
      }];
    }

    let extraProperties = ['source', 'profiles', 'private', 'file-duration', 'file-media', 'pieces'];
    extraProperties.forEach(item => {
      if(info[item]){
        data[item] = info[item];
      }
    });
    
    return data;
  }
  /**
   * download
   * @param  {Object} rinfo    [description]
   * @param  {[type]} infohash [description]
   * @return {Promise}          [description]
   */
  download(rinfo = {}, infohash){

    let deferred = thinkit.defer();
    let socket = new net.Socket();

    socket.setTimeout(this.timeout);

    socket.connect(rinfo.port, rinfo.address, () => {
      
      let wire = new Wire(infohash);
      socket.pipe(wire).pipe(socket);

      wire.on('metadata', (metadata, infoHash) => {
        deferred.resolve();
        socket.destroy();

        metadata = this.formatMetaData(metadata);
        if(!metadata){
          return;
        }
        this.emit('complete', metadata, infoHash, rinfo);
      });

      wire.sendHandshake();
    });
    
    socket.on('error', () => {
      deferred.reject();
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      deferred.reject();
    });

    socket.on('close', () => {
      deferred.resolve();
    });

    socket.on('end', () => {
      deferred.resolve();
    });

    return deferred.promise;
  }

}