'use strict';

import dgram from 'dgram';
import bencode from 'bencode';
import utils from './utils';
import parallelLimit from './parallel_limit';

const BOOTSTRAP_NODES = [
  ['router.bittorrent.com', 6881],
  ['dht.transmissionbt.com', 6881]
];

const TID_LENGTH = 4;
const TOKEN_LENGTH = 2;


export default class DHTSpider {
  /**
   * [constructor description]
   * @param  {Object} options [description]
   * @return {[type]}         [description]
   */
  constructor(options = {}){
    this.btclient = options.btclient; //btclient instance
    this.address = options.address || '0.0.0.0';
    this.port = options.port || 6219;
    this.udp = dgram.createSocket('udp4');
    this.bootstrapNodes = options.bootstrapNodes || BOOTSTRAP_NODES;
    this.bootstrapIndex = 0;
    this.maxConnectingSockets = options.maxConnectingSockets || 20;
    this.parallelLimit = new parallelLimit(this.maxConnectingSockets);
    this.nid = utils.randomID();
  }

  sendKRPC(msg, rinfo = {}){
    if (rinfo.port >= 65536 || rinfo.port <= 0) {
      return;
    }
    let buf = bencode.encode(msg);
    this.udp.send(buf, 0, buf.length, rinfo.port, rinfo.address);
  }

  onFindNodeResponse(nodes){
    nodes = utils.decodeNodes(nodes);
    nodes.forEach(node => {
      if (node.address !== this.address && node.nid !== this.nid
        && node.port < 65536 && node.port > 0) {
        this.makeNeighbours(node);
      }
    });
  }

  sendFindNodeRequest(rinfo, nid){
    let _nid = nid !== undefined ? utils.genNeighborID(nid, this.nid) : this.nid;
    let msg = {
      t: utils.randomID().slice(0, TID_LENGTH),
      y: 'q',
      q: 'find_node',
      a: {
        id: _nid,
        target: utils.randomID()
      }
    };
    this.sendKRPC(msg, rinfo);
  }

  joinDHTNetwork(){
    this.bootstrapIndex = 1 - this.bootstrapIndex;
    let node = this.bootstrapNodes[this.bootstrapIndex];
    this.sendFindNodeRequest({
      address: node[0], 
      port: node[1]
    });
  }

  makeNeighbours(node){
    this.sendFindNodeRequest({
      address: node.address,
      port: node.port
    }, node.nid);
  }

  onGetPeersRequest(msg, rinfo){
    let infohash = msg.a.info_hash;
    let tid = msg.t;
    let nid = msg.a.id;
    let token = infohash.slice(0, TOKEN_LENGTH);

    if (tid === undefined || infohash.length !== 20 || nid.length !== 20) {
      return;
    }

    this.sendKRPC({
      t: tid,
      y: 'r',
      r: {
        id: utils.genNeighborID(infohash, this.nid),
        nodes: '',
        token: token
      }
    }, rinfo);
  }

  onAnnouncePeerRequest(msg, rinfo){
    let port;
    
    let infohash = msg.a.info_hash;
    let token = msg.a.token;
    let nid = msg.a.id;
    let tid = msg.t;
    
    if (tid === undefined) {
      return;
    }
    
    if (infohash.slice(0, TOKEN_LENGTH).toString() !== token.toString()) {
      return;
    }
    
    if (msg.a.implied_port !== undefined && msg.a.implied_port !== 0) {
      port = rinfo.port;
    }else {
      port = msg.a.port || 0;
    }
    
    if (port >= 65536 || port <= 0) {
      return;
    }

    if(this.parallelLimit.getRemainLength() < this.maxConnectingSockets * 2){
      this.sendKRPC({
        t: tid,
        y: 'r',
        r: {
          id: utils.genNeighborID(nid, this.nid)
        }
      }, rinfo);
    }

    return this.parallelLimit.add(() => {
      return this.btclient.download({
        address: rinfo.address, 
        port: port
      }, infohash).catch(() => {});
    });
  }

  onMessage(msg, rinfo){
    try{
      msg = bencode.decode(msg);
    }catch(e){
      return;
    }
    let y = msg.y && msg.y.toString();
    let q = msg.q && msg.q.toString();
    if (y === 'r' && msg.r.nodes) {
      this.onFindNodeResponse(msg.r.nodes);
    }else if (y === 'q' && q === 'get_peers') {
      this.onGetPeersRequest(msg, rinfo);
    }else if (y === 'q' && q === 'announce_peer') {
      this.onAnnouncePeerRequest(msg, rinfo);
    }
  }

  join(){
    setTimeout(() => {
      let length = this.parallelLimit.getRemainLength();
      if(length < this.maxConnectingSockets){
        this.joinDHTNetwork();
      }
      this.join();
    }, 1000);
  }

  start(){
    this.udp.bind(this.port, this.address);

    this.udp.on('listening', () => {
      console.log('udp start listening:', this.address, this.port);
    });

    this.udp.on('message', (msg, rinfo) => {
      this.onMessage(msg, rinfo);
    });

    this.udp.on('error', err => {
      console.log('error', err.stack);
    });

    this.join();
  }
  
  static start(options){
    let instance = new DHTSpider(options);
    instance.start();
  }
}