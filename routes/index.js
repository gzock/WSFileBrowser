
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'GHS - FileShare', temp: files[0] });
};
