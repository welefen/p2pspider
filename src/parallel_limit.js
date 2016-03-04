'use strict';

import thinkit from 'thinkit';

/**
 * parallel limit
 */
export default class {
  /**
   * limit
   * @param  {[type]}   limit    []
   * @param  {Function} callback []
   * @return {[type]}            []
   */
  constructor(limit, callback){
    if(thinkit.isFunction(limit)){
      callback = limit;
      limit = 0;
    }
    this.limit = limit || 10;
    this.index = 0;
    this.doing = 0;
    this.callback = callback;
    this.deferreds = [];
  }
  /**
   * get remain task length
   * @return {[type]} [description]
   */
  getRemainLength(){
    return this.deferreds.length;
  }
  /**
   * add item data
   * @param {data} item []
   */
  add(item){
    let deferred = thinkit.defer();
    deferred.data = item;
    this.deferreds.push(deferred);
    this.run();
    return deferred.promise;
  }
  /**
   * add many data once
   * @param {Array} dataList [data array]
   */
  addMany(dataList, ignoreError){
    if (thinkit.isEmpty(dataList)) {
      return Promise.resolve();
    }
    let promises = dataList.map(item => {
      let promise = this.add(item);
      return ignoreError ? promise.catch(() => {}) : promise;
    });
    return Promise.all(promises);
  }
  /**
   * next
   * @return {Function} [description]
   */
  next(){
    this.doing --;

    //reduce deferreds avoid memory leak when use single item data
    this.deferreds.splice(this.index - 1, 1);
    this.index--;

    this.run();
  }
  /**
   * run
   * @return {} []
   */
  run(){
    if (this.doing >= this.limit || this.index >= this.deferreds.length) {
      return;
    }
    this.doing++;
    let item = this.deferreds[this.index++];
    let callback = thinkit.isFunction(item.data) ? item.data : this.callback;
    if (!thinkit.isFunction(callback)) {
      throw new Error('data item or callback must be a function');
    }
    let result = callback(item.data);
    if (!thinkit.isPromise(result)) {
      result = Promise.resolve(result);
    }
    return result.then(data => {
      this.next();
      //resolve item
      item.resolve(data);
    }).catch(err => {
      this.next();
      //reject item
      item.reject(err);
    });
  }
}