var p2pspider = require('../lib/index.js');

p2pspider(data => {
  console.log(data.infohash, data.name);
});